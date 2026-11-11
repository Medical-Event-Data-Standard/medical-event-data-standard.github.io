import fs from 'fs/promises';
import path from 'path';
import { parse } from 'yaml';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { repoKey } from '../src/lib/ecosystem/githubMetadata';
import { isEtlStatsData, normalizeStatsDocument } from '../src/lib/etlSummaryStats/normalize';
import {
  type DatasetLocation,
  type DatasetLocations,
  type DatasetOverride,
  ETL_SUMMARY_STATS_PLUGIN,
  type EtlStatsData,
  type EtlStatsEntry,
  type EtlStatsPageData,
  type LocatedDataset,
  type RepoWithoutStats,
  SITE_GITHUB_REPO,
  type StatsHost,
  type StatsVariant,
} from '../src/lib/etlSummaryStats/types';

// This runs in Node.js at build time. It collects the `meds_summary_stats` files
// (https://github.com/Medical-Event-Data-Standard/meds_summary_stats) that dataset ETL repositories commit, and
// exposes a compact, chart-ready subset of them to the "Dataset statistics" page as plugin global data.
//
// The ETL maintainers compute and publish these files (several refresh them with a `summary-stats` workflow); this
// site only collects and charts them, the way it collects GitHub stars (plugins/ecosystemMetadata.ts).
//
// Which repositories: every `github_repo` under `dataset_etls` in static/data/ecosystem.yaml, plus the extra repos
// and overrides in static/data/etl_summary_stats.yaml. Each repository's file list is read from the GitHub API
// (authenticated with GITHUB_TOKEN if set) and searched for `*summary_stats*.json`, so new ETLs appear by
// themselves. The files are then downloaded from raw.githubusercontent.com, validated and normalised.
//
// Stats files of datasets that no ETL repository publishes can be committed to this repository instead (under
// static/data/etl_summary_stats/) and listed under `local_files` in etl_summary_stats.yaml. They are read from disk
// whenever the GitHub files are fetched, and normalised and snapshotted the same way. A listed file that is missing
// or isn't a stats document is a mistake in this repository, so it fails the build. An entry can set the dataset
// name and version that the page shows (`dataset_name`, `dataset_version`), for a file whose dataset.json states
// something else; the file's own values are kept alongside.
//
// The network never fails the build: whatever can't be fetched is taken from the committed snapshot
// (static/data/etl_summary_stats.snapshot.json), with a single warning in the build log. Where the data comes from
// depends on ETL_STATS_SOURCE (`live` or `snapshot`): by default a live fetch for production builds and the snapshot
// for the dev server (`npm start`). To refresh the snapshot, e.g. after editing etl_summary_stats.yaml, run the
// following and commit the result:
//
//   GITHUB_TOKEN=$(gh auth token) npx ts-node --transpile-only -O '{"module":"commonjs"}' \
//     scripts/update-etl-summary-stats-snapshot.ts && npx prettier --write static/data/etl_summary_stats.snapshot.json
//
// Where the datasets come from, for the page's map, is read from static/data/dataset_locations.yaml on every build
// (it is not part of the snapshot); a malformed file fails the build.

export const ECOSYSTEM_YAML = path.join('static', 'data', 'ecosystem.yaml');
export const DATASET_LOCATIONS_YAML = path.join('static', 'data', 'dataset_locations.yaml');
export const ETL_STATS_YAML = path.join('static', 'data', 'etl_summary_stats.yaml');
export const ETL_STATS_SNAPSHOT = path.join('static', 'data', 'etl_summary_stats.snapshot.json');

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
const GITHUB_REPO = /^[\w.-]+\/[\w.-]+$/;
/** Stats files are found by name: anything ending in `.json` whose file name contains `summary_stats`. */
const STATS_FILE = /(?:^|\/)[^/]*summary_stats[^/]*\.json$/i;

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// ─── Configuration ──────────────────────────────────────────────

export interface FileOverride {
  label?: string;
  variant?: StatsVariant;
}

export interface RepoOverride {
  githubRepo: string;
  label?: string;
  files: Record<string, FileOverride>;
}

/** A stats file committed to this repository. */
export interface LocalStatsFile {
  /** Relative to the site directory, e.g. `static/data/etl_summary_stats/x_full_summary_stats.json`. */
  path: string;
  label: string;
  variant: StatsVariant;
  /** The dataset name and version to show instead of those the file states (`dataset_name`, `dataset_version`). */
  datasetOverride?: DatasetOverride;
}

export interface EtlStatsConfig {
  repos: RepoOverride[];
  /** `owner/repo` or `owner/repo/path/to/file.json`. */
  exclude: string[];
  localFiles: LocalStatsFile[];
}

/** An ETL repository to search, with its display name and per-file overrides. */
export interface EtlRepo {
  githubRepo: string;
  name: string;
  files: Record<string, FileOverride>;
}

function parseFileOverride(value: unknown, where: string): FileOverride {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`\`${where}\` must be a mapping with a \`label\` and/or \`variant\``);
  }
  const override: FileOverride = {};
  for (const [key, field] of Object.entries(value)) {
    if (key === 'label') {
      if (typeof field !== 'string' || !field.trim()) throw new Error(`\`${where}.label\` must be a string`);
      override.label = field.trim();
    } else if (key === 'variant') {
      if (field !== 'full' && field !== 'demo') throw new Error(`\`${where}.variant\` must be full or demo`);
      override.variant = field;
    } else if (key !== 'note') {
      throw new Error(`\`${where}\` has an unknown field \`${key}\``);
    }
  }
  return override;
}

function parseRepoOverride(value: unknown, i: number): RepoOverride {
  const where = `repos[${i}]`;
  const fields = (value ?? {}) as Record<string, unknown>;
  const unknown = Object.keys(fields).find(key => !['github_repo', 'label', 'files', 'note'].includes(key));
  if (unknown) throw new Error(`\`${where}\` has an unknown field \`${unknown}\``);
  const { github_repo, label, files } = fields;
  if (typeof github_repo !== 'string' || !GITHUB_REPO.test(github_repo.trim())) {
    throw new Error(`\`${where}.github_repo\` must be owner/repo`);
  }
  if (label !== undefined && (typeof label !== 'string' || !label.trim())) {
    throw new Error(`\`${where}.label\` must be a string`);
  }
  if (files !== undefined && (files === null || typeof files !== 'object' || Array.isArray(files))) {
    throw new Error(`\`${where}.files\` must map file paths to overrides`);
  }
  return {
    githubRepo: github_repo.trim(),
    ...(typeof label === 'string' ? { label: label.trim() } : {}),
    files: Object.fromEntries(
      Object.entries((files ?? {}) as Record<string, unknown>).map(([file, override]) => [
        file,
        parseFileOverride(override, `${where}.files.${file}`),
      ])
    ),
  };
}

/** A demo dataset's stats file has "demo" in its name, unless configured otherwise. */
const variantFromName = (file: string): StatsVariant =>
  /demo/i.test(file.split('/').pop() as string) ? 'demo' : 'full';

function parseLocalFile(value: unknown, i: number): LocalStatsFile {
  const where = `local_files[${i}]`;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`\`${where}\` must be a mapping with a \`path\` and a \`label\``);
  }
  const fields = value as Record<string, unknown>;
  const unknown = Object.keys(fields).find(
    key => !['path', 'label', 'variant', 'dataset_name', 'dataset_version', 'note'].includes(key)
  );
  if (unknown) throw new Error(`\`${where}\` has an unknown field \`${unknown}\``);
  const { path: file, label, variant } = fields;
  // A plain relative path inside the site directory, so it also names the file in this repository on GitHub.
  if (
    typeof file !== 'string' ||
    !file.trim().endsWith('.json') ||
    path.posix.isAbsolute(file.trim()) ||
    file.includes('\\') ||
    file
      .trim()
      .split('/')
      .some(part => part === '..' || part === '.' || part === '')
  ) {
    throw new Error(`\`${where}.path\` must be a relative path to a .json file, such as static/data/x.json`);
  }
  if (typeof label !== 'string' || !label.trim()) throw new Error(`\`${where}.label\` must be a string`);
  if (variant !== undefined && variant !== 'full' && variant !== 'demo') {
    throw new Error(`\`${where}.variant\` must be full or demo`);
  }
  // Each is shown instead of what the file's dataset.json states; null shows nothing.
  const datasetOverride: DatasetOverride = {};
  for (const [key, field] of [
    ['name', 'dataset_name'],
    ['version', 'dataset_version'],
  ] as const) {
    if (!(field in fields)) continue;
    const text = fields[field];
    if (text !== null && (typeof text !== 'string' || !text.trim())) {
      throw new Error(`\`${where}.${field}\` must be a string (quote a number, e.g. '1.2') or null`);
    }
    datasetOverride[key] = text === null ? null : text.trim();
  }
  return {
    path: file.trim(),
    label: label.trim(),
    variant: variant ?? variantFromName(file.trim()),
    ...(Object.keys(datasetOverride).length > 0 ? { datasetOverride } : {}),
  };
}

/** Validates the parsed etl_summary_stats.yaml. A malformed file is a mistake in this repository, so this throws. */
export function parseEtlStatsConfig(raw: unknown): EtlStatsConfig {
  try {
    if (raw === null || raw === undefined) return { repos: [], exclude: [], localFiles: [] };
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('it must be a mapping');
    const { repos, exclude, local_files: localFiles, ...rest } = raw as Record<string, unknown>;
    const unknown = Object.keys(rest);
    if (unknown.length > 0) throw new Error(`unknown top-level field \`${unknown[0]}\``);
    for (const [name, list] of Object.entries({ repos, exclude, local_files: localFiles })) {
      if (list !== undefined && list !== null && !Array.isArray(list))
        throw new Error(`\`${name}\` must be a list`);
    }
    const local = ((localFiles ?? []) as unknown[]).map(parseLocalFile);
    const duplicate = local.find((file, i) => local.findIndex(other => other.path === file.path) !== i);
    if (duplicate) throw new Error(`\`local_files\` lists ${duplicate.path} more than once`);
    return {
      repos: ((repos ?? []) as unknown[]).map(parseRepoOverride),
      exclude: ((exclude ?? []) as unknown[]).map((entry, i) => {
        if (typeof entry !== 'string' || !/^[\w.-]+\/[\w.-]+(\/.+)?$/.test(entry.trim())) {
          throw new Error(`\`exclude[${i}]\` must be owner/repo or owner/repo/path/to/file.json`);
        }
        return entry.trim();
      }),
      localFiles: local,
    };
  } catch (err) {
    throw new Error(`Invalid ${ETL_STATS_YAML}: ${errorMessage(err)}`);
  }
}

/**
 * Collects the packages with a `github_repo` under `dataset_etls` in the parsed ecosystem YAML, de-duplicated
 * case-insensitively (the first package's name wins).
 */
export function collectDatasetEtls(ecosystem: unknown): { githubRepo: string; name: string }[] {
  const repos = new Map<string, { githubRepo: string; name: string }>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (typeof node.github_repo === 'string' && node.github_repo.trim()) {
      const githubRepo = node.github_repo.trim();
      const name = typeof node.name === 'string' && node.name.trim() ? node.name.trim() : githubRepo;
      if (!repos.has(repoKey(githubRepo))) repos.set(repoKey(githubRepo), { githubRepo, name });
    }
    Object.values(node).forEach(visit);
  };
  visit((ecosystem as Record<string, unknown> | null)?.dataset_etls);
  return [...repos.values()];
}

const isRepoExcluded = (exclude: string[], githubRepo: string): boolean =>
  exclude.some(entry => repoKey(entry) === repoKey(githubRepo));

const isFileExcluded = (exclude: string[], githubRepo: string, file: string): boolean =>
  exclude.some(entry => {
    const [owner, repo, ...rest] = entry.split('/');
    return rest.length > 0 && repoKey(`${owner}/${repo}`) === repoKey(githubRepo) && rest.join('/') === file;
  });

/** The ecosystem's dataset ETLs, then the config's extra repos, with the config's overrides applied. */
export function mergeEtlRepos(
  ecosystemRepos: { githubRepo: string; name: string }[],
  config: EtlStatsConfig
): EtlRepo[] {
  const repos = new Map<string, EtlRepo>(
    ecosystemRepos.map(({ githubRepo, name }) => [repoKey(githubRepo), { githubRepo, name, files: {} }])
  );
  for (const override of config.repos) {
    const existing = repos.get(repoKey(override.githubRepo));
    repos.set(repoKey(override.githubRepo), {
      githubRepo: existing?.githubRepo ?? override.githubRepo,
      name: override.label ?? existing?.name ?? override.githubRepo.split('/')[1],
      files: { ...existing?.files, ...override.files },
    });
  }
  return [...repos.values()].filter(repo => !isRepoExcluded(config.exclude, repo.githubRepo));
}

// ─── Discovery ──────────────────────────────────────────────────

/** A stats file to fetch or read. */
export interface StatsFileTarget {
  id: string;
  host: StatsHost;
  githubRepo: string;
  path: string;
  label: string;
  variant: StatsVariant;
}

export const statsFileId = (githubRepo: string, file: string): string => `${repoKey(githubRepo)}/${file}`;

/**
 * Picks a repository's stats files from its file list: those named `*summary_stats*.json`, plus any the config
 * lists explicitly, minus excluded ones. Labels default to the package name, plus " demo" for a demo file; if two
 * files would get the same label, each gets its file name appended.
 */
export function planStatsFiles(repo: EtlRepo, files: string[], exclude: string[] = []): StatsFileTarget[] {
  const targets = files
    .filter(file => STATS_FILE.test(file) || file in repo.files)
    .filter(file => !isFileExcluded(exclude, repo.githubRepo, file))
    .sort()
    .map(file => {
      const override = repo.files[file] ?? {};
      const variant = override.variant ?? variantFromName(file);
      return {
        id: statsFileId(repo.githubRepo, file),
        host: 'etl' as const,
        githubRepo: repo.githubRepo,
        path: file,
        label: override.label ?? (variant === 'demo' ? `${repo.name} demo` : repo.name),
        variant,
        explicitLabel: override.label !== undefined,
      };
    });
  return targets.map(({ explicitLabel, ...target }) => {
    const duplicate = !explicitLabel && targets.filter(other => other.label === target.label).length > 1;
    return duplicate ? { ...target, label: `${target.label} (${target.path.split('/').pop()})` } : target;
  });
}

// ─── Dataset locations ──────────────────────────────────────────

type Fields = Record<string, unknown>;

/** The entry's fields, if it is a mapping with only the `allowed` ones (and `note`, which is ignored). */
function mapping(value: unknown, where: string, allowed: string[]): Fields {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`\`${where}\` must be a mapping`);
  }
  const unknown = Object.keys(value).find(key => key !== 'note' && !allowed.includes(key));
  if (unknown) throw new Error(`\`${where}\` has an unknown field \`${unknown}\``);
  return value as Fields;
}

function text(fields: Fields, key: string, where: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`\`${where}.${key}\` must be a string`);
  return value.trim();
}

const optionalText = (fields: Fields, key: string, where: string): string | null =>
  fields[key] === undefined ? null : text(fields, key, where);

function url(fields: Fields, key: string, where: string): string {
  const value = text(fields, key, where);
  if (!/^https:\/\/[^\s/]+\/\S*$/.test(value)) throw new Error(`\`${where}.${key}\` must be an https URL`);
  return value;
}

function coordinate(fields: Fields, key: string, where: string, limit: number): number {
  const value = fields[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    throw new Error(`\`${where}.${key}\` must be a number from -${limit} to ${limit}`);
  }
  return value;
}

function list(fields: Fields, key: string, where: string): unknown[] {
  const value = fields[key];
  if (!Array.isArray(value) || value.length === 0)
    throw new Error(`\`${where}.${key}\` must be a non-empty list`);
  return value;
}

function parseLocatedDataset(value: unknown, where: string): LocatedDataset {
  const fields = mapping(value, where, ['label', 'source', 'caveat']);
  return {
    label: text(fields, 'label', where),
    source: url(fields, 'source', where),
    caveat: optionalText(fields, 'caveat', where),
  };
}

function parseLocation(value: unknown, i: number): DatasetLocation {
  const where = `locations[${i}]`;
  const fields = mapping(value, where, [
    'institution',
    'openalex',
    'coordinates_source',
    'city',
    'country',
    'latitude',
    'longitude',
    'caveat',
    'datasets',
  ]);
  // The coordinates come from an OpenAlex record, or, where OpenAlex has none, from another source cited here.
  const openalexId = optionalText(fields, 'openalex', where);
  if (openalexId !== null && !/^I\d+$/.test(openalexId))
    throw new Error(`\`${where}.openalex\` must be an OpenAlex id, such as I123`);
  const coordinatesSource =
    fields.coordinates_source === undefined ? null : url(fields, 'coordinates_source', where);
  if ((openalexId === null) === (coordinatesSource === null))
    throw new Error(`\`${where}\` must have either \`openalex\` or \`coordinates_source\`, not both`);
  const country = text(fields, 'country', where);
  if (!/^[A-Z]{2}$/.test(country)) throw new Error(`\`${where}.country\` must be an ISO 3166-1 alpha-2 code`);
  return {
    institution: text(fields, 'institution', where),
    openalexId,
    coordinatesSource,
    city: text(fields, 'city', where),
    country,
    latitude: coordinate(fields, 'latitude', where, 90),
    longitude: coordinate(fields, 'longitude', where, 180),
    caveat: optionalText(fields, 'caveat', where),
    datasets: list(fields, 'datasets', where).map((dataset, j) =>
      parseLocatedDataset(dataset, `${where}.datasets[${j}]`)
    ),
  };
}

/**
 * Validates the parsed dataset_locations.yaml. A malformed file, an institution listed twice, or a dataset listed
 * more than once (at two locations, or both at one and as unplaced) is a mistake in this repository, so this throws.
 */
export function parseDatasetLocations(raw: unknown): DatasetLocations {
  try {
    if (raw === null || raw === undefined) return { locations: [], unplaced: [] };
    const fields = mapping(raw, 'the file', ['locations', 'unplaced']);
    for (const key of ['locations', 'unplaced']) {
      if (fields[key] !== undefined && fields[key] !== null && !Array.isArray(fields[key])) {
        throw new Error(`\`${key}\` must be a list`);
      }
    }
    const locations = ((fields.locations ?? []) as unknown[]).map(parseLocation);
    const unplaced = ((fields.unplaced ?? []) as unknown[]).map((value, i) => {
      const where = `unplaced[${i}]`;
      const entry = mapping(value, where, ['datasets', 'reason', 'source']);
      return {
        datasets: list(entry, 'datasets', where).map((label, j) => {
          if (typeof label !== 'string' || !label.trim()) {
            throw new Error(`\`${where}.datasets[${j}]\` must be a dataset's label`);
          }
          return label.trim();
        }),
        reason: text(entry, 'reason', where),
        source: url(entry, 'source', where),
      };
    });
    const institutions = locations.map(location => location.institution);
    const twice = institutions.find((name, i) => institutions.indexOf(name) !== i);
    if (twice) throw new Error(`\`locations\` lists ${twice} more than once`);
    const labels = [
      ...locations.flatMap(location => location.datasets.map(dataset => dataset.label)),
      ...unplaced.flatMap(entry => entry.datasets),
    ];
    const again = labels.find((label, i) => labels.indexOf(label) !== i);
    if (again) throw new Error(`the dataset ${again} is listed more than once`);
    return { locations, unplaced };
  } catch (err) {
    throw new Error(`Invalid ${DATASET_LOCATIONS_YAML}: ${errorMessage(err)}`);
  }
}

/** Reads and validates dataset_locations.yaml; a missing file means no locations. */
export async function readDatasetLocations(siteDir: string): Promise<DatasetLocations> {
  let content: string;
  try {
    content = await fs.readFile(path.join(siteDir, DATASET_LOCATIONS_YAML), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { locations: [], unplaced: [] };
    throw err;
  }
  return parseDatasetLocations(parse(content));
}

// ─── Fetching ───────────────────────────────────────────────────

interface GitTreeResponse {
  truncated?: boolean;
  tree?: { path?: unknown; type?: unknown }[];
}

export interface CollectOptions {
  token?: string;
  fetchFn?: FetchFn;
  exclude?: string[];
}

export interface CollectResult {
  datasets: EtlStatsEntry[];
  reposWithoutStats: RepoWithoutStats[];
  /** Requests or files that failed. */
  failures: string[];
  /** Files that were read but whose stats can't be shown, e.g. an unsupported schema version. */
  problems: string[];
  /** Ids of entries taken from the snapshot because they couldn't be fetched. */
  fromSnapshot: string[];
}

/**
 * Lists each repository's files, then fetches and normalises its stats files. Never throws: a repository whose
 * file list can't be read, or a file that can't be fetched or isn't a stats document, is reported in `failures`
 * and taken from the snapshot, if the snapshot has it.
 */
export async function collectEtlStats(
  repos: EtlRepo[],
  snapshot: EtlStatsData | null,
  { token, fetchFn = fetch, exclude = [] }: CollectOptions = {}
): Promise<CollectResult> {
  const perRepo: { datasets: EtlStatsEntry[]; withoutStats: RepoWithoutStats | null }[] = [];
  const result: CollectResult = {
    datasets: [],
    reposWithoutStats: [],
    failures: [],
    problems: [],
    fromSnapshot: [],
  };
  const snapshotEntries = new Map((snapshot?.datasets ?? []).map(entry => [entry.id, entry]));

  const get = (url: string, headers: Record<string, string> = {}): Promise<Response> =>
    fetchFn(url, {
      headers: { 'User-Agent': 'medical-event-data-standard.github.io', ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  const snapshotEntriesFor = (githubRepo: string, except: Set<string>): EtlStatsEntry[] =>
    [...snapshotEntries.values()].filter(
      entry => repoKey(entry.githubRepo) === repoKey(githubRepo) && !except.has(entry.id)
    );

  const collectRepo = async (repo: EtlRepo): Promise<(typeof perRepo)[number]> => {
    const datasets: EtlStatsEntry[] = [];
    let files: string[];
    let complete = true;
    try {
      const res = await get(`${GITHUB_API}/repos/${repo.githubRepo}/git/trees/HEAD?recursive=1`, {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tree = (await res.json()) as GitTreeResponse;
      files = (tree.tree ?? [])
        .filter(item => item.type === 'blob' && typeof item.path === 'string')
        .map(item => item.path as string);
      if (tree.truncated) {
        complete = false;
        result.failures.push(`${repo.githubRepo}: its file list is truncated, so stats files may be missed`);
      }
    } catch (err) {
      result.failures.push(`${repo.githubRepo} (file list): ${errorMessage(err)}`);
      const fallback = snapshotEntriesFor(repo.githubRepo, new Set());
      result.fromSnapshot.push(...fallback.map(entry => entry.id));
      const knownWithout = snapshot?.reposWithoutStats.find(
        r => repoKey(r.githubRepo) === repoKey(repo.githubRepo)
      );
      return { datasets: fallback, withoutStats: knownWithout ? { ...knownWithout, name: repo.name } : null };
    }

    const targets = planStatsFiles(repo, files, exclude);
    for (const target of targets) {
      try {
        const res = await get(`${GITHUB_RAW}/${repo.githubRepo}/HEAD/${target.path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let doc: unknown;
        try {
          doc = JSON.parse(await res.text());
        } catch {
          throw new Error('it is not valid JSON');
        }
        const normalized = normalizeStatsDocument(doc);
        if (normalized.problem)
          result.problems.push(`${target.label} (${target.path}): ${normalized.problem}`);
        datasets.push({ ...target, ...normalized });
      } catch (err) {
        result.failures.push(`${repo.githubRepo}/${target.path}: ${errorMessage(err)}`);
        const cached = snapshotEntries.get(target.id);
        if (cached) {
          result.fromSnapshot.push(cached.id);
          datasets.push(cached);
        }
      }
    }
    if (!complete) {
      const fallback = snapshotEntriesFor(repo.githubRepo, new Set(datasets.map(entry => entry.id)));
      result.fromSnapshot.push(...fallback.map(entry => entry.id));
      datasets.push(...fallback);
    }
    // Only a complete file list without any stats file shows that the repository has none.
    const withoutStats =
      complete && targets.length === 0 ? { githubRepo: repo.githubRepo, name: repo.name } : null;
    return { datasets, withoutStats };
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < repos.length) {
      const i = next++;
      perRepo[i] = await collectRepo(repos[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, repos.length) }, worker));

  for (const { datasets, withoutStats } of perRepo) {
    result.datasets.push(...datasets);
    if (withoutStats) result.reposWithoutStats.push(withoutStats);
  }
  return result;
}

// ─── Files in this repository ───────────────────────────────────

/**
 * Reads, validates and normalises the stats files committed to this repository (`local_files`). Unlike a file on
 * GitHub, one that is missing, isn't JSON or isn't a stats document is a mistake in this repository, so this
 * throws. A file with a schema version the page can't read is kept, with its problem, as for files on GitHub.
 */
export async function readLocalStats(
  siteDir: string,
  files: LocalStatsFile[]
): Promise<{ datasets: EtlStatsEntry[]; problems: string[] }> {
  const datasets: EtlStatsEntry[] = [];
  const problems: string[] = [];
  for (const file of files) {
    try {
      let text: string;
      try {
        text = await fs.readFile(path.join(siteDir, file.path), 'utf8');
      } catch (err) {
        throw new Error(
          (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'it does not exist' : errorMessage(err)
        );
      }
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        throw new Error('it is not valid JSON');
      }
      const normalized = normalizeStatsDocument(doc);
      if (normalized.problem) problems.push(`${file.label} (${file.path}): ${normalized.problem}`);
      datasets.push({
        id: statsFileId(SITE_GITHUB_REPO, file.path),
        host: 'site',
        githubRepo: SITE_GITHUB_REPO,
        path: file.path,
        label: file.label,
        variant: file.variant,
        ...normalized,
        ...(file.datasetOverride ? { datasetOverride: file.datasetOverride } : {}),
      });
    } catch (err) {
      throw new Error(`${file.path}, listed under local_files in ${ETL_STATS_YAML}: ${errorMessage(err)}`);
    }
  }
  return { datasets, problems };
}

// ─── Loading ────────────────────────────────────────────────────

/** Reads the snapshot, returning null (with the reason) if it is missing or malformed. */
export async function readSnapshot(
  file: string
): Promise<{ snapshot: EtlStatsData | null; problem?: string }> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (isEtlStatsData(parsed)) return { snapshot: parsed };
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
 * Where the data comes from: `ETL_STATS_SOURCE=live` or `snapshot` if set; otherwise a live fetch for production
 * builds, and the snapshot for the dev server (`npm start`), so starting it makes no requests.
 */
export function etlStatsSource(env: NodeJS.ProcessEnv): 'live' | 'snapshot' {
  const source = env.ETL_STATS_SOURCE?.trim().toLowerCase();
  if (source === 'live' || source === 'snapshot') return source;
  return env.NODE_ENV === 'production' ? 'live' : 'snapshot';
}

export interface LoadEtlStatsOptions {
  env?: NodeJS.ProcessEnv;
  fetchFn?: FetchFn;
  /** Forces a live fetch (or not), regardless of `etlStatsSource`. */
  source?: 'live' | 'snapshot';
  now?: () => Date;
}

export interface LoadEtlStatsResult {
  data: EtlStatsData;
  /** True if something went wrong: a fetch failed, a file can't be shown, or the snapshot is unusable. */
  warning: boolean;
  /** Human-readable summary, logged by the plugin and the update script. */
  message: string;
}

/** Loads the configuration, collects the stats files (unless using the snapshot) and fills gaps from the snapshot. */
export async function loadEtlStats(
  siteDir: string,
  options: LoadEtlStatsOptions = {}
): Promise<LoadEtlStatsResult> {
  const { env = process.env, fetchFn, now = () => new Date() } = options;
  const source = options.source ?? etlStatsSource(env);
  const config = parseEtlStatsConfig(parse(await fs.readFile(path.join(siteDir, ETL_STATS_YAML), 'utf8')));
  const { snapshot, problem } = await readSnapshot(path.join(siteDir, ETL_STATS_SNAPSHOT));

  if (source === 'snapshot') {
    const data = snapshot ?? { updatedAt: null, datasets: [], reposWithoutStats: [] };
    const summary = `${data.datasets.length} stats files`;
    return snapshot
      ? {
          data,
          warning: false,
          message:
            `Using the snapshot from ${data.updatedAt} (${summary}). ` +
            'Set ETL_STATS_SOURCE=live to fetch them from GitHub instead.',
        }
      : {
          data,
          warning: true,
          message: `Snapshot ${ETL_STATS_SNAPSHOT} unavailable (${problem}), so the dataset statistics page is empty.`,
        };
  }

  // The files in this repository first, so that a mistake in them fails the build before any request is made.
  const local = await readLocalStats(siteDir, config.localFiles);
  const ecosystem = parse(await fs.readFile(path.join(siteDir, ECOSYSTEM_YAML), 'utf8'));
  const repos = mergeEtlRepos(collectDatasetEtls(ecosystem), config);
  const token = env.GITHUB_TOKEN?.trim() || undefined;
  const collected = await collectEtlStats(repos, snapshot, { token, fetchFn, exclude: config.exclude });
  const fresh = collected.failures.length === 0;
  const data: EtlStatsData = {
    updatedAt: fresh ? now().toISOString() : (snapshot?.updatedAt ?? null),
    datasets: [...collected.datasets, ...local.datasets],
    reposWithoutStats: collected.reposWithoutStats,
  };

  const summary =
    `${collected.datasets.length} stats files from ${repos.length - data.reposWithoutStats.length} of ` +
    `${repos.length} ETL repositories` +
    (local.datasets.length > 0 ? ` and ${local.datasets.length} from this repository` : '');
  const problems = [...collected.problems, ...local.problems];
  if (fresh && problems.length === 0) {
    return { data, warning: false, message: `Collected ${summary}.` };
  }
  const lines = [
    ...collected.failures,
    ...problems,
    ...(collected.fromSnapshot.length
      ? [`Taken from the snapshot instead: ${collected.fromSnapshot.join('; ')}.`]
      : []),
    ...(!fresh && problem ? [`Snapshot ${ETL_STATS_SNAPSHOT} unavailable: ${problem}.`] : []),
  ];
  return {
    data,
    warning: true,
    message:
      `${fresh ? 'Collected' : 'Could not collect everything; the page shows'} ${summary}:\n  ${lines.join('\n  ')}` +
      (!fresh && !token
        ? '\nGITHUB_TOKEN is not set, so GitHub API requests were unauthenticated (60/hour).'
        : ''),
  };
}

/** Refreshes the committed snapshot from GitHub (scripts/update-etl-summary-stats-snapshot.ts). */
export async function updateEtlStatsSnapshot(
  siteDir: string,
  options: LoadEtlStatsOptions = {}
): Promise<LoadEtlStatsResult> {
  const result = await loadEtlStats(siteDir, { ...options, source: 'live' });
  await fs.writeFile(path.join(siteDir, ETL_STATS_SNAPSHOT), `${JSON.stringify(result.data, null, 2)}\n`);
  return result;
}

// Typed as `Plugin` (i.e. `Plugin<unknown>`) because that is what Docusaurus accepts for plugins listed in the config.
export default function etlSummaryStatsPlugin(context: LoadContext): Plugin {
  return {
    name: ETL_SUMMARY_STATS_PLUGIN,

    getPathsToWatch() {
      return [ETL_STATS_YAML, ETL_STATS_SNAPSHOT, DATASET_LOCATIONS_YAML].map(file =>
        path.join(context.siteDir, file)
      );
    },

    async loadContent(): Promise<EtlStatsPageData> {
      const { data, warning, message } = await loadEtlStats(context.siteDir);
      if (warning) console.warn(`[${ETL_SUMMARY_STATS_PLUGIN}] ${message}`);
      else console.info(`[${ETL_SUMMARY_STATS_PLUGIN}] ${message}`);
      return { ...data, locations: await readDatasetLocations(context.siteDir) };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData(content);
    },
  };
}
