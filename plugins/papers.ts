import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { PAPERS_PLUGIN, type PapersData } from '../src/lib/papers/types';
import {
  buildPapersData,
  emptyLiveFetch,
  isPapersData,
  type LiveFetch,
  type PapersConfig,
  type S2Paper,
  type SeedOverrides,
} from '../src/lib/papers/normalize';

// This runs in Node.js at build time. It lists the papers that cite the core MEDS papers ("seeds") configured in
// static/data/papers.yaml, using Semantic Scholar's citation graph, and exposes them to the papers page as plugin
// global data, so visitors make no API calls.
//
// Semantic Scholar rate-limits unauthenticated requests heavily, so requests are made one at a time, 429s and
// 5xx responses are retried with backoff, and anything that can't be fetched is filled in from the committed
// snapshot (static/data/papers.snapshot.json). A failed fetch never fails the build.

export const PAPERS_YAML = path.join('static', 'data', 'papers.yaml');
export const PAPERS_SNAPSHOT = path.join('static', 'data', 'papers.snapshot.json');

const S2_API = 'https://api.semanticscholar.org/graph/v1';
/** Only the fields the page renders. */
export const S2_FIELDS =
  'title,year,venue,publicationVenue,authors,externalIds,url,citationCount,publicationDate';
/** The largest page the citations endpoint allows. */
const CITATIONS_PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const PAPER_ID = /^[0-9a-f]{40}$/;
const IDENTIFIER = /^(?:([0-9a-f]{40})|(doi|arxiv):(\S+))$/i;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface S2ClientOptions {
  /** Sent as `x-api-key`; raises the rate limit from a shared pool to a dedicated 1 request/second. */
  apiKey?: string;
  fetchFn?: FetchFn;
  /** Minimum time between the starts of consecutive requests. */
  minIntervalMs?: number;
  /** How often a request is retried after HTTP 429 or 5xx. */
  maxRetries?: number;
  /** Delay before the first retry when the response has no Retry-After header; doubles on each retry. */
  baseDelayMs?: number;
  /** Total time all requests may take, waits included; once it is used up, remaining requests fail at once. */
  budgetMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export const DEFAULT_CLIENT_OPTIONS = {
  minIntervalMs: 1100,
  maxRetries: 5,
  baseDelayMs: 2000,
  budgetMs: 120_000,
} as const;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Parses a Retry-After header (seconds or an HTTP date) into a delay in milliseconds. */
export function retryAfterMs(header: string | null, now: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

export type S2Request = <T>(pathAndQuery: string, body?: unknown) => Promise<T>;

/**
 * Returns a function that sends a request to the Semantic Scholar Graph API (a POST if `body` is given) and
 * returns the parsed JSON. Callers should await each request before sending the next: requests are spaced at
 * least `minIntervalMs` apart, and retried on HTTP 429 and 5xx with exponential backoff, honouring Retry-After.
 * Throws once a request fails for good or the time budget is used up.
 */
export function createS2Client(options: S2ClientOptions): S2Request {
  const {
    apiKey,
    fetchFn = fetch,
    minIntervalMs,
    maxRetries,
    baseDelayMs,
    budgetMs,
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    now = Date.now,
  } = { ...DEFAULT_CLIENT_OPTIONS, ...options };
  const deadline = now() + budgetMs;
  let lastStart = -Infinity;

  return async <T>(pathAndQuery: string, body?: unknown): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(0, lastStart + minIntervalMs - now());
      if (now() + wait >= deadline) throw new Error(`time budget of ${budgetMs / 1000}s used up`);
      if (wait > 0) await sleep(wait);
      lastStart = now();

      const res = await fetchFn(`${S2_API}${pathAndQuery}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'User-Agent': 'medical-event-data-standard.github.io',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, deadline - now())),
      });
      if (res.ok) return (await res.json()) as T;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new Error(`HTTP ${res.status}`);
      const delay = retryAfterMs(res.headers.get('retry-after'), now()) ?? baseDelayMs * 2 ** attempt;
      if (now() + delay >= deadline) {
        throw new Error(
          `HTTP ${res.status}, and retrying would exceed the time budget of ${budgetMs / 1000}s`
        );
      }
      await sleep(delay);
    }
  };
}

interface CitationsPage {
  next?: number;
  data?: { citingPaper?: S2Paper | null }[];
}

/**
 * Fetches the seeds' and included papers' details (one batch request), then every seed's citations. Never
 * throws: whatever fails is reported in `failures` and left out of (or marked incomplete in) `live`.
 */
export async function fetchFromSemanticScholar(
  config: PapersConfig,
  request: S2Request
): Promise<{ live: LiveFetch; failures: string[] }> {
  const live = emptyLiveFetch();
  const failures: string[] = [];

  const ids = [...config.seeds.map(seed => seed.id), ...config.include];
  try {
    const results = await request<(S2Paper | null)[]>(`/paper/batch?fields=${S2_FIELDS}`, { ids });
    ids.forEach((id, i) => {
      const paper = results[i];
      if (!paper) failures.push(`${id}: not found on Semantic Scholar`);
      else if (i < config.seeds.length) live.seeds.set(id, paper);
      else live.included.set(id, paper);
    });
  } catch (err) {
    failures.push(`details of the seed and included papers: ${errorMessage(err)}`);
  }

  for (const seed of config.seeds) {
    const citing: S2Paper[] = [];
    try {
      for (let offset: number | undefined = 0; offset !== undefined; ) {
        const page: CitationsPage = await request<CitationsPage>(
          `/paper/${seed.id}/citations?fields=${S2_FIELDS}&limit=${CITATIONS_PAGE_SIZE}&offset=${offset}`
        );
        for (const { citingPaper } of page.data ?? []) if (citingPaper) citing.push(citingPaper);
        offset = typeof page.next === 'number' && page.next > offset ? page.next : undefined;
      }
    } catch (err) {
      failures.push(`papers citing ${seed.label}: ${errorMessage(err)}`);
      live.incompleteSeeds.add(seed.id);
    }
    live.citations.set(seed.id, citing);
  }

  return { live, failures };
}

const identifierList = (value: unknown, key: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`\`${key}\` must be a list`);
  return value.map((entry, i) => {
    const id = typeof entry === 'string' ? entry : (entry as { id?: unknown } | null)?.id;
    const match = typeof id === 'string' ? IDENTIFIER.exec(id.trim()) : null;
    if (!match) {
      throw new Error(
        `\`${key}[${i}]\` must have an \`id\`: a Semantic Scholar paperId, \`DOI:<doi>\` or \`ARXIV:<id>\``
      );
    }
    // Semantic Scholar expects upper-case prefixes and arXiv ids without a version.
    const [, paperId, prefix, value] = match;
    if (paperId) return paperId.toLowerCase();
    return prefix.toUpperCase() === 'DOI' ? `DOI:${value}` : `ARXIV:${value.replace(/v\d+$/, '')}`;
  });
};

/**
 * Parses a seed's optional `title`, `authors`, `venue`, `year` and `url`, shown instead of Semantic Scholar's, and
 * allows a `note` for reviewers.
 */
function parseSeedOverrides(fields: Record<string, unknown>, where: string): SeedOverrides | undefined {
  const overrides: SeedOverrides = {};
  for (const [key, value] of Object.entries(fields)) {
    const invalid = (expected: string) => new Error(`\`${where}.${key}\` must be ${expected}`);
    if (key === 'title' || key === 'venue' || key === 'url') {
      if (typeof value !== 'string' || !value.trim()) throw invalid('a non-empty string');
      overrides[key] = value.trim();
    } else if (key === 'year') {
      if (!Number.isInteger(value)) throw invalid('a whole number');
      overrides.year = value as number;
    } else if (key === 'authors') {
      if (!Array.isArray(value) || !value.every(name => typeof name === 'string' && name.trim())) {
        throw invalid('a list of names');
      }
      overrides.authors = value.map(name => name.trim());
    } else if (key !== 'note') {
      throw new Error(`\`${where}\` has an unknown field \`${key}\``);
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/** Validates the parsed papers.yaml. A malformed file is a mistake in the repository, so this throws. */
export function parsePapersConfig(raw: unknown): PapersConfig {
  try {
    const { seeds, include, exclude } = (raw ?? {}) as Record<string, unknown>;
    if (!Array.isArray(seeds) || seeds.length === 0) throw new Error('`seeds` must be a non-empty list');
    return {
      seeds: seeds.map((seed, i) => {
        const { id, label, ...rest } = (seed ?? {}) as Record<string, unknown>;
        if (typeof id !== 'string' || !PAPER_ID.test(id.trim())) {
          throw new Error(`\`seeds[${i}].id\` must be a Semantic Scholar paperId (40 hex characters)`);
        }
        if (typeof label !== 'string' || !label.trim()) throw new Error(`\`seeds[${i}].label\` must be set`);
        const overrides = parseSeedOverrides(rest, `seeds[${i}]`);
        return { id: id.trim(), label: label.trim(), ...(overrides ? { overrides } : {}) };
      }),
      include: identifierList(include, 'include'),
      exclude: identifierList(exclude, 'exclude'),
    };
  } catch (err) {
    throw new Error(`Invalid ${PAPERS_YAML}: ${errorMessage(err)}`);
  }
}

/** Reads the snapshot, returning null (with the reason) if it is missing or malformed. */
export async function readSnapshot(file: string): Promise<{ snapshot: PapersData | null; problem?: string }> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (isPapersData(parsed)) return { snapshot: parsed };
    return { snapshot: null, problem: 'it is not in the expected format' };
  } catch (err) {
    const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
    return {
      snapshot: null,
      problem: missing ? 'it does not exist' : `it could not be read: ${errorMessage(err)}`,
    };
  }
}

/**
 * Where the data comes from: `PAPERS_SOURCE=live` or `snapshot` if set; otherwise a live fetch for production
 * builds, and the snapshot for the dev server (`npm start`), so starting it doesn't wait on rate-limit retries.
 */
export function papersSource(env: NodeJS.ProcessEnv): 'live' | 'snapshot' {
  const source = env.PAPERS_SOURCE?.trim().toLowerCase();
  if (source === 'live' || source === 'snapshot') return source;
  return env.NODE_ENV === 'production' ? 'live' : 'snapshot';
}

export interface LoadPapersOptions {
  env?: NodeJS.ProcessEnv;
  /** Overrides for the Semantic Scholar client, e.g. a mocked `fetchFn` or a longer `budgetMs`. */
  client?: S2ClientOptions;
  /** Forces a live fetch (or not), regardless of `papersSource`. */
  source?: 'live' | 'snapshot';
  now?: () => Date;
}

export interface LoadPapersResult {
  data: PapersData;
  /** True if something went wrong: a live fetch was incomplete, or the snapshot lacked something. */
  warning: boolean;
  /** Human-readable summary, logged by the plugin and the update script. */
  message: string;
}

/** Loads papers.yaml, fetches from Semantic Scholar (unless using the snapshot) and merges in the snapshot. */
export async function loadPapers(
  siteDir: string,
  options: LoadPapersOptions = {}
): Promise<LoadPapersResult> {
  const { env = process.env, client = {}, now = () => new Date() } = options;
  const source = options.source ?? papersSource(env);
  const config = parsePapersConfig(parse(await fs.readFile(path.join(siteDir, PAPERS_YAML), 'utf8')));
  const { snapshot, problem } = await readSnapshot(path.join(siteDir, PAPERS_SNAPSHOT));

  const apiKey = env.SEMANTIC_SCHOLAR_API_KEY?.trim() || undefined;
  const { live, failures } =
    source === 'live'
      ? await fetchFromSemanticScholar(config, createS2Client({ apiKey, ...client }))
      : { live: emptyLiveFetch(), failures: [] };
  const { seeds, papers, fromSnapshot, missing } = buildPapersData(config, live, snapshot);

  // The list is as fresh as its oldest part: if any seed's citations came from the snapshot, so does the date.
  const fresh = config.seeds.every(({ id }) => live.citations.has(id) && !live.incompleteSeeds.has(id));
  const data: PapersData = {
    updatedAt: fresh ? now().toISOString() : (snapshot?.updatedAt ?? null),
    seeds,
    papers,
  };

  const summary = `${papers.length} papers citing ${seeds.length} MEDS papers`;
  let message: string;
  let warning = false;
  if (source === 'live' && failures.length === 0 && fromSnapshot.length === 0 && missing.length === 0) {
    message = `Fetched ${summary} from Semantic Scholar.`;
  } else if (source === 'snapshot' && missing.length === 0) {
    message =
      `Using the snapshot from ${data.updatedAt} (${summary}). ` +
      'Set PAPERS_SOURCE=live to fetch from Semantic Scholar instead.';
  } else {
    warning = true;
    const lines = [
      ...failures,
      ...(fromSnapshot.length ? [`Taken from the snapshot instead: ${fromSnapshot.join('; ')}.`] : []),
      ...(missing.length ? [`Missing (not in the snapshot either): ${missing.join('; ')}.`] : []),
      ...(problem ? [`Snapshot ${PAPERS_SNAPSHOT} unavailable: ${problem}.`] : []),
    ];
    message =
      `${source === 'live' ? 'Could not fetch everything from Semantic Scholar' : 'Using the snapshot'}; ` +
      `the papers page lists ${summary}, as of ${data.updatedAt ?? 'never'}:\n  ${lines.join('\n  ')}` +
      (source === 'live' && !apiKey
        ? '\nSEMANTIC_SCHOLAR_API_KEY is not set, so requests were unauthenticated and are often rate-limited.'
        : '');
  }
  return { data, warning, message };
}

/** Refreshes the committed snapshot from Semantic Scholar (`npm run papers:update`). */
export async function updatePapersSnapshot(
  siteDir: string,
  options: LoadPapersOptions = {}
): Promise<LoadPapersResult> {
  const result = await loadPapers(siteDir, {
    ...options,
    source: 'live',
    // Nobody is waiting on a build here, so allow for more rate-limit retries.
    client: { budgetMs: 600_000, maxRetries: 8, ...options.client },
  });
  await fs.writeFile(path.join(siteDir, PAPERS_SNAPSHOT), `${JSON.stringify(result.data, null, 2)}\n`);
  return result;
}

// Typed as `Plugin` (i.e. `Plugin<unknown>`) because that is what Docusaurus accepts for plugins listed in the config.
export default function papersPlugin(context: LoadContext): Plugin {
  return {
    name: PAPERS_PLUGIN,

    getPathsToWatch() {
      return [path.join(context.siteDir, PAPERS_YAML), path.join(context.siteDir, PAPERS_SNAPSHOT)];
    },

    async loadContent(): Promise<PapersData> {
      const { data, warning, message } = await loadPapers(context.siteDir);
      if (warning) console.warn(`[${PAPERS_PLUGIN}] ${message}`);
      else console.info(`[${PAPERS_PLUGIN}] ${message}`);
      return data;
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
