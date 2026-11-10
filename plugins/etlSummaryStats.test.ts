import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LoadContext, PluginContentLoadedActions } from '@docusaurus/types';
import etlSummaryStatsPlugin, {
  ETL_STATS_SNAPSHOT,
  ETL_STATS_YAML,
  type EtlRepo,
  collectDatasetEtls,
  collectEtlStats,
  etlStatsSource,
  loadEtlStats,
  mergeEtlRepos,
  parseEtlStatsConfig,
  planStatsFiles,
  readLocalStats,
  readSnapshot,
  updateEtlStatsSnapshot,
} from './etlSummaryStats';
import { statsDocument, statsEntry } from '../src/lib/etlSummaryStats/testFixtures';
import { type EtlStatsData, SITE_GITHUB_REPO } from '../src/lib/etlSummaryStats/types';

// ─── A fake GitHub ──────────────────────────────────────────────

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function response(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  } as Response;
}

const tree = (paths: string[], truncated = false) => ({
  truncated,
  tree: [{ path: 'src', type: 'tree' }, ...paths.map(p => ({ path: p, type: 'blob' }))],
});

const API = 'https://api.github.com/repos';
const RAW = 'https://raw.githubusercontent.com';

/** Responses by URL; anything else is a 404. */
function fakeGitHub(routes: Record<string, Response | Error | string>) {
  return jest.fn<FetchFn>(async url => {
    const route = routes[url];
    if (route instanceof Error || typeof route === 'string') throw route;
    return route ?? response(404, { message: 'Not Found' });
  });
}

const treeUrl = (repo: string) => `${API}/${repo}/git/trees/HEAD?recursive=1`;
const rawUrl = (repo: string, file: string) => `${RAW}/${repo}/HEAD/${file}`;

const repo = (githubRepo: string, name = githubRepo.split('/')[1], files = {}): EtlRepo => ({
  githubRepo,
  name,
  files,
});

// ─── Configuration ──────────────────────────────────────────────

describe('parseEtlStatsConfig', () => {
  it('parses repos, per-file overrides and excludes', () => {
    expect(
      parseEtlStatsConfig({
        repos: [
          { github_repo: ' org/Extra ', label: ' Extra ', note: 'for reviewers' },
          {
            github_repo: 'org/Alpha',
            files: { 'a/full_summary_stats.json': { label: 'Alpha full', variant: 'full', note: 'x' } },
          },
        ],
        exclude: [' org/Gone ', 'org/Alpha/old_summary_stats.json'],
      })
    ).toEqual({
      repos: [
        { githubRepo: 'org/Extra', label: 'Extra', files: {} },
        {
          githubRepo: 'org/Alpha',
          files: { 'a/full_summary_stats.json': { label: 'Alpha full', variant: 'full' } },
        },
      ],
      exclude: ['org/Gone', 'org/Alpha/old_summary_stats.json'],
      localFiles: [],
    });
  });

  it('parses files committed to this repository, taking the variant from the name unless given', () => {
    expect(
      parseEtlStatsConfig({
        local_files: [
          { path: ' static/data/stats/a_full_summary_stats.json ', label: ' A ', variant: 'full', note: 'x' },
          { path: 'static/data/stats/b_demo_summary_stats.json', label: 'B demo' },
          { path: 'static/data/stats/c.json', label: 'C' },
          { path: 'static/data/stats/d_demo.json', label: 'D', variant: 'full' },
        ],
      }).localFiles
    ).toEqual([
      { path: 'static/data/stats/a_full_summary_stats.json', label: 'A', variant: 'full' },
      { path: 'static/data/stats/b_demo_summary_stats.json', label: 'B demo', variant: 'demo' },
      { path: 'static/data/stats/c.json', label: 'C', variant: 'full' },
      { path: 'static/data/stats/d_demo.json', label: 'D', variant: 'full' },
    ]);
  });

  it('parses the dataset name and version a local file shows instead of its own, null for none', () => {
    expect(
      parseEtlStatsConfig({
        local_files: [
          { path: 'a.json', label: 'A', dataset_name: ' Alpha ', dataset_version: ' 1.2 ' },
          { path: 'b.json', label: 'B', dataset_version: null },
          { path: 'c.json', label: 'C', dataset_name: 'Gamma' },
        ],
      }).localFiles.map(file => file.datasetOverride)
    ).toEqual([{ name: 'Alpha', version: '1.2' }, { version: null }, { name: 'Gamma' }]);
  });

  it('accepts an empty file or empty lists', () => {
    const empty = { repos: [], exclude: [], localFiles: [] };
    expect(parseEtlStatsConfig(null)).toEqual(empty);
    expect(parseEtlStatsConfig({ repos: null, exclude: null, local_files: null })).toEqual(empty);
  });

  it.each([
    ['a list', [], 'it must be a mapping'],
    ['an unknown top-level field', { repo: [] }, 'unknown top-level field `repo`'],
    ['repos that are not a list', { repos: {} }, '`repos` must be a list'],
    ['exclude that is not a list', { exclude: 'org/x' }, '`exclude` must be a list'],
    ['a bad exclude entry', { exclude: ['just-a-name'] }, '`exclude[0]` must be owner/repo'],
    ['a missing github_repo', { repos: [{}] }, '`repos[0].github_repo` must be owner/repo'],
    ['an empty repo entry', { repos: [null] }, '`repos[0].github_repo` must be owner/repo'],
    [
      'an unknown repo field',
      { repos: [{ github_repo: 'o/r', url: 'x' }] },
      '`repos[0]` has an unknown field `url`',
    ],
    ['an empty label', { repos: [{ github_repo: 'o/r', label: ' ' }] }, '`repos[0].label` must be a string'],
    ['files that are a list', { repos: [{ github_repo: 'o/r', files: [] }] }, '`repos[0].files` must map'],
    [
      'a file override that is a string',
      { repos: [{ github_repo: 'o/r', files: { f: 'demo' } }] },
      'must be a mapping',
    ],
    [
      'a file override with an empty label',
      { repos: [{ github_repo: 'o/r', files: { f: { label: '' } } }] },
      '`repos[0].files.f.label` must be a string',
    ],
    [
      'an unknown variant',
      { repos: [{ github_repo: 'o/r', files: { f: { variant: 'sample' } } }] },
      '`repos[0].files.f.variant` must be full or demo',
    ],
    [
      'an unknown file field',
      { repos: [{ github_repo: 'o/r', files: { f: { path: 'x' } } }] },
      '`repos[0].files.f` has an unknown field `path`',
    ],
    ['local_files that are not a list', { local_files: {} }, '`local_files` must be a list'],
    ['a local file that is a string', { local_files: ['a.json'] }, '`local_files[0]` must be a mapping'],
    [
      'an unknown local file field',
      { local_files: [{ path: 'a.json', label: 'A', repo: 'x' }] },
      '`local_files[0]` has an unknown field `repo`',
    ],
    ['a local file without a path', { local_files: [{ label: 'A' }] }, '`local_files[0].path` must be'],
    ['a local file that is not JSON', { local_files: [{ path: 'a.yaml', label: 'A' }] }, '.path` must be'],
    ['an absolute local path', { local_files: [{ path: '/etc/a.json', label: 'A' }] }, '.path` must be'],
    ['a local path out of the site', { local_files: [{ path: '../a.json', label: 'A' }] }, '.path` must be'],
    ['a local path with a backslash', { local_files: [{ path: 'a\\b.json', label: 'A' }] }, '.path` must be'],
    ['a local file without a label', { local_files: [{ path: 'a.json' }] }, '`local_files[0].label` must'],
    [
      'a local file with an unknown variant',
      { local_files: [{ path: 'a.json', label: 'A', variant: 'sample' }] },
      '`local_files[0].variant` must be full or demo',
    ],
    [
      'a local dataset version that is a number',
      { local_files: [{ path: 'a.json', label: 'A', dataset_version: 1.2 }] },
      "`local_files[0].dataset_version` must be a string (quote a number, e.g. '1.2') or null",
    ],
    [
      'an empty local dataset name',
      { local_files: [{ path: 'a.json', label: 'A', dataset_name: ' ' }] },
      '`local_files[0].dataset_name` must be a string',
    ],
    [
      'a local file listed twice',
      {
        local_files: [
          { path: 'a.json', label: 'A' },
          { path: 'a.json', label: 'B' },
        ],
      },
      '`local_files` lists a.json more than once',
    ],
  ])('rejects %s', (_name, raw, message) => {
    expect(() => parseEtlStatsConfig(raw)).toThrow(`Invalid ${ETL_STATS_YAML}: `);
    expect(() => parseEtlStatsConfig(raw)).toThrow(message);
  });
});

describe('collectDatasetEtls', () => {
  it('collects the github_repos under dataset_etls only, de-duplicated case-insensitively', () => {
    const ecosystem = {
      tools: { packages: [{ name: 'Not an ETL', github_repo: 'org/tool' }] },
      dataset_etls: {
        name: 'Dataset ETLs',
        templates: { packages: [{ name: 'Template', github_repo: 'org/template' }, { name: 'No repo' }] },
        public: {
          packages: [
            { name: 'MIMIC', github_repo: ' org/MIMIC ' },
            { name: 'Again', github_repo: 'ORG/mimic' },
            { github_repo: 'org/nameless' },
            { name: ' ', github_repo: 'org/blank-name' },
            { name: 'Bad', github_repo: 42 },
          ],
        },
      },
    };
    expect(collectDatasetEtls(ecosystem)).toEqual([
      { githubRepo: 'org/template', name: 'Template' },
      { githubRepo: 'org/MIMIC', name: 'MIMIC' },
      { githubRepo: 'org/nameless', name: 'org/nameless' },
      { githubRepo: 'org/blank-name', name: 'org/blank-name' },
    ]);
  });

  it('handles a missing section', () => {
    expect(collectDatasetEtls(null)).toEqual([]);
    expect(collectDatasetEtls({ tools: {} })).toEqual([]);
  });
});

describe('mergeEtlRepos', () => {
  it('applies overrides to ecosystem repos, appends extra repos and drops excluded ones', () => {
    const merged = mergeEtlRepos(
      [
        { githubRepo: 'org/MIMIC', name: 'MIMIC-IV' },
        { githubRepo: 'org/Gone', name: 'Gone' },
      ],
      {
        repos: [
          { githubRepo: 'ORG/mimic', files: { 'demo.json': { label: 'MIMIC demo', variant: 'demo' } } },
          { githubRepo: 'other/K-MIMIC', label: 'K-MIMIC', files: {} },
          { githubRepo: 'other/Unlabelled_MEDS', files: {} },
        ],
        exclude: ['org/gone'],
        localFiles: [],
      }
    );
    expect(merged).toEqual([
      {
        githubRepo: 'org/MIMIC',
        name: 'MIMIC-IV',
        files: { 'demo.json': { label: 'MIMIC demo', variant: 'demo' } },
      },
      { githubRepo: 'other/K-MIMIC', name: 'K-MIMIC', files: {} },
      { githubRepo: 'other/Unlabelled_MEDS', name: 'Unlabelled_MEDS', files: {} },
    ]);
  });
});

describe('planStatsFiles', () => {
  it('finds *summary_stats*.json files and tells full from demo files', () => {
    const files = [
      'README.md',
      'tests/regression/full_summary_stats.json',
      'tests/regression/demo_summary_stats.json',
      'summary_stats.yaml',
      'docs/summary_stats/notes.json',
    ];
    expect(planStatsFiles(repo('org/MIMIC', 'MIMIC-IV'), files)).toEqual([
      {
        id: 'org/mimic/tests/regression/demo_summary_stats.json',
        host: 'etl',
        githubRepo: 'org/MIMIC',
        path: 'tests/regression/demo_summary_stats.json',
        label: 'MIMIC-IV demo',
        variant: 'demo',
      },
      {
        id: 'org/mimic/tests/regression/full_summary_stats.json',
        host: 'etl',
        githubRepo: 'org/MIMIC',
        path: 'tests/regression/full_summary_stats.json',
        label: 'MIMIC-IV',
        variant: 'full',
      },
    ]);
  });

  it('applies per-file overrides, includes explicitly listed files and skips excluded ones', () => {
    const r = repo('org/R', 'R', {
      'baseline.json': { label: 'R baseline' },
      'x_demo_summary_stats.json': { variant: 'full' },
    });
    const plan = planStatsFiles(
      r,
      ['baseline.json', 'x_demo_summary_stats.json', 'old_summary_stats.json'],
      ['ORG/r/old_summary_stats.json', 'org/other/baseline.json', 'org/R']
    );
    expect(plan.map(({ path: p, label, variant }) => [p, label, variant])).toEqual([
      ['baseline.json', 'R baseline', 'full'],
      ['x_demo_summary_stats.json', 'R', 'full'],
    ]);
  });

  it('appends file names to labels that would otherwise clash, but keeps explicit labels', () => {
    const r = repo('org/R', 'R', { 'c_summary_stats.json': { label: 'R' } });
    const plan = planStatsFiles(r, [
      'a/v1_summary_stats.json',
      'b/v2_summary_stats.json',
      'c_summary_stats.json',
    ]);
    expect(plan.map(p => p.label)).toEqual(['R (v1_summary_stats.json)', 'R (v2_summary_stats.json)', 'R']);
  });
});

// ─── Fetching ───────────────────────────────────────────────────

const ALPHA = 'org/Alpha';
const ALPHA_FILE = 'tests/regression/full_summary_stats.json';
const ALPHA_ID = `org/alpha/${ALPHA_FILE}`;

const snapshotWith = (overrides: Partial<EtlStatsData> = {}): EtlStatsData => ({
  updatedAt: '2026-01-01T00:00:00.000Z',
  datasets: [
    statsEntry('Alpha (snapshot)', { id: ALPHA_ID, githubRepo: ALPHA, path: ALPHA_FILE }),
    statsEntry('Down (snapshot)', {
      id: 'org/down/s_summary_stats.json',
      githubRepo: 'org/Down',
      path: 's_summary_stats.json',
    }),
    statsEntry('Trunc old', {
      id: 'org/trunc/old_summary_stats.json',
      githubRepo: 'org/Trunc',
      path: 'old_summary_stats.json',
    }),
  ],
  reposWithoutStats: [{ githubRepo: 'org/NothingYet', name: 'Old name' }],
  ...overrides,
});

describe('collectEtlStats', () => {
  it('lists, fetches and normalises the stats files, and records repos without any', async () => {
    const fetchFn = fakeGitHub({
      [treeUrl(ALPHA)]: response(200, tree(['README.md', ALPHA_FILE])),
      [rawUrl(ALPHA, ALPHA_FILE)]: response(200, statsDocument()),
      [treeUrl('org/Empty')]: response(200, {}),
      [treeUrl('org/Template')]: response(200, tree(['etl.py'])),
    });
    const result = await collectEtlStats(
      [repo(ALPHA), repo('org/Empty', 'Empty'), repo('org/Template', 'Template')],
      null,
      { fetchFn, token: 'secret' }
    );

    expect(result.failures).toEqual([]);
    expect(result.problems).toEqual([]);
    expect(result.fromSnapshot).toEqual([]);
    expect(result.reposWithoutStats).toEqual([
      { githubRepo: 'org/Empty', name: 'Empty' },
      { githubRepo: 'org/Template', name: 'Template' },
    ]);
    expect(result.datasets).toHaveLength(1);
    expect(result.datasets[0]).toMatchObject({
      id: ALPHA_ID,
      label: 'Alpha',
      variant: 'full',
      host: 'etl',
      githubRepo: ALPHA,
      path: ALPHA_FILE,
      schemaVersion: 1,
      extractedAt: '2026-11-04T22:16:51.111265',
      problem: null,
    });
    expect(result.datasets[0].stats?.counts.subjects).toBe(500);

    // The token goes to the GitHub API only, never to raw.githubusercontent.com.
    const headers = (url: string) =>
      fetchFn.mock.calls.find(([called]) => called === url)?.[1]?.headers as Record<string, string>;
    expect(headers(treeUrl(ALPHA)).Authorization).toBe('Bearer secret');
    expect(headers(rawUrl(ALPHA, ALPHA_FILE)).Authorization).toBeUndefined();
  });

  it('sends no token when none is given, and uses the global fetch by default', async () => {
    const originalFetch = globalThis.fetch;
    const fetchFn = fakeGitHub({ [treeUrl('org/T')]: response(200, tree([])) });
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    try {
      await collectEtlStats([repo('org/T')], null);
      expect((fetchFn.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falls back to the snapshot, per repository and per file, when GitHub fails', async () => {
    const fetchFn = fakeGitHub({
      // Alpha's file list works, but its file can't be downloaded.
      [treeUrl(ALPHA)]: response(200, tree([ALPHA_FILE])),
      [rawUrl(ALPHA, ALPHA_FILE)]: response(500, 'oops'),
      // Down's file list fails entirely (as does NothingYet's, which the snapshot knows has no file).
      [treeUrl('org/Down')]: new Error('network down'),
      [treeUrl('org/NothingYet')]: response(403, {}),
      // Trunc's file list is truncated: its new file is fetched, and its old one comes from the snapshot.
      [treeUrl('org/Trunc')]: response(200, tree(['new_summary_stats.json'], true)),
      [rawUrl('org/Trunc', 'new_summary_stats.json')]: response(200, statsDocument()),
      // Unknown's file list fails and the snapshot doesn't know it.
      [treeUrl('org/Unknown')]: 'not an Error',
    });
    const result = await collectEtlStats(
      [
        repo(ALPHA, 'Alpha'),
        repo('org/Down'),
        repo('org/NothingYet', 'Nothing yet'),
        repo('org/Trunc'),
        repo('org/Unknown'),
      ],
      snapshotWith(),
      { fetchFn }
    );

    expect(result.datasets.map(d => d.label)).toEqual([
      'Alpha (snapshot)',
      'Down (snapshot)',
      'Trunc',
      'Trunc old',
    ]);
    expect([...result.fromSnapshot].sort()).toEqual([
      ALPHA_ID,
      'org/down/s_summary_stats.json',
      'org/trunc/old_summary_stats.json',
    ]);
    // The snapshot's knowledge that a repo has no stats file is kept, under the current name.
    expect(result.reposWithoutStats).toEqual([{ githubRepo: 'org/NothingYet', name: 'Nothing yet' }]);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${ALPHA}/${ALPHA_FILE}: HTTP 500`,
        'org/Down (file list): network down',
        'org/NothingYet (file list): HTTP 403',
        'org/Trunc: its file list is truncated, so stats files may be missed',
        'org/Unknown (file list): not an Error',
      ])
    );
  });

  it('reports invalid JSON and non-stats files, without listing the repo as having no stats', async () => {
    const fetchFn = fakeGitHub({
      [treeUrl('org/Bad')]: response(200, tree(['a_summary_stats.json', 'b_summary_stats.json'])),
      [rawUrl('org/Bad', 'a_summary_stats.json')]: response(200, '{"stats_schema_version": 1,'),
      [rawUrl('org/Bad', 'b_summary_stats.json')]: response(200, { hello: 'world' }),
    });
    const result = await collectEtlStats([repo('org/Bad')], null, { fetchFn });
    expect(result.datasets).toEqual([]);
    expect(result.reposWithoutStats).toEqual([]);
    expect(result.failures).toEqual([
      'org/Bad/a_summary_stats.json: it is not valid JSON',
      'org/Bad/b_summary_stats.json: it has no `stats_schema_version`, so it is not a meds_summary_stats file',
    ]);
  });

  it('keeps a file with an unsupported schema version, as a problem rather than a failure', async () => {
    const fetchFn = fakeGitHub({
      [treeUrl('org/Next')]: response(200, tree(['full_summary_stats.json'])),
      [rawUrl('org/Next', 'full_summary_stats.json')]: response(
        200,
        statsDocument({ stats_schema_version: 2 })
      ),
    });
    const result = await collectEtlStats([repo('org/Next')], null, { fetchFn });
    expect(result.failures).toEqual([]);
    expect(result.datasets[0]).toMatchObject({ schemaVersion: 2, stats: null });
    expect(result.problems).toEqual([
      expect.stringMatching(/^Next \(full_summary_stats\.json\): .*schema version is 2/),
    ]);
  });
});

// ─── Loading and the plugin ─────────────────────────────────────

describe('etlStatsSource', () => {
  it('honours ETL_STATS_SOURCE, else fetches live for production builds only', () => {
    expect(etlStatsSource({ ETL_STATS_SOURCE: ' LIVE ' })).toBe('live');
    expect(etlStatsSource({ ETL_STATS_SOURCE: 'snapshot', NODE_ENV: 'production' })).toBe('snapshot');
    expect(etlStatsSource({ ETL_STATS_SOURCE: 'bogus', NODE_ENV: 'production' })).toBe('live');
    expect(etlStatsSource({ NODE_ENV: 'development' })).toBe('snapshot');
    expect(etlStatsSource({})).toBe('snapshot');
  });
});

describe('loading', () => {
  let siteDir: string;
  const write = async (file: string, content: string) => {
    await fs.mkdir(path.dirname(path.join(siteDir, file)), { recursive: true });
    await fs.writeFile(path.join(siteDir, file), content);
  };
  const now = () => new Date('2026-11-06T12:00:00.000Z');

  beforeEach(async () => {
    siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'etl-summary-stats-'));
    await write(
      path.join('static', 'data', 'ecosystem.yaml'),
      [
        'dataset_etls:',
        '  name: Dataset ETLs',
        '  public:',
        '    packages:',
        `      - name: Alpha`,
        `        github_repo: ${ALPHA}`,
        `      - name: Template`,
        `        github_repo: org/Template`,
      ].join('\n')
    );
    await write(ETL_STATS_YAML, 'repos:\n  - github_repo: org/Extra\n    label: Extra\nexclude: []\n');
    await write(ETL_STATS_SNAPSHOT, JSON.stringify(snapshotWith()));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(siteDir, { recursive: true, force: true });
  });

  const github = (extraOk = true) =>
    fakeGitHub({
      [treeUrl(ALPHA)]: response(200, tree([ALPHA_FILE])),
      [rawUrl(ALPHA, ALPHA_FILE)]: response(200, statsDocument()),
      [treeUrl('org/Template')]: response(200, tree([])),
      [treeUrl('org/Extra')]: extraOk ? response(200, tree(['s_summary_stats.json'])) : new Error('timeout'),
      [rawUrl('org/Extra', 's_summary_stats.json')]: response(
        200,
        statsDocument({ stats_schema_version: 3 })
      ),
    });

  describe('readSnapshot', () => {
    it('reads a valid snapshot and explains an unusable one', async () => {
      expect((await readSnapshot(path.join(siteDir, ETL_STATS_SNAPSHOT))).snapshot?.updatedAt).toBe(
        '2026-01-01T00:00:00.000Z'
      );
      expect(await readSnapshot(path.join(siteDir, 'missing.json'))).toEqual({
        snapshot: null,
        problem: 'it does not exist',
      });
      await write('bad.json', '{"updatedAt": null}');
      expect(await readSnapshot(path.join(siteDir, 'bad.json'))).toEqual({
        snapshot: null,
        problem: 'it is not in the expected format',
      });
      await write('broken.json', '{');
      expect((await readSnapshot(path.join(siteDir, 'broken.json'))).problem).toMatch(
        /^it could not be read: /
      );
    });
  });

  it('uses the snapshot for the dev server, without fetching', async () => {
    const fetchFn = github();
    const result = await loadEtlStats(siteDir, { env: {}, fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.warning).toBe(false);
    expect(result.data).toEqual(snapshotWith());
    expect(result.message).toContain('Using the snapshot from 2026-01-01T00:00:00.000Z (3 stats files)');
  });

  it('warns, with an empty page, when the dev server has no snapshot', async () => {
    await fs.rm(path.join(siteDir, ETL_STATS_SNAPSHOT));
    const result = await loadEtlStats(siteDir, { env: {} });
    expect(result.warning).toBe(true);
    expect(result.data).toEqual({ updatedAt: null, datasets: [], reposWithoutStats: [] });
    expect(result.message).toContain('it does not exist');
  });

  it('collects live for production builds, noting files it cannot show', async () => {
    const result = await loadEtlStats(siteDir, { env: { NODE_ENV: 'production' }, fetchFn: github(), now });
    expect(result.data.updatedAt).toBe('2026-11-06T12:00:00.000Z');
    expect(result.data.datasets.map(d => [d.label, d.schemaVersion])).toEqual([
      ['Alpha', 1],
      ['Extra', 3],
    ]);
    expect(result.data.reposWithoutStats).toEqual([{ githubRepo: 'org/Template', name: 'Template' }]);
    expect(result.warning).toBe(true);
    expect(result.message).toMatch(/^Collected 2 stats files from 2 of 3 ETL repositories:\n {2}Extra/);
  });

  it('collects live without warnings when everything works', async () => {
    await write(ETL_STATS_YAML, 'exclude: [org/Extra]\n');
    const result = await loadEtlStats(siteDir, { env: { ETL_STATS_SOURCE: 'live' }, fetchFn: github(), now });
    expect(result).toMatchObject({
      warning: false,
      message: 'Collected 1 stats files from 1 of 2 ETL repositories.',
    });
  });

  describe('stats files committed to this repository', () => {
    const HERE = 'static/data/etl_summary_stats/here_full_summary_stats.json';
    const config = (file = HERE) =>
      `exclude: [org/Extra]\nlocal_files:\n  - path: ${file}\n    label: Here\n    note: for reviewers\n`;

    it('reads them with the files on GitHub, normalised the same way, and snapshots them', async () => {
      await write(ETL_STATS_YAML, config());
      await write(HERE, JSON.stringify(statsDocument()));
      const result = await loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn: github(), now });
      expect(result).toMatchObject({
        warning: false,
        message: 'Collected 1 stats files from 1 of 2 ETL repositories and 1 from this repository.',
      });
      expect(result.data.datasets.map(d => [d.label, d.host])).toEqual([
        ['Alpha', 'etl'],
        ['Here', 'site'],
      ]);
      expect(result.data.datasets[1]).toMatchObject({
        id: `${SITE_GITHUB_REPO.toLowerCase()}/${HERE}`,
        githubRepo: SITE_GITHUB_REPO,
        path: HERE,
        variant: 'full',
        schemaVersion: 1,
        problem: null,
      });
      expect(result.data.datasets[1].stats).toEqual(result.data.datasets[0].stats);

      const snapshot = await updateEtlStatsSnapshot(siteDir, { env: {}, fetchFn: github(), now });
      const written = JSON.parse(await fs.readFile(path.join(siteDir, ETL_STATS_SNAPSHOT), 'utf8'));
      expect(written.datasets.map((d: { label: string }) => d.label)).toEqual(['Alpha', 'Here']);
      expect(written).toEqual(snapshot.data);
      // The dev server uses the snapshot, without reading them again.
      await fs.rm(path.join(siteDir, HERE));
      const dev = await loadEtlStats(siteDir, { env: {} });
      expect(dev.data.datasets.map(d => d.label)).toEqual(['Alpha', 'Here']);
    });

    it("keeps the file's dataset name and version, and the ones configured to show instead", async () => {
      await write(ETL_STATS_YAML, `${config()}    dataset_name: Shown\n    dataset_version: '2.0'\n`);
      await write(HERE, JSON.stringify(statsDocument()));
      const result = await loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn: github(), now });
      expect(result.data.datasets[1]).toMatchObject({
        dataset: { name: 'Example', version: '1.0' },
        datasetOverride: { name: 'Shown', version: '2.0' },
      });
      expect(result.data.datasets[0]).not.toHaveProperty('datasetOverride');
    });

    it('keeps one with a schema version the page cannot read, as a problem', async () => {
      await write(ETL_STATS_YAML, config());
      await write(HERE, JSON.stringify(statsDocument({ stats_schema_version: 2 })));
      const result = await loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn: github(), now });
      expect(result.warning).toBe(true);
      expect(result.data.datasets[1]).toMatchObject({ label: 'Here', schemaVersion: 2, stats: null });
      expect(result.message).toContain(`Here (${HERE}): Its stats schema version is 2`);
    });

    it.each([
      ['missing', null, 'it does not exist'],
      ['not JSON', '{"stats_schema_version": 1,', 'it is not valid JSON'],
      ['not a stats file', '{"hello": "world"}', 'it has no `stats_schema_version`'],
    ])('fails the build, before any request, for one that is %s', async (_name, content, reason) => {
      await write(ETL_STATS_YAML, config());
      if (content !== null) await write(HERE, content);
      const fetchFn = github();
      await expect(loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn })).rejects.toThrow(
        `${HERE}, listed under local_files in ${ETL_STATS_YAML}: ${reason}`
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('reports why a file could not be read', async () => {
      await fs.mkdir(path.join(siteDir, 'folder.json'));
      await expect(
        readLocalStats(siteDir, [{ path: 'folder.json', label: 'Folder', variant: 'full' }])
      ).rejects.toThrow(/^folder\.json, listed under local_files in .*: EISDIR/);
    });
  });

  it('falls back to the snapshot when a repository fails, keeping its date and suggesting a token', async () => {
    const result = await loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn: github(false), now });
    expect(result.warning).toBe(true);
    expect(result.data.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.message).toContain('Could not collect everything');
    expect(result.message).toContain('org/Extra (file list): timeout');
    expect(result.message).toContain('GITHUB_TOKEN is not set');

    const withToken = await loadEtlStats(siteDir, {
      source: 'live',
      env: { GITHUB_TOKEN: 't' },
      fetchFn: github(false),
    });
    expect(withToken.message).not.toContain('GITHUB_TOKEN is not set');
  });

  it('names the files it took from the snapshot', async () => {
    const fetchFn = fakeGitHub({
      [treeUrl(ALPHA)]: response(200, tree([ALPHA_FILE])),
      [rawUrl(ALPHA, ALPHA_FILE)]: response(502, 'Bad Gateway'),
    });
    const result = await loadEtlStats(siteDir, { source: 'live', env: { GITHUB_TOKEN: 't' }, fetchFn });
    expect(result.data.datasets.map(d => d.label)).toEqual(['Alpha (snapshot)']);
    expect(result.message).toContain(`${ALPHA}/${ALPHA_FILE}: HTTP 502`);
    expect(result.message).toContain(`Taken from the snapshot instead: ${ALPHA_ID}.`);
  });

  it('says so when the snapshot it would fall back to is unusable', async () => {
    await fs.rm(path.join(siteDir, ETL_STATS_SNAPSHOT));
    const result = await loadEtlStats(siteDir, { source: 'live', env: {}, fetchFn: github(false), now });
    expect(result.data.updatedAt).toBeNull();
    expect(result.message).toContain(`Snapshot ${ETL_STATS_SNAPSHOT} unavailable: it does not exist.`);
  });

  it('fails the build for an invalid configuration file', async () => {
    await write(ETL_STATS_YAML, 'repos: 5\n');
    await expect(loadEtlStats(siteDir, { env: {} })).rejects.toThrow('`repos` must be a list');
  });

  it('refreshes the snapshot from a live fetch', async () => {
    const result = await updateEtlStatsSnapshot(siteDir, { env: {}, fetchFn: github(), now });
    const written = JSON.parse(await fs.readFile(path.join(siteDir, ETL_STATS_SNAPSHOT), 'utf8'));
    expect(written).toEqual(result.data);
    expect(written.updatedAt).toBe('2026-11-06T12:00:00.000Z');
  });

  it('refreshes the snapshot with the global fetch and environment by default', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = github() as unknown as typeof fetch;
    try {
      const result = await updateEtlStatsSnapshot(siteDir);
      expect(result.data.datasets.map(d => d.label)).toEqual(['Alpha', 'Extra']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  describe('the plugin', () => {
    const originalSource = process.env.ETL_STATS_SOURCE;

    beforeEach(() => {
      jest.spyOn(console, 'info').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      if (originalSource === undefined) delete process.env.ETL_STATS_SOURCE;
      else process.env.ETL_STATS_SOURCE = originalSource;
    });

    it('publishes the data as global data, watching its config and snapshot', async () => {
      process.env.ETL_STATS_SOURCE = 'snapshot';
      const plugin = etlSummaryStatsPlugin({ siteDir } as LoadContext);
      expect(plugin.name).toBe('etl-summary-stats');
      expect(plugin.getPathsToWatch?.()).toEqual([
        path.join(siteDir, ETL_STATS_YAML),
        path.join(siteDir, ETL_STATS_SNAPSHOT),
      ]);

      const content = await plugin.loadContent?.();
      expect(content).toEqual(snapshotWith());
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[etl-summary-stats] Using the snapshot')
      );

      const setGlobalData = jest.fn();
      await plugin.contentLoaded?.({
        content,
        actions: { setGlobalData } as unknown as PluginContentLoadedActions,
      });
      expect(setGlobalData).toHaveBeenCalledWith(content);
    });

    it('logs a single warning when something went wrong', async () => {
      process.env.ETL_STATS_SOURCE = 'snapshot';
      await fs.rm(path.join(siteDir, ETL_STATS_SNAPSHOT));
      await etlSummaryStatsPlugin({ siteDir } as LoadContext).loadContent?.();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.info).not.toHaveBeenCalled();
    });
  });
});
