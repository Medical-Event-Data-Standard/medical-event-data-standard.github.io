import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import type { LoadContext, Plugin } from '@docusaurus/types';
import type { EcosystemMetadata, EcosystemPluginData } from '../src/lib/ecosystem/types';
import {
  ECOSYSTEM_LOGOS_PATH,
  ECOSYSTEM_METADATA_PLUGIN,
  ownerKey,
  repoKey,
} from '../src/lib/ecosystem/githubMetadata';

// This runs in Node.js at build time (and on `npm start`). It fetches GitHub metadata for every package in
// the ecosystem YAML once, and exposes it to the site as plugin global data, with the logos of the packages'
// GitHub owners.
//
// Fetching here rather than in each visitor's browser matters: unauthenticated GitHub API calls are limited to
// 60/hour per IP, and the ecosystem page needs ~2 calls per repository, so browsers ran out partway through
// and many cards showed no stars. At build time we can authenticate with GITHUB_TOKEN instead.
//
// The logos are the owners' GitHub avatars. Each owner's account type and avatar URL come with its repositories'
// details, so they cost no extra API requests; the avatars themselves are downloaded into static/img/ecosystem-logos
// (which git ignores) and served by the site like any other static file, so visitors make no requests to GitHub.

export const ECOSYSTEM_YAML = path.join('static', 'data', 'ecosystem.yaml');
/** The downloaded logos of the packages' GitHub owners, named by `ownerKey`, e.g. `som-shahlab.png`. */
export const LOGOS_DIR = path.join('static', ...ECOSYSTEM_LOGOS_PATH.split('/'));
const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'medical-event-data-standard.github.io';
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;

/**
 * Whether a package whose repository belongs to a personal GitHub account, rather than an organization, gets that
 * account's avatar as its logo. Such avatars are often photos of people, so while this is false those packages
 * show the MEDS logo. A change takes effect at the next build, or when the dev server starts.
 */
export const PERSONAL_ACCOUNT_LOGOS = false;

/** The width and height, in pixels, at which logos are downloaded: twice the size at which the cards show them. */
export const LOGO_SIZE = 64;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface GitHubRepoResponse {
  stargazers_count?: number;
  updated_at?: string;
  owner?: {
    login?: string;
    /** `User` or `Organization`. */
    type?: string;
    avatar_url?: string;
  } | null;
}

interface GitHubReleaseResponse {
  tag_name?: string;
}

/** A repository's owner, as its details on GitHub give it. */
export interface GitHubOwner {
  login: string;
  /** `User` or `Organization`. */
  type: string | null;
  avatarUrl: string | null;
}

export interface FetchMetadataResult {
  metadata: EcosystemMetadata;
  /** The owners of the repositories whose details were fetched, by `ownerKey`. */
  owners: Map<string, GitHubOwner>;
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

/** Requests `url` from the GitHub API, authenticated with `token` if one is given. */
function githubApiGet(url: string, token: string | undefined, fetchFn: FetchFn): Promise<Response> {
  return fetchFn(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
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
  const owners = new Map<string, GitHubOwner>();
  const failures: string[] = [];
  const get = (url: string): Promise<Response> => githubApiGet(url, token, fetchFn);

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
      if (!owners.has(ownerKey(repo))) {
        owners.set(ownerKey(repo), {
          login: data.owner?.login ?? repo.trim().split('/')[0],
          type: data.owner?.type ?? null,
          avatarUrl: data.owner?.avatar_url ?? null,
        });
      }
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

  return { metadata, owners, failures };
}

const IMAGE_SIGNATURES: [string, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46, 0x38]],
];

/** The file extensions a logo can have. */
export const LOGO_EXTENSIONS = IMAGE_SIGNATURES.map(([extension]) => extension);

/** The extension of the image type of `bytes`, judged by its first bytes, if it is PNG, JPEG or GIF; else null. */
export function logoExtension(bytes: Uint8Array): string | null {
  const match = IMAGE_SIGNATURES.find(([, signature]) => signature.every((byte, i) => bytes[i] === byte));
  return match ? match[0] : null;
}

/**
 * Whether `bytes`, an avatar requested at `size` pixels, is the identicon (a pattern of squares) that GitHub
 * generates for accounts without an uploaded avatar. GitHub returns uploaded avatars at the requested size, but
 * identicons as PNGs of 420 by 420 pixels whatever the size requested.
 */
export function isIdenticon(bytes: Uint8Array, size: number): boolean {
  if (logoExtension(bytes) !== 'png' || bytes.length < 24) return false;
  // A PNG's width is the 4-byte big-endian number at offset 16, in its IHDR chunk.
  const width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
  return width !== size;
}

/** The logo files in `dir`, which must exist, in alphabetical order. */
async function logoFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  return files.filter(file => LOGO_EXTENSIONS.includes(path.extname(file).slice(1))).sort();
}

const fileStem = (file: string): string => file.slice(0, -path.extname(file).length);

export interface EcosystemLogosResult {
  /** The logos, as paths relative to the site's base URL, keyed by `ownerKey`. Owners without one are left out. */
  logos: Record<string, string>;
  /** The owners without a logo, each followed by the reason in parentheses. */
  without: string[];
  /** Human-readable descriptions of the owners whose logo could not be fetched; any logo they had is kept. */
  failures: string[];
}

/**
 * Downloads the logo of the owner of each of the given `owner/repo` repositories into static/img/ecosystem-logos,
 * and deletes the other logos there. An owner's logo is its GitHub avatar, at `LOGO_SIZE` pixels, found through
 * `owners` (see `fetchEcosystemMetadata`).
 *
 * Owners that are personal accounts (unless `personalAccounts`) and owners without an uploaded avatar (see
 * `isIdenticon`) get no logo. Only PNG, JPEG and GIF images are saved. If an owner's avatar cannot be fetched, or
 * its repositories' details weren't, the logo downloaded for it earlier, if any, is kept. Never throws because a
 * request failed.
 */
export async function downloadEcosystemLogos(
  siteDir: string,
  repos: readonly string[],
  owners: ReadonlyMap<string, GitHubOwner>,
  {
    fetchFn = fetch,
    personalAccounts = PERSONAL_ACCOUNT_LOGOS,
  }: { fetchFn?: FetchFn; personalAccounts?: boolean } = {}
): Promise<EcosystemLogosResult> {
  const dir = path.join(siteDir, LOGOS_DIR);
  await fs.mkdir(dir, { recursive: true });
  const existing = await logoFiles(dir);
  const keys = [...new Set(repos.map(ownerKey))];

  const kept = new Map<string, string>();
  const without: string[] = [];
  const failures: string[] = [];
  const keepExisting = (key: string): void => {
    const file = existing.find(name => fileStem(name) === key);
    if (file) kept.set(key, file);
  };

  await mapWithConcurrency(keys, CONCURRENCY, async key => {
    const owner = owners.get(key);
    if (!owner) return keepExisting(key);
    try {
      if (owner.type !== 'Organization' && !personalAccounts) {
        without.push(`${owner.login} (personal account)`);
        return;
      }
      if (!owner.avatarUrl) throw new Error('no avatar URL');

      const url = new URL(owner.avatarUrl);
      url.searchParams.set('s', String(LOGO_SIZE));
      const image = await fetchFn(url.href, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!image.ok) throw new Error(`avatar: HTTP ${image.status}`);
      const bytes = new Uint8Array(await image.arrayBuffer());
      const extension = logoExtension(bytes);
      if (!extension) throw new Error('the avatar is not a PNG, JPEG or GIF image');
      if (isIdenticon(bytes, LOGO_SIZE)) {
        without.push(`${owner.login} (no uploaded avatar)`);
        return;
      }

      const file = `${key}.${extension}`;
      await fs.writeFile(path.join(dir, file), bytes);
      kept.set(key, file);
    } catch (err) {
      failures.push(`${owner.login}: ${errorMessage(err)}`);
      keepExisting(key);
    }
  });

  const keptFiles = new Set(kept.values());
  for (const file of existing) {
    if (!keptFiles.has(file)) await fs.rm(path.join(dir, file));
  }

  const sort = (list: string[]) => list.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return {
    logos: Object.fromEntries(
      [...kept].sort().map(([key, file]) => [key, `${ECOSYSTEM_LOGOS_PATH}/${file}`])
    ),
    without: sort(without),
    failures: sort(failures),
  };
}

// Typed as `Plugin` (i.e. `Plugin<unknown>`) because that is what Docusaurus accepts for plugins listed in the config.
export default function ecosystemMetadataPlugin(context: LoadContext): Plugin {
  const yamlPath = path.join(context.siteDir, ECOSYSTEM_YAML);

  return {
    name: ECOSYSTEM_METADATA_PLUGIN,

    getPathsToWatch() {
      return [yamlPath];
    },

    async loadContent(): Promise<EcosystemPluginData> {
      const repos = collectGithubRepos(parse(await fs.readFile(yamlPath, 'utf8')));
      const token = process.env.GITHUB_TOKEN || undefined;
      const { metadata, owners, failures } = await fetchEcosystemMetadata(repos, { token });
      const logos = await downloadEcosystemLogos(context.siteDir, repos, owners);

      const fetched = Object.keys(metadata).length;
      const logoSummary = `and the logos of ${Object.keys(logos.logos).length} owners`;
      if (logos.failures.length > 0) {
        console.warn(
          `[${ECOSYSTEM_METADATA_PLUGIN}] Could not fetch the logos of ${logos.failures.length} owners, whose ` +
            `cards show their earlier logo or the MEDS logo:\n  ${logos.failures.join('\n  ')}`
        );
      }
      if (failures.length === 0) {
        console.info(
          `[${ECOSYSTEM_METADATA_PLUGIN}] Fetched GitHub metadata for ${fetched}/${repos.length} repos, ${logoSummary}.`
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
      return { repos: metadata, logos: logos.logos };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
