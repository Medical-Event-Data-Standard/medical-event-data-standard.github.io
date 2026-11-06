import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import type { LoadContext, Plugin } from '@docusaurus/types';
import type { EcosystemMetadata } from '../src/lib/ecosystem/types';
import { ECOSYSTEM_METADATA_PLUGIN, repoKey } from '../src/lib/ecosystem/githubMetadata';

// This runs in Node.js at build time (and on `npm start`). It fetches GitHub metadata for every package in
// the ecosystem YAML once, and exposes it to the site as plugin global data.
//
// Fetching here rather than in each visitor's browser matters: unauthenticated GitHub API calls are limited to
// 60/hour per IP, and the ecosystem page needs ~2 calls per repository, so browsers ran out partway through
// and many cards showed no stars. At build time we can authenticate with GITHUB_TOKEN instead.

const ECOSYSTEM_YAML = path.join('static', 'data', 'ecosystem.yaml');
const GITHUB_API = 'https://api.github.com';
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface GitHubRepoResponse {
  stargazers_count?: number;
  updated_at?: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
}

export interface FetchMetadataResult {
  metadata: EcosystemMetadata;
  /** Human-readable descriptions of requests that failed (other than "no release", which is expected). */
  failures: string[];
}

/** Collects every `github_repo` value in the parsed ecosystem YAML, de-duplicated case-insensitively. */
export function collectGithubRepos(node: unknown): string[] {
  const repos = new Map<string, string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'github_repo') {
        if (typeof child === 'string' && child.trim() && !repos.has(repoKey(child))) {
          repos.set(repoKey(child), child.trim());
        }
      } else {
        visit(child);
      }
    }
  };
  visit(node);
  return [...repos.values()];
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      await fn(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Fetches star counts, last-updated times and latest release tags for the given `owner/repo` names.
 *
 * Never throws: a repository whose info cannot be fetched is left out of the result (so its card shows no
 * stars) and reported in `failures`. Repository info is fetched for every repository before any releases, so
 * that if a rate limit is hit, it is the star counts that made it through.
 */
export async function fetchEcosystemMetadata(
  repos: string[],
  { token, fetchFn = fetch }: { token?: string; fetchFn?: FetchFn } = {}
): Promise<FetchMetadataResult> {
  const metadata: EcosystemMetadata = {};
  const failures: string[] = [];

  const get = (url: string): Promise<Response> =>
    fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'medical-event-data-standard.github.io',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  await mapWithConcurrency(repos, CONCURRENCY, async repo => {
    try {
      const res = await get(`${GITHUB_API}/repos/${repo}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GitHubRepoResponse;
      metadata[repoKey(repo)] = {
        stars: typeof data.stargazers_count === 'number' ? data.stargazers_count : null,
        lastUpdated: data.updated_at ?? null,
        release: null,
      };
    } catch (err) {
      failures.push(`${repo}: ${errorMessage(err)}`);
    }
  });

  const fetchedRepos = repos.filter(repo => metadata[repoKey(repo)]);
  await mapWithConcurrency(fetchedRepos, CONCURRENCY, async repo => {
    try {
      const res = await get(`${GITHUB_API}/repos/${repo}/releases/latest`);
      if (res.status === 404) return; // The repository has no published release.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GitHubReleaseResponse;
      metadata[repoKey(repo)].release = data.tag_name ?? null;
    } catch (err) {
      failures.push(`${repo} (latest release): ${errorMessage(err)}`);
    }
  });

  return { metadata, failures };
}

// Typed as `Plugin` (i.e. `Plugin<unknown>`) because that is what Docusaurus accepts for plugins listed in the config.
export default function ecosystemMetadataPlugin(context: LoadContext): Plugin {
  const yamlPath = path.join(context.siteDir, ECOSYSTEM_YAML);

  return {
    name: ECOSYSTEM_METADATA_PLUGIN,

    getPathsToWatch() {
      return [yamlPath];
    },

    async loadContent(): Promise<EcosystemMetadata> {
      const repos = collectGithubRepos(parse(await fs.readFile(yamlPath, 'utf8')));
      const token = process.env.GITHUB_TOKEN || undefined;
      const { metadata, failures } = await fetchEcosystemMetadata(repos, { token });

      const fetched = Object.keys(metadata).length;
      if (failures.length === 0) {
        console.info(
          `[${ECOSYSTEM_METADATA_PLUGIN}] Fetched GitHub metadata for ${fetched}/${repos.length} repos.`
        );
      } else {
        console.warn(
          `[${ECOSYSTEM_METADATA_PLUGIN}] Fetched GitHub metadata for ${fetched}/${repos.length} repos; ` +
            `${failures.length} request(s) failed, so some ecosystem cards will be missing stars/releases:\n  ` +
            failures.join('\n  ') +
            (token
              ? ''
              : '\nGITHUB_TOKEN is not set, so these requests were unauthenticated (60/hour limit). ' +
                'Try e.g. `GITHUB_TOKEN=$(gh auth token) npm start`.')
        );
      }
      return metadata;
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
