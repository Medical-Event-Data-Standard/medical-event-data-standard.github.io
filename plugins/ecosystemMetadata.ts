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
// the ecosystem YAML once, and exposes it to the site as plugin global data, with the committed logos of the
// packages' GitHub owners.
//
// Fetching here rather than in each visitor's browser matters: unauthenticated GitHub API calls are limited to
// 60/hour per IP, and the ecosystem page needs ~2 calls per repository, so browsers ran out partway through
// and many cards showed no stars. At build time we can authenticate with GITHUB_TOKEN instead.
//
// The logos are not fetched at build time: `npm run ecosystem:logos` (`updateEcosystemLogosFromYaml`) downloads
// them into static/img/ecosystem-logos, to be committed, and the site serves them itself.

export const ECOSYSTEM_YAML = path.join('static', 'data', 'ecosystem.yaml');
/** The committed logos of the packages' GitHub owners, named by `ownerKey`, e.g. `som-shahlab.png`. */
export const LOGOS_DIR = path.join('static', ...ECOSYSTEM_LOGOS_PATH.split('/'));
const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'medical-event-data-standard.github.io';
const CONCURRENCY = 8;
const TIMEOUT_MS = 15_000;

/**
 * Whether a package whose repository belongs to a personal GitHub account, rather than an organization, gets that
 * account's avatar as its logo. Such avatars are often photos of people, so while this is false those packages
 * show the MEDS logo. After changing it, run `npm run ecosystem:logos`.
 */
export const PERSONAL_ACCOUNT_LOGOS = false;

/** The width and height, in pixels, at which logos are downloaded: twice the size at which the cards show them. */
export const LOGO_SIZE = 64;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface GitHubRepoResponse {
  stargazers_count?: number;
  updated_at?: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
}

interface GitHubUserResponse {
  /** `User` or `Organization`. */
  type?: string;
  avatar_url?: string;
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

/** The logo files in `dir`, in alphabetical order. */
async function logoFiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  return files.filter(file => LOGO_EXTENSIONS.includes(path.extname(file).slice(1))).sort();
}

const fileStem = (file: string): string => file.slice(0, -path.extname(file).length);

/** The committed logos, as paths relative to the site's base URL, keyed by `ownerKey`. */
export async function findEcosystemLogos(siteDir: string): Promise<Record<string, string>> {
  const files = await logoFiles(path.join(siteDir, LOGOS_DIR));
  return Object.fromEntries(files.map(file => [fileStem(file), `${ECOSYSTEM_LOGOS_PATH}/${file}`]));
}

export interface EcosystemLogosResult {
  /** The owners whose logo was downloaded. */
  saved: string[];
  /** The owners without a logo, each followed by the reason in parentheses. */
  without: string[];
  /** The number of logo files deleted, because their owner no longer has a logo or is no longer listed. */
  removed: number;
  /** Human-readable descriptions of the owners whose logo could not be fetched; any logo they had is kept. */
  failures: string[];
}

/**
 * Downloads the logo of the owner of each of the given `owner/repo` repositories into static/img/ecosystem-logos,
 * and deletes the other logos there. An owner's logo is its GitHub avatar, at `LOGO_SIZE` pixels.
 *
 * Owners that are personal accounts (unless `personalAccounts`) and owners without an uploaded avatar (see
 * `isIdenticon`) get no logo. Only PNG, JPEG and GIF images are saved. If an owner's details or avatar cannot be
 * fetched, its existing logo, if any, is kept and the failure reported. Does not throw when a request fails.
 */
export async function updateEcosystemLogos(
  siteDir: string,
  repos: string[],
  {
    token,
    fetchFn = fetch,
    personalAccounts = PERSONAL_ACCOUNT_LOGOS,
  }: { token?: string; fetchFn?: FetchFn; personalAccounts?: boolean }
): Promise<EcosystemLogosResult> {
  const dir = path.join(siteDir, LOGOS_DIR);
  await fs.mkdir(dir, { recursive: true });
  const existing = await logoFiles(dir);
  // One request per owner, however many of its repositories are listed, spelled as in its first repository.
  const owners = new Map<string, string>();
  for (const repo of repos) {
    if (!owners.has(ownerKey(repo))) owners.set(ownerKey(repo), repo.trim().split('/')[0]);
  }

  const keep = new Set<string>();
  const saved: string[] = [];
  const without: string[] = [];
  const failures: string[] = [];

  await mapWithConcurrency([...owners], CONCURRENCY, async ([key, owner]) => {
    try {
      const res = await githubApiGet(`${GITHUB_API}/users/${owner}`, token, fetchFn);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { type, avatar_url } = (await res.json()) as GitHubUserResponse;
      if (type !== 'Organization' && !personalAccounts) {
        without.push(`${owner} (personal account)`);
        return;
      }
      if (!avatar_url) throw new Error('no avatar_url');

      const url = new URL(avatar_url);
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
        without.push(`${owner} (no uploaded avatar)`);
        return;
      }

      const file = `${key}.${extension}`;
      await fs.writeFile(path.join(dir, file), bytes);
      keep.add(file);
      saved.push(owner);
    } catch (err) {
      failures.push(`${owner}: ${errorMessage(err)}`);
      existing.filter(file => fileStem(file) === key).forEach(file => keep.add(file));
    }
  });

  let removed = 0;
  for (const file of existing) {
    if (!keep.has(file)) {
      await fs.rm(path.join(dir, file));
      removed++;
    }
  }

  const sort = (list: string[]) => list.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return { saved: sort(saved), without: sort(without), removed, failures: sort(failures) };
}

/**
 * Refreshes the logos of the GitHub owners of the packages in static/data/ecosystem.yaml (see
 * `updateEcosystemLogos`): `npm run ecosystem:logos`. Returns a summary to print, and whether anything failed.
 */
export async function updateEcosystemLogosFromYaml(
  siteDir: string,
  { token = process.env.GITHUB_TOKEN || undefined, fetchFn }: { token?: string; fetchFn?: FetchFn } = {}
): Promise<{ warning: boolean; message: string }> {
  const repos = collectGithubRepos(parse(await fs.readFile(path.join(siteDir, ECOSYSTEM_YAML), 'utf8')));
  const { saved, without, removed, failures } = await updateEcosystemLogos(siteDir, repos, {
    token,
    fetchFn,
  });
  const lines = [
    `Saved the logos of ${saved.length} GitHub owners in ${LOGOS_DIR}, and deleted ${removed} other logos.`,
    ...(without.length > 0
      ? ['Owners without a logo, whose packages show the MEDS logo:', ...without.map(owner => `  ${owner}`)]
      : []),
    ...(failures.length > 0
      ? [
          'Failed, so any logo the owner had was kept:',
          ...failures.map(failure => `  ${failure}`),
          ...(token ? [] : ['GITHUB_TOKEN is not set, so the GitHub API requests were unauthenticated.']),
        ]
      : []),
  ];
  return { warning: failures.length > 0, message: lines.join('\n') };
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
      return { repos: metadata, logos: await findEcosystemLogos(context.siteDir) };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
