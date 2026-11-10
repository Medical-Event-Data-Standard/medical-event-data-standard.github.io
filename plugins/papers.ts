import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { PAPERS_PLUGIN, type Paper, type PapersData, type PapersPageData } from '../src/lib/papers/types';
import {
  attachInstitutions,
  buildPapersData,
  doiFromUrl,
  emptyLiveFetch,
  ICON_EXTENSIONS,
  iconExtension,
  iconLinks,
  institutionIconSlug,
  institutionRenamer,
  institutionRecordsOfWork,
  institutionsOfWork,
  isPapersData,
  isSameWork,
  normalizeText,
  openAlexDoi,
  paperMatchesId,
  renameInstitutions,
  type LiveFetch,
  type OpenAlexWork,
  type PaperOverrides,
  type PapersConfig,
  type S2Paper,
} from '../src/lib/papers/normalize';

// This runs in Node.js at build time. It lists the papers that cite the core MEDS papers ("seeds") configured in
// static/data/papers.yaml, using Semantic Scholar's citation graph, looks up their authors' institutions on
// OpenAlex, and exposes them to the papers page as plugin global data, so visitors make no API calls.
//
// Semantic Scholar rate-limits unauthenticated requests heavily, so requests are made one at a time, 429s and
// 5xx responses are retried with backoff, and anything that can't be fetched is filled in from the committed
// snapshot (static/data/papers.snapshot.json). A failed fetch never fails the build.

export const PAPERS_YAML = path.join('static', 'data', 'papers.yaml');
export const PAPERS_SNAPSHOT = path.join('static', 'data', 'papers.snapshot.json');
/** Committed icons of the institutions, named by `institutionIconSlug`; `npm run papers:update` refreshes them. */
export const INSTITUTION_ICONS_DIR = path.join('static', 'img', 'institutions');
/** Where the icons are served. */
export const INSTITUTION_ICONS_URL = '/img/institutions';

const S2_API = 'https://api.semanticscholar.org/graph/v1';
/** Only the fields the page renders. */
export const S2_FIELDS = 'title,year,venue,publicationVenue,authors,externalIds,url,publicationDate';
const OPENALEX_API = 'https://api.openalex.org';
/** The fields used to find a paper's institutions. */
export const OPENALEX_FIELDS = 'doi,title,authorships';
/** DOIs looked up per OpenAlex request (OpenAlex allows up to 100 values in one filter). */
const OPENALEX_BATCH_SIZE = 50;
/**
 * Services that return a website's icon, or HTTP 404 if they have none, tried in this order: Google's (an image
 * of up to 64 pixels), then DuckDuckGo's.
 */
export const FAVICON_SERVICES = [
  (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
  (host: string) => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
];
const USER_AGENT = 'medical-event-data-standard.github.io';
/** The largest page the citations endpoint allows. */
const CITATIONS_PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const PAPER_ID = /^[0-9a-f]{40}$/;
const IDENTIFIER = /^(?:([0-9a-f]{40})|(doi|arxiv):(\S+))$/i;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Defaults to the Semantic Scholar Graph API. */
  baseUrl?: string;
  /** Sent as `x-api-key`; for Semantic Scholar, raises the rate limit from a shared pool to 1 request/second. */
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

/** OpenAlex allows 10 requests a second, and the lookups are few, so less waiting is needed. */
export const OPENALEX_CLIENT_OPTIONS = {
  baseUrl: OPENALEX_API,
  minIntervalMs: 150,
  maxRetries: 3,
  baseDelayMs: 1000,
  budgetMs: 60_000,
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

export type ApiRequest = <T>(pathAndQuery: string, body?: unknown) => Promise<T>;

/**
 * Returns a function that sends a request to the Semantic Scholar Graph API, or the API at `baseUrl`, (a POST if
 * `body` is given) and returns the parsed JSON. Callers should await each request before sending the next: requests are spaced at
 * least `minIntervalMs` apart, and retried on HTTP 429 and 5xx with exponential backoff, honouring Retry-After.
 * Throws once a request fails for good or the time budget is used up.
 */
export function createApiClient(options: ApiClientOptions): ApiRequest {
  const {
    baseUrl = S2_API,
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

      const res = await fetchFn(`${baseUrl}${pathAndQuery}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'User-Agent': USER_AGENT,
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
  request: ApiRequest
): Promise<{ live: LiveFetch; failures: string[] }> {
  const live = emptyLiveFetch();
  const failures: string[] = [];

  const ids = [...config.seeds.map(seed => seed.id), ...config.include.map(include => include.id)];
  try {
    const results = await request<(S2Paper | null)[]>(`/paper/batch?fields=${S2_FIELDS}`, { ids });
    ids.forEach((id, i) => {
      const paper = results[i] ?? null;
      const include = i < config.seeds.length ? undefined : config.include[i - config.seeds.length];
      if (include) live.included.set(id, paper);
      else if (paper) live.seeds.set(id, paper);
      // An included paper with a title in papers.yaml is listed from its details there instead.
      if (!paper && !include?.overrides?.title) failures.push(`${id}: not found on Semantic Scholar`);
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

interface OpenAlexList {
  results?: OpenAlexWork[] | null;
}

/**
 * Looks up the institutions of the papers' authors on OpenAlex: by DOI (or arXiv's DOI), many papers per request,
 * then, for papers not found that way or without institutions there, by title, one request each. A title search
 * can find another record of the same paper, e.g. the published version of a preprint; it only counts if the
 * title is the same and an author's surname is shared. Never throws: returns the institutions of every paper whose
 * lookup finished (empty if OpenAlex has none), by paper id, the OpenAlex id of each institution found, by name,
 * and what failed.
 */
export async function fetchInstitutionsFromOpenAlex(
  papers: readonly Paper[],
  request: ApiRequest,
  apiKey?: string
): Promise<{ institutions: Map<string, string[]>; ids: Map<string, string>; failures: string[] }> {
  const institutions = new Map<string, string[]>();
  const ids = new Map<string, string>();
  const failures: string[] = [];
  const record = (paperId: string, work: OpenAlexWork | undefined): void => {
    const records = institutionRecordsOfWork(work);
    for (const { name, id } of records) if (id && !ids.has(name)) ids.set(name, id);
    institutions.set(
      paperId,
      records.map(({ name }) => name)
    );
  };
  const key = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  const search = async (filter: string, perPage: number): Promise<OpenAlexWork[]> =>
    (
      await request<OpenAlexList>(
        `/works?filter=${filter}&per_page=${perPage}&select=${OPENALEX_FIELDS}${key}`
      )
    ).results ?? [];

  // `|` separates values and `,` separates filters, so DOIs containing them are only looked up by title.
  const dois = [
    ...new Set(papers.map(openAlexDoi).filter((doi): doi is string => !!doi && !/[|,]/.test(doi))),
  ];
  const byDoi = new Map<string, OpenAlexWork>();
  const failedDois = new Set<string>();
  for (let start = 0; start < dois.length; start += OPENALEX_BATCH_SIZE) {
    const batch = dois.slice(start, start + OPENALEX_BATCH_SIZE);
    try {
      for (const work of await search(`doi:${batch.map(encodeURIComponent).join('|')}`, 100)) {
        const doi = doiFromUrl(work.doi);
        if (doi) byDoi.set(doi, work);
      }
    } catch (err) {
      failures.push(`institutions of ${batch.length} papers, by DOI: ${errorMessage(err)}`);
      batch.forEach(doi => failedDois.add(doi));
    }
  }

  const failedTitles: string[] = [];
  let titleError = '';
  for (const paper of papers) {
    const doi = openAlexDoi(paper);
    if (doi && failedDois.has(doi)) continue;
    const work = doi ? byDoi.get(doi) : undefined;
    if (institutionsOfWork(work).length > 0) {
      record(paper.id, work);
      continue;
    }
    try {
      const works = await search(`title.search:${encodeURIComponent(normalizeText(paper.title))}`, 5);
      record(
        paper.id,
        works.find(candidate => isSameWork(paper, candidate) && institutionsOfWork(candidate).length > 0)
      );
    } catch (err) {
      failedTitles.push(paper.id);
      titleError ||= errorMessage(err);
    }
  }
  if (failedTitles.length > 0) {
    failures.push(`institutions of ${failedTitles.length} papers, by title: ${titleError}`);
  }
  return { institutions, ids, failures };
}

/** Every institution of the papers, without duplicates. */
export const institutionNames = (data: PapersData): string[] => [
  ...new Set(data.papers.flatMap(paper => paper.institutions)),
];

/** The committed icon files, by slug (file name without extension). */
async function iconFiles(dir: string): Promise<Map<string, string>> {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  return new Map(
    files
      .filter(file => ICON_EXTENSIONS.includes(path.extname(file).slice(1)))
      .map(file => [file.slice(0, -path.extname(file).length), file])
  );
}

/** The committed icons of the given institutions, as URL paths by name; institutions without one are left out. */
export async function findInstitutionIcons(
  siteDir: string,
  names: readonly string[]
): Promise<Record<string, string>> {
  const files = await iconFiles(path.join(siteDir, INSTITUTION_ICONS_DIR));
  return Object.fromEntries(
    names.flatMap(name => {
      const file = files.get(institutionIconSlug(name));
      return file ? [[name, `${INSTITUTION_ICONS_URL}/${file}`]] : [];
    })
  );
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
};

/** The hosts to ask the favicon services about: the homepage's, then the same without `www.`. */
const hostsOf = (homepage: string): string[] => {
  const host = hostOf(homepage);
  if (!host) return [];
  return host.startsWith('www.') ? [host, host.slice(4)] : [host];
};

export interface InstitutionIconsResult {
  downloaded: number;
  /** Icons of institutions no longer listed, which were deleted. */
  removed: number;
  /** Institutions that have no icon, e.g. because no homepage is known for them or no icon was found. */
  without: number;
  failures: string[];
}

/** The largest web page read when looking for the icons it links to. */
const MAX_PAGE_BYTES = 2_000_000;

/**
 * Downloads an icon for every institution that has none in static/img/institutions yet, and deletes the icons of
 * institutions no longer listed. An institution's icon is its website's icon (favicon).
 *
 * Its homepage is the one given in papers.yaml (`homepages`, by name), else OpenAlex's: found by the institution's
 * OpenAlex id (`ids`, by name), or else by searching OpenAlex for an institution of exactly that name. The icon
 * comes from the first of `FAVICON_SERVICES` that has one, asking about the homepage's host with and without
 * `www.`, or else from the icons the homepage itself links to, or its `/favicon.ico`. Only PNG, JPEG, GIF, ICO and
 * script-free SVG images are kept. Institutions with no known homepage, or no icon, get none. Never throws.
 */
export async function updateInstitutionIcons(
  siteDir: string,
  names: readonly string[],
  ids: ReadonlyMap<string, string>,
  {
    openAlex,
    fetchFn = fetch,
    apiKey,
    homepages: configured = new Map(),
  }: { openAlex: ApiRequest; fetchFn?: FetchFn; apiKey?: string; homepages?: ReadonlyMap<string, string> }
): Promise<InstitutionIconsResult> {
  const dir = path.join(siteDir, INSTITUTION_ICONS_DIR);
  await fs.mkdir(dir, { recursive: true });
  const existing = await iconFiles(dir);
  const wanted = new Set(names.map(institutionIconSlug));
  const failures: string[] = [];

  let removed = 0;
  for (const [slug, file] of existing) {
    if (!wanted.has(slug)) {
      await fs.rm(path.join(dir, file));
      removed++;
    }
  }

  const missing = names.filter(name => !existing.has(institutionIconSlug(name)));
  const homepages = new Map(
    missing.flatMap(name => (configured.has(name) ? [[name, configured.get(name) as string]] : []))
  );
  const key = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
  type InstitutionRecord = { id?: string | null; display_name?: string | null; homepage_url?: string | null };
  const shortId = (id: string): string => id.replace(/^https?:\/\/openalex\.org\//i, '');

  // By OpenAlex id, many at a time.
  const byId = missing.filter(name => !homepages.has(name) && ids.has(name));
  const idList = [...new Set(byId.map(name => ids.get(name) as string))];
  const homepageById = new Map<string, string>();
  for (let start = 0; start < idList.length; start += OPENALEX_BATCH_SIZE) {
    const batch = idList.slice(start, start + OPENALEX_BATCH_SIZE);
    try {
      const { results } = await openAlex<{ results?: InstitutionRecord[] }>(
        `/institutions?filter=id:${batch.join('|')}&per_page=${OPENALEX_BATCH_SIZE}&select=id,homepage_url${key}`
      );
      for (const { id, homepage_url } of results ?? []) {
        if (id && homepage_url) homepageById.set(shortId(id), homepage_url);
      }
    } catch (err) {
      failures.push(`homepages of ${batch.length} institutions: ${errorMessage(err)}`);
    }
  }
  for (const name of byId) {
    const homepage = homepageById.get(ids.get(name) as string);
    if (homepage) homepages.set(name, homepage);
  }

  // By name, one at a time, for institutions without an OpenAlex id (e.g. those only in papers.yaml).
  for (const name of missing.filter(name => !homepages.has(name) && !ids.has(name))) {
    try {
      const { results } = await openAlex<{ results?: InstitutionRecord[] }>(
        `/institutions?filter=display_name.search:${encodeURIComponent(normalizeText(name))}&per_page=5` +
          `&select=id,display_name,homepage_url${key}`
      );
      const match = (results ?? []).find(
        record => normalizeText(record.display_name ?? '') === normalizeText(name) && record.homepage_url
      );
      if (match?.homepage_url) homepages.set(name, match.homepage_url);
    } catch (err) {
      failures.push(`homepage of ${name}: ${errorMessage(err)}`);
    }
  }

  const get = (url: string): Promise<Response> =>
    fetchFn(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  /** The image at `url`, if it is one an icon can be; else null. */
  const image = async (url: string): Promise<{ bytes: Uint8Array; extension: string } | null> => {
    const res = await get(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const extension = iconExtension(bytes);
    return extension ? { bytes, extension } : null;
  };
  /** The first icon found for the homepage, or null. */
  const fetchIcon = async (homepage: string): Promise<{ bytes: Uint8Array; extension: string } | null> => {
    const hosts = hostsOf(homepage);
    for (const service of FAVICON_SERVICES) {
      for (const host of hosts) {
        const icon = await image(service(host));
        if (icon) return icon;
      }
    }
    // Neither service has one: try the icons the homepage links to, then its /favicon.ico. A homepage that can't
    // be reached just has no icon. Its HTML is read whatever the status, as some sites answer scripts with a 404
    // page that still links to their icons.
    let html = '';
    let base = homepage;
    try {
      const page = await get(homepage);
      html = new TextDecoder().decode((await page.arrayBuffer()).slice(0, MAX_PAGE_BYTES));
      base = page.url || homepage;
    } catch {
      return null;
    }
    for (const url of [...iconLinks(html, base), new URL('/favicon.ico', base).href]) {
      const icon = await image(url).catch(() => null);
      if (icon) return icon;
    }
    return null;
  };

  let downloaded = 0;
  let failedIcons = 0;
  let iconError = '';
  for (const name of missing) {
    const homepage = homepages.get(name);
    if (!homepage || hostsOf(homepage).length === 0) continue;
    try {
      const icon = await fetchIcon(homepage);
      if (!icon) continue;
      await fs.writeFile(path.join(dir, `${institutionIconSlug(name)}.${icon.extension}`), icon.bytes);
      downloaded++;
    } catch (err) {
      failedIcons++;
      iconError ||= errorMessage(err);
    }
  }
  if (failedIcons > 0) failures.push(`icons of ${failedIcons} institutions: ${iconError}`);

  const kept = [...wanted].filter(slug => existing.has(slug)).length;
  return { downloaded, removed, without: wanted.size - kept - downloaded, failures };
}

/**
 * Parses an `include` or `exclude` list, of identifiers or `{ id, ... }` entries, into `[identifier, fields]`
 * pairs: the normalised identifier, and the entry's other fields.
 */
const identifierList = (value: unknown, key: string): [string, Record<string, unknown>][] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`\`${key}\` must be a list`);
  return value.map((entry, i) => {
    const entryFields = typeof entry === 'string' ? { id: entry } : (entry ?? {});
    const { id, ...fields } = entryFields as Record<string, unknown>;
    const match = typeof id === 'string' ? IDENTIFIER.exec(id.trim()) : null;
    if (!match) {
      throw new Error(
        `\`${key}[${i}]\` must have an \`id\`: a Semantic Scholar paperId, \`DOI:<doi>\` or \`ARXIV:<id>\``
      );
    }
    // Semantic Scholar expects upper-case prefixes and arXiv ids without a version.
    const [, paperId, prefix, value] = match;
    if (paperId) return [paperId.toLowerCase(), fields];
    return [prefix.toUpperCase() === 'DOI' ? `DOI:${value}` : `ARXIV:${value.replace(/v\d+$/, '')}`, fields];
  });
};

/**
 * Parses a seed's or included paper's optional `title`, `authors`, `venue`, `year` and `url`, shown instead of
 * Semantic Scholar's, and allows a `note` for reviewers.
 */
function parseOverrides(fields: Record<string, unknown>, where: string): PaperOverrides | undefined {
  const overrides: PaperOverrides = {};
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

/** Parses the `affiliations` list: each entry's `id`, its `institutions`, and an optional `note` for reviewers. */
const affiliationList = (value: unknown): PapersConfig['affiliations'] =>
  identifierList(value, 'affiliations').map(([id, fields], i) => {
    const unknown = Object.keys(fields).find(key => key !== 'institutions' && key !== 'note');
    if (unknown) throw new Error(`\`affiliations[${i}]\` has an unknown field \`${unknown}\``);
    const { institutions } = fields;
    if (
      !Array.isArray(institutions) ||
      institutions.length === 0 ||
      !institutions.every(name => typeof name === 'string' && name.trim())
    ) {
      throw new Error(`\`affiliations[${i}].institutions\` must be a non-empty list of names`);
    }
    return { id, institutions: [...new Set(institutions.map(name => (name as string).trim()))] };
  });

/** Parses the `institutions` list: each entry's `name`, and its `rename` and/or `homepage`. */
const institutionList = (value: unknown): PapersConfig['institutions'] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('`institutions` must be a list');
  return value.map((entry, i) => {
    const where = `institutions[${i}]`;
    const fields = (entry ?? {}) as Record<string, unknown>;
    const unknown = Object.keys(fields).find(key => !['name', 'rename', 'homepage', 'note'].includes(key));
    if (unknown) throw new Error(`\`${where}\` has an unknown field \`${unknown}\``);
    const { name, rename, homepage } = fields;
    const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
    if (!text(name)) throw new Error(`\`${where}.name\` must be a non-empty string`);
    if (rename !== undefined && !text(rename))
      throw new Error(`\`${where}.rename\` must be a non-empty string`);
    if (homepage !== undefined && !(text(homepage) && /^https?:\/\/\S+$/i.test(homepage.trim()))) {
      throw new Error(`\`${where}.homepage\` must be an http(s) URL`);
    }
    if (rename === undefined && homepage === undefined) {
      throw new Error(`\`${where}\` must set \`rename\` or \`homepage\``);
    }
    return {
      name: name.trim(),
      ...(text(rename) ? { rename: rename.trim() } : {}),
      ...(text(homepage) ? { homepage: homepage.trim() } : {}),
    };
  });
};

/** Validates the parsed papers.yaml. A malformed file is a mistake in the repository, so this throws. */
export function parsePapersConfig(raw: unknown): PapersConfig {
  try {
    const { seeds, include, exclude, affiliations, institutions } = (raw ?? {}) as Record<string, unknown>;
    if (!Array.isArray(seeds) || seeds.length === 0) throw new Error('`seeds` must be a non-empty list');
    return {
      seeds: seeds.map((seed, i) => {
        const { id, label, ...rest } = (seed ?? {}) as Record<string, unknown>;
        if (typeof id !== 'string' || !PAPER_ID.test(id.trim())) {
          throw new Error(`\`seeds[${i}].id\` must be a Semantic Scholar paperId (40 hex characters)`);
        }
        if (typeof label !== 'string' || !label.trim()) throw new Error(`\`seeds[${i}].label\` must be set`);
        const overrides = parseOverrides(rest, `seeds[${i}]`);
        return { id: id.trim(), label: label.trim(), ...(overrides ? { overrides } : {}) };
      }),
      include: identifierList(include, 'include').map(([id, fields], i) => {
        const overrides = parseOverrides(fields, `include[${i}]`);
        return { id, ...(overrides ? { overrides } : {}) };
      }),
      exclude: identifierList(exclude, 'exclude').map(([id]) => id),
      affiliations: affiliationList(affiliations),
      institutions: institutionList(institutions),
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
  /** Overrides for the Semantic Scholar and OpenAlex clients, e.g. a mocked `fetchFn` or a longer `budgetMs`. */
  client?: ApiClientOptions;
  /** Forces a live fetch (or not), regardless of `papersSource`. */
  source?: 'live' | 'snapshot';
  now?: () => Date;
}

export interface LoadPapersResult {
  data: PapersData;
  /** OpenAlex id of each institution found on OpenAlex, by (shown) name; empty unless fetched live. */
  institutionIds: Map<string, string>;
  /** Homepages of institutions set in papers.yaml, by (shown) name. */
  institutionHomepages: Map<string, string>;
  /** True if something went wrong: a live fetch was incomplete, or the snapshot lacked something. */
  warning: boolean;
  /** Human-readable summary, logged by the plugin and the update script. */
  message: string;
}

/**
 * Loads papers.yaml, fetches the papers from Semantic Scholar and their institutions from OpenAlex (unless using
 * the snapshot), and merges in the snapshot.
 */
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
      ? await fetchFromSemanticScholar(config, createApiClient({ apiKey, ...client }))
      : { live: emptyLiveFetch(), failures: [] };
  const built = buildPapersData(config, live, snapshot);
  const { seeds, missing } = built;
  const s2Complete = failures.length === 0 && built.fromSnapshot.length === 0 && missing.length === 0;

  // Papers with institutions in papers.yaml aren't looked up.
  const toLookUp = built.papers.filter(
    paper => !config.affiliations.some(({ id }) => paperMatchesId(paper, id))
  );
  const openAlex =
    source === 'live'
      ? await fetchInstitutionsFromOpenAlex(
          toLookUp,
          createApiClient({ ...OPENALEX_CLIENT_OPTIONS, ...client }),
          env.OPENALEX_API_KEY?.trim() || undefined
        )
      : { institutions: new Map<string, string[]>(), ids: new Map<string, string>(), failures: [] };
  const { papers: attached, notFetched } = attachInstitutions(
    built.papers,
    config.affiliations,
    openAlex.institutions,
    snapshot
  );
  const papers = renameInstitutions(attached, config.institutions);
  const rename = institutionRenamer(config.institutions);
  const fromSnapshot = [
    ...built.fromSnapshot,
    ...(source === 'live' && notFetched > 0 ? [`institutions of ${notFetched} papers`] : []),
  ];

  // The list is as fresh as its oldest part: if any seed's citations came from the snapshot, so does the date.
  const fresh = config.seeds.every(({ id }) => live.citations.has(id) && !live.incompleteSeeds.has(id));
  const data: PapersData = {
    updatedAt: fresh ? now().toISOString() : (snapshot?.updatedAt ?? null),
    seeds,
    papers,
  };

  const summary = `${papers.length} papers citing ${seeds.length} MEDS papers`;
  const allFailures = [...failures, ...openAlex.failures];
  let message: string;
  let warning = false;
  if (source === 'live' && allFailures.length === 0 && fromSnapshot.length === 0 && missing.length === 0) {
    message = `Fetched ${summary} from Semantic Scholar, and their institutions from OpenAlex.`;
  } else if (source === 'snapshot' && missing.length === 0) {
    message =
      `Using the snapshot from ${data.updatedAt} (${summary}). ` +
      'Set PAPERS_SOURCE=live to fetch from Semantic Scholar and OpenAlex instead.';
  } else {
    warning = true;
    const failedSources = [
      ...(s2Complete ? [] : ['Semantic Scholar']),
      ...(openAlex.failures.length > 0 ? ['OpenAlex'] : []),
    ];
    const lines = [
      ...allFailures,
      ...(fromSnapshot.length ? [`Taken from the snapshot instead: ${fromSnapshot.join('; ')}.`] : []),
      ...(missing.length ? [`Missing (not in the snapshot either): ${missing.join('; ')}.`] : []),
      ...(problem ? [`Snapshot ${PAPERS_SNAPSHOT} unavailable: ${problem}.`] : []),
    ];
    message =
      `${source === 'live' ? `Could not fetch everything from ${failedSources.join(' or ')}` : 'Using the snapshot'}; ` +
      `the papers page lists ${summary}, as of ${data.updatedAt ?? 'never'}:\n  ${lines.join('\n  ')}` +
      (source === 'live' && !s2Complete && !apiKey
        ? '\nSEMANTIC_SCHOLAR_API_KEY is not set, so requests were unauthenticated and are often rate-limited.'
        : '');
  }
  return {
    data,
    institutionIds: new Map([...openAlex.ids].map(([name, id]) => [rename(name), id])),
    institutionHomepages: new Map(
      config.institutions.flatMap(({ name, homepage }) => (homepage ? [[rename(name), homepage]] : []))
    ),
    warning,
    message,
  };
}

/**
 * Refreshes the committed snapshot from Semantic Scholar and OpenAlex, and the institutions' icons
 * (`npm run papers:update`).
 */
export async function updatePapersSnapshot(
  siteDir: string,
  options: LoadPapersOptions = {}
): Promise<LoadPapersResult> {
  // Nobody is waiting on a build here, so allow for more rate-limit retries.
  const client = { budgetMs: 600_000, maxRetries: 8, ...options.client };
  const result = await loadPapers(siteDir, { ...options, source: 'live', client });
  await fs.writeFile(path.join(siteDir, PAPERS_SNAPSHOT), `${JSON.stringify(result.data, null, 2)}\n`);

  const icons = await updateInstitutionIcons(siteDir, institutionNames(result.data), result.institutionIds, {
    openAlex: createApiClient({ ...OPENALEX_CLIENT_OPTIONS, ...client }),
    fetchFn: client.fetchFn,
    homepages: result.institutionHomepages,
    apiKey: (options.env ?? process.env).OPENALEX_API_KEY?.trim() || undefined,
  });
  const iconSummary =
    `Institution icons: ${icons.downloaded} downloaded, ${icons.removed} removed; ` +
    `${icons.without} institutions have none.`;
  return {
    ...result,
    warning: result.warning || icons.failures.length > 0,
    message: [result.message, iconSummary, ...icons.failures.map(failure => `  ${failure}`)].join('\n'),
  };
}

// Typed as `Plugin` (i.e. `Plugin<unknown>`) because that is what Docusaurus accepts for plugins listed in the config.
export default function papersPlugin(context: LoadContext): Plugin {
  return {
    name: PAPERS_PLUGIN,

    getPathsToWatch() {
      return [
        path.join(context.siteDir, PAPERS_YAML),
        path.join(context.siteDir, PAPERS_SNAPSHOT),
        path.join(context.siteDir, INSTITUTION_ICONS_DIR),
      ];
    },

    async loadContent(): Promise<PapersPageData> {
      const { data, warning, message } = await loadPapers(context.siteDir);
      if (warning) console.warn(`[${PAPERS_PLUGIN}] ${message}`);
      else console.info(`[${PAPERS_PLUGIN}] ${message}`);
      return {
        ...data,
        institutionIcons: await findInstitutionIcons(context.siteDir, institutionNames(data)),
      };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
