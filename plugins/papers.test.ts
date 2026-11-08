import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LoadContext, PluginContentLoadedActions } from '@docusaurus/types';
import papersPlugin, {
  createS2Client,
  fetchFromSemanticScholar,
  loadPapers,
  papersSource,
  parsePapersConfig,
  readSnapshot,
  retryAfterMs,
  updatePapersSnapshot,
  type S2ClientOptions,
  type S2Request,
} from './papers';
import type { PapersConfig, S2Paper } from '../src/lib/papers/normalize';
import type { PapersData } from '../src/lib/papers/types';

const SEED = 'a'.repeat(40);
const OTHER_SEED = 'b'.repeat(40);
const API = 'https://api.semanticscholar.org/graph/v1';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers });

const s2 = (paperId: string, overrides: Partial<S2Paper> = {}): S2Paper => ({
  paperId,
  title: `Paper ${paperId}`,
  year: 2025,
  authors: [{ name: 'Ada Lovelace' }],
  externalIds: {},
  citationCount: 1,
  ...overrides,
});

/** A fake clock: `sleep` advances it instantly and records each delay. */
function fakeClock(start = 0): Required<Pick<S2ClientOptions, 'sleep' | 'now'>> & { sleeps: number[] } {
  let time = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => time,
    sleep: async ms => {
      sleeps.push(ms);
      time += ms;
    },
  };
}

describe('retryAfterMs', () => {
  it('parses seconds and HTTP dates', () => {
    expect(retryAfterMs('3', 0)).toBe(3000);
    expect(retryAfterMs('-1', 0)).toBe(0);
    expect(retryAfterMs('Thu, 01 Jan 1970 00:00:05 GMT', 1000)).toBe(4000);
    expect(retryAfterMs('Thu, 01 Jan 1970 00:00:05 GMT', 9000)).toBe(0);
  });

  it('returns null when there is no usable header', () => {
    expect(retryAfterMs(null, 0)).toBeNull();
    expect(retryAfterMs('', 0)).toBeNull();
    expect(retryAfterMs('soon', 0)).toBeNull();
  });
});

describe('createS2Client', () => {
  it('sends GETs and POSTs, with the API key only when one is given', async () => {
    const fetchFn = jest.fn<FetchFn>(async () => json(200, { ok: true }));
    const clock = fakeClock();
    const withKey = createS2Client({ fetchFn, apiKey: 'secret', ...clock });
    await expect(withKey('/paper/x')).resolves.toEqual({ ok: true });
    await withKey('/paper/batch', { ids: ['x'] });
    await createS2Client({ fetchFn, ...clock })('/paper/y');

    const [[getUrl, get], [, post], [, anonymous]] = fetchFn.mock.calls;
    expect(getUrl).toBe(`${API}/paper/x`);
    expect(get).toMatchObject({ method: 'GET', body: undefined });
    expect(get?.headers).toEqual({ 'User-Agent': expect.any(String), 'x-api-key': 'secret' });
    expect(post).toMatchObject({ method: 'POST', body: JSON.stringify({ ids: ['x'] }) });
    expect(post?.headers).toMatchObject({ 'Content-Type': 'application/json', 'x-api-key': 'secret' });
    expect(anonymous?.headers).not.toHaveProperty('x-api-key');
  });

  it('spaces requests out by the minimum interval', async () => {
    const clock = fakeClock();
    const request = createS2Client({ fetchFn: async () => json(200), minIntervalMs: 1000, ...clock });
    await request('/a');
    await clock.sleep(300); // Time spent between the two requests counts towards the interval.
    await request('/b');
    expect(clock.sleeps).toEqual([300, 700]);
  });

  it('retries 429 and 5xx responses, honouring Retry-After and otherwise backing off exponentially', async () => {
    const responses = [
      json(429, {}, { 'Retry-After': '7' }),
      json(503),
      json(500),
      json(200, { data: 'finally' }),
    ];
    const fetchFn = jest.fn<FetchFn>(async () => responses.shift() as Response);
    const clock = fakeClock();
    const request = createS2Client({ fetchFn, minIntervalMs: 0, baseDelayMs: 100, ...clock });

    await expect(request('/x')).resolves.toEqual({ data: 'finally' });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(clock.sleeps).toEqual([7000, 200, 400]);
  });

  it('gives up after maxRetries, and does not retry other errors', async () => {
    const clock = fakeClock();
    const limited = createS2Client({
      fetchFn: async () => json(429),
      maxRetries: 2,
      minIntervalMs: 0,
      ...clock,
    });
    await expect(limited('/x')).rejects.toThrow('HTTP 429');
    expect(clock.sleeps).toHaveLength(2);

    const fetchFn = jest.fn<FetchFn>(async () => json(404));
    await expect(createS2Client({ fetchFn, ...clock })('/x')).rejects.toThrow('HTTP 404');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('stops retrying, and sending requests, once the time budget is used up', async () => {
    const clock = fakeClock();
    const fetchFn = jest.fn<FetchFn>(async () => json(429, {}, { 'Retry-After': '60' }));
    const request = createS2Client({ fetchFn, budgetMs: 30_000, minIntervalMs: 1000, ...clock });
    await expect(request('/x')).rejects.toThrow('retrying would exceed the time budget of 30s');

    await clock.sleep(30_000);
    await expect(request('/y')).rejects.toThrow('time budget of 30s used up');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses the global fetch and real timers by default', async () => {
    const originalFetch = globalThis.fetch;
    const fetchFn = jest.fn<FetchFn>(async () => json(200, []));
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    try {
      const request = createS2Client({ minIntervalMs: 5 });
      await request('/a');
      await request('/b');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('fetchFromSemanticScholar', () => {
  const config: PapersConfig = {
    seeds: [
      { id: SEED, label: 'Seed' },
      { id: OTHER_SEED, label: 'Other' },
    ],
    include: ['DOI:10.1/x', 'ARXIV:0000.00000'],
    exclude: [],
  };

  it('fetches the seeds and included papers in one batch, then every page of citations', async () => {
    const request = jest.fn(async (pathAndQuery: string, body?: unknown) => {
      if (pathAndQuery.startsWith('/paper/batch')) {
        expect(body).toEqual({ ids: [SEED, OTHER_SEED, 'DOI:10.1/x', 'ARXIV:0000.00000'] });
        return [s2(SEED), s2(OTHER_SEED), s2('included'), null];
      }
      if (pathAndQuery.includes(`${SEED}/citations`) && pathAndQuery.endsWith('offset=0')) {
        return { next: 1000, data: [{ citingPaper: s2('c1') }, { citingPaper: null }] };
      }
      if (pathAndQuery.includes(`${SEED}/citations`)) return { data: [{ citingPaper: s2('c2') }] };
      return { next: 0, data: undefined }; // A `next` that doesn't advance must not loop forever.
    }) as unknown as S2Request;

    const { live, failures } = await fetchFromSemanticScholar(config, request);

    expect([...live.seeds.keys()]).toEqual([SEED, OTHER_SEED]);
    expect([...live.included.keys()]).toEqual(['DOI:10.1/x']);
    expect(live.citations.get(SEED)?.map(p => p.paperId)).toEqual(['c1', 'c2']);
    expect(live.citations.get(OTHER_SEED)).toEqual([]);
    expect(live.incompleteSeeds.size).toBe(0);
    expect(failures).toEqual(['ARXIV:0000.00000: not found on Semantic Scholar']);
    expect(jest.mocked(request).mock.calls[1][0]).toBe(
      `/paper/${SEED}/citations?fields=title,year,venue,publicationVenue,authors,externalIds,url,citationCount,publicationDate&limit=1000&offset=0`
    );
  });

  it('reports failures and keeps partial citation lists', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.startsWith('/paper/batch')) throw new Error('HTTP 429');
      if (pathAndQuery.endsWith('offset=0') && pathAndQuery.includes(SEED)) {
        return { next: 1000, data: [{ citingPaper: s2('c1') }] };
      }
      throw 'offline';
    }) as unknown as S2Request;

    const { live, failures } = await fetchFromSemanticScholar(config, request);

    expect(live.seeds.size).toBe(0);
    expect(live.citations.get(SEED)?.map(p => p.paperId)).toEqual(['c1']);
    expect([...live.incompleteSeeds]).toEqual([SEED, OTHER_SEED]);
    expect(failures).toEqual([
      'details of the seed and included papers: HTTP 429',
      'papers citing Seed: offline',
      'papers citing Other: offline',
    ]);
  });
});

describe('parsePapersConfig', () => {
  it('parses seeds and identifier lists given as strings or objects, normalising the identifiers', () => {
    expect(
      parsePapersConfig({
        seeds: [{ id: ` ${SEED} `, label: ' Seed ' }],
        include: [{ id: 'doi:10.1/X', note: 'why' }, ' arXiv:2401.00001v2 ', OTHER_SEED.toUpperCase()],
        exclude: null,
      })
    ).toEqual({
      seeds: [{ id: SEED, label: 'Seed' }],
      include: ['DOI:10.1/X', 'ARXIV:2401.00001', OTHER_SEED],
      exclude: [],
    });
  });

  it("parses a seed's overrides of Semantic Scholar's details", () => {
    const seed = {
      id: SEED,
      label: 'Seed',
      note: 'Semantic Scholar garbled this one.',
      title: ' Real Title ',
      authors: [' Ada Lovelace ', 'Alan Turing'],
      venue: 'ICLR 2024 Workshop',
      year: 2024,
      url: 'https://openreview.net/forum?id=x',
    };
    expect(parsePapersConfig({ seeds: [seed] }).seeds).toEqual([
      {
        id: SEED,
        label: 'Seed',
        overrides: {
          title: 'Real Title',
          authors: ['Ada Lovelace', 'Alan Turing'],
          venue: 'ICLR 2024 Workshop',
          year: 2024,
          url: 'https://openreview.net/forum?id=x',
        },
      },
    ]);
  });

  const seedWith = (fields: Record<string, unknown>) => ({ seeds: [{ id: SEED, label: 'S', ...fields }] });

  it.each([
    [seedWith({ title: ' ' }), '`seeds[0].title` must be a non-empty string'],
    [seedWith({ url: 5 }), '`seeds[0].url` must be a non-empty string'],
    [seedWith({ year: '2024' }), '`seeds[0].year` must be a whole number'],
    [seedWith({ authors: 'Ada' }), '`seeds[0].authors` must be a list of names'],
    [seedWith({ authors: ['Ada', ''] }), '`seeds[0].authors` must be a list of names'],
    [seedWith({ titel: 'typo' }), '`seeds[0]` has an unknown field `titel`'],
  ])('rejects invalid seed overrides %j', (raw, error) => {
    expect(() => parsePapersConfig(raw)).toThrow(`Invalid static/data/papers.yaml: ${error}`);
  });

  it.each([
    [null, '`seeds` must be a non-empty list'],
    [{ seeds: [] }, '`seeds` must be a non-empty list'],
    [{ seeds: [null] }, '`seeds[0].id` must be a Semantic Scholar paperId'],
    [{ seeds: [{ id: 'DOI:10.1/x', label: 'S' }] }, '`seeds[0].id` must be a Semantic Scholar paperId'],
    [{ seeds: [{ id: SEED, label: ' ' }] }, '`seeds[0].label` must be set'],
    [{ seeds: [{ id: SEED, label: 'S' }], include: 'x' }, '`include` must be a list'],
    [{ seeds: [{ id: SEED, label: 'S' }], exclude: [{ note: 'no id' }] }, '`exclude[0]` must have an `id`'],
    [{ seeds: [{ id: SEED, label: 'S' }], exclude: [null] }, '`exclude[0]` must have an `id`'],
    [{ seeds: [{ id: SEED, label: 'S' }], include: ['CorpusId:1'] }, '`include[0]` must have an `id`'],
  ])('rejects %j', (raw, error) => {
    expect(() => parsePapersConfig(raw)).toThrow(`Invalid static/data/papers.yaml: ${error}`);
  });
});

describe('papersSource', () => {
  it('uses PAPERS_SOURCE if set, else fetches live only for production builds', () => {
    expect(papersSource({ PAPERS_SOURCE: ' LIVE ', NODE_ENV: 'development' })).toBe('live');
    expect(papersSource({ PAPERS_SOURCE: 'snapshot', NODE_ENV: 'production' })).toBe('snapshot');
    expect(papersSource({ PAPERS_SOURCE: 'bogus', NODE_ENV: 'production' })).toBe('live');
    expect(papersSource({ NODE_ENV: 'production' })).toBe('live');
    expect(papersSource({ NODE_ENV: 'development' })).toBe('snapshot');
    expect(papersSource({})).toBe('snapshot');
  });
});

describe('with a site directory', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let siteDir: string;
  let snapshotPath: string;

  const writeYaml = (seeds: string[], extra = '') =>
    fs.writeFile(
      path.join(siteDir, 'static', 'data', 'papers.yaml'),
      `seeds:\n${seeds.map(id => `  - id: '${id}'\n    label: 'Seed ${id[0]}'`).join('\n')}\n${extra}`
    );

  const snapshot: PapersData = {
    updatedAt: '2026-01-01T00:00:00.000Z',
    seeds: [
      {
        id: SEED,
        label: 'Seed a',
        title: 'Saved seed',
        authors: [],
        venue: null,
        year: 2024,
        publicationDate: null,
        doi: null,
        arxivId: null,
        url: 'https://example.org/seed',
        citationCount: 3,
      },
    ],
    papers: [
      {
        id: 'saved',
        title: 'Saved citing paper',
        authors: ['Grace Hopper'],
        venue: 'ML4H',
        year: 2025,
        publicationDate: '2025-12-01',
        doi: null,
        arxivId: null,
        url: 'https://example.org/saved',
        citationCount: 0,
        cites: [SEED],
      },
    ],
  };
  const writeSnapshot = (data: unknown = snapshot) => fs.writeFile(snapshotPath, JSON.stringify(data));

  /** Routes Semantic Scholar requests: one seed with one citing paper. `overrides` replace responses by URL prefix. */
  const mockFetch = (overrides: Record<string, () => Response> = {}) =>
    jest.fn<FetchFn>(async url => {
      const route = url.replace(API, '');
      for (const [prefix, respond] of Object.entries(overrides))
        if (route.startsWith(prefix)) return respond();
      if (route.startsWith('/paper/batch')) return json(200, [s2(SEED, { title: 'Live seed' })]);
      if (route.startsWith(`/paper/${SEED}/citations`))
        return json(200, { data: [{ citingPaper: s2('live') }] });
      return json(404);
    });

  const fastClient = (fetchFn: FetchFn): S2ClientOptions => ({ fetchFn, ...fakeClock() });
  const now = () => new Date('2026-11-06T12:00:00.000Z');

  beforeEach(async () => {
    siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'papers-'));
    await fs.mkdir(path.join(siteDir, 'static', 'data'), { recursive: true });
    snapshotPath = path.join(siteDir, 'static', 'data', 'papers.snapshot.json');
    await writeYaml([SEED]);
    delete process.env.SEMANTIC_SCHOLAR_API_KEY;
    delete process.env.PAPERS_SOURCE;
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    await fs.rm(siteDir, { recursive: true, force: true });
  });

  describe('readSnapshot', () => {
    it('reads a valid snapshot', async () => {
      await writeSnapshot();
      expect(await readSnapshot(snapshotPath)).toEqual({ snapshot });
    });

    it('explains why a snapshot is unusable', async () => {
      expect(await readSnapshot(snapshotPath)).toEqual({ snapshot: null, problem: 'it does not exist' });
      await fs.writeFile(snapshotPath, '{ not json');
      expect((await readSnapshot(snapshotPath)).problem).toMatch(/^it could not be read: .*JSON/);
      await writeSnapshot({ seeds: 'nope' });
      expect(await readSnapshot(snapshotPath)).toEqual({
        snapshot: null,
        problem: 'it is not in the expected format',
      });
    });
  });

  describe('loadPapers', () => {
    it('fetches live and dates the data now when everything succeeds', async () => {
      await writeSnapshot();
      const fetchFn = mockFetch();
      const result = await loadPapers(siteDir, {
        env: { SEMANTIC_SCHOLAR_API_KEY: ' key ' },
        source: 'live',
        client: fastClient(fetchFn),
        now,
      });

      expect(result.warning).toBe(false);
      expect(result.message).toBe('Fetched 1 papers citing 1 MEDS papers from Semantic Scholar.');
      expect(result.data.updatedAt).toBe('2026-11-06T12:00:00.000Z');
      expect(result.data.seeds.map(seed => seed.title)).toEqual(['Live seed']);
      expect(result.data.papers.map(paper => paper.id)).toEqual(['live']);
      expect((fetchFn.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBe('key');
    });

    it('retries rate-limited requests', async () => {
      let limited = 2;
      const fetchFn = mockFetch({
        '/paper/batch': () => (limited-- > 0 ? json(429) : json(200, [s2(SEED)])),
      });
      const result = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchFn), now });
      expect(result.warning).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(4);
    });

    it('falls back to the snapshot, keeping its date, when the fetch fails', async () => {
      await writeSnapshot();
      const fetchFn = mockFetch({ '/paper': () => json(429) });
      const result = await loadPapers(siteDir, {
        env: {},
        source: 'live',
        client: { ...fastClient(fetchFn), maxRetries: 1 },
        now,
      });

      expect(result.warning).toBe(true);
      expect(result.data).toEqual(snapshot);
      expect(result.message).toContain('Could not fetch everything from Semantic Scholar');
      expect(result.message).toContain('as of 2026-01-01T00:00:00.000Z');
      expect(result.message).toContain('details of the seed and included papers: HTTP 429');
      expect(result.message).toContain(
        'Taken from the snapshot instead: details of Seed a; papers citing Seed a.'
      );
      expect(result.message).toContain('SEMANTIC_SCHOLAR_API_KEY is not set');
    });

    it('warns without blaming the key when one is set, and reports what is missing from the snapshot', async () => {
      const fetchFn = mockFetch({ '/paper': () => json(500) });
      const result = await loadPapers(siteDir, {
        env: { SEMANTIC_SCHOLAR_API_KEY: 'key' },
        source: 'live',
        client: { ...fastClient(fetchFn), maxRetries: 0 },
      });

      expect(result.data).toMatchObject({ updatedAt: null, papers: [] });
      expect(result.message).toContain('as of never');
      expect(result.message).toContain('Missing (not in the snapshot either)');
      expect(result.message).toContain(
        'Snapshot static/data/papers.snapshot.json unavailable: it does not exist.'
      );
      expect(result.message).not.toContain('SEMANTIC_SCHOLAR_API_KEY');
    });

    it('uses only the snapshot when asked to, without making requests', async () => {
      await writeSnapshot();
      const fetchFn = mockFetch();
      const result = await loadPapers(siteDir, { env: { NODE_ENV: 'development' }, client: { fetchFn } });

      expect(fetchFn).not.toHaveBeenCalled();
      expect(result.warning).toBe(false);
      expect(result.data.updatedAt).toBe(snapshot.updatedAt);
      expect(result.message).toBe(
        'Using the snapshot from 2026-01-01T00:00:00.000Z (1 papers citing 1 MEDS papers). ' +
          'Set PAPERS_SOURCE=live to fetch from Semantic Scholar instead.'
      );

      // A seed that the snapshot doesn't have yet is worth a warning.
      await writeYaml([SEED, OTHER_SEED]);
      const newSeed = await loadPapers(siteDir, { source: 'snapshot' });
      expect(newSeed.warning).toBe(true);
      expect(newSeed.message).toMatch(
        /^Using the snapshot; the papers page lists 1 papers citing 2 MEDS papers/
      );
      expect(newSeed.message).not.toContain('SEMANTIC_SCHOLAR_API_KEY');
    });

    it('fails on an invalid papers.yaml', async () => {
      await fs.writeFile(path.join(siteDir, 'static', 'data', 'papers.yaml'), 'seeds: []\n');
      await expect(loadPapers(siteDir, { source: 'snapshot' })).rejects.toThrow(
        '`seeds` must be a non-empty list'
      );
    });
  });

  describe('updatePapersSnapshot', () => {
    it('fetches live whatever the environment, and writes the result to the snapshot', async () => {
      process.env.PAPERS_SOURCE = 'snapshot';
      const fetchFn = mockFetch();
      const result = await updatePapersSnapshot(siteDir, { client: fastClient(fetchFn), now });

      expect(fetchFn).toHaveBeenCalled();
      expect(result.warning).toBe(false);
      const written = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
      expect(written).toEqual(result.data);
      expect(written.papers.map((paper: { id: string }) => paper.id)).toEqual(['live']);
    });

    it('uses the global fetch by default, as `npm run papers:update` does', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      const { data } = await updatePapersSnapshot(siteDir);

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(JSON.parse(await fs.readFile(snapshotPath, 'utf8'))).toEqual(data);
    });
  });

  describe('papersPlugin', () => {
    const contentLoaded = async (plugin: ReturnType<typeof papersPlugin>, content: unknown) => {
      const setGlobalData = jest.fn();
      await plugin.contentLoaded?.({
        content,
        actions: { setGlobalData } as unknown as PluginContentLoadedActions,
      });
      return setGlobalData;
    };

    it('fetches live in production builds and publishes the papers as global data', async () => {
      process.env.NODE_ENV = 'production';
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      const plugin = papersPlugin({ siteDir } as LoadContext);

      expect(plugin.name).toBe('papers');
      expect(plugin.getPathsToWatch?.()).toEqual([
        path.join(siteDir, 'static', 'data', 'papers.yaml'),
        snapshotPath,
      ]);

      const content = (await plugin.loadContent?.()) as PapersData;
      expect(content.papers.map(paper => paper.id)).toEqual(['live']);
      expect(console.info).toHaveBeenCalledWith(
        '[papers] Fetched 1 papers citing 1 MEDS papers from Semantic Scholar.'
      );
      expect(console.warn).not.toHaveBeenCalled();
      expect(await contentLoaded(plugin, content)).toHaveBeenCalledWith(content);
    });

    it('retries a 429 during the build', async () => {
      process.env.NODE_ENV = 'production';
      let limited = true;
      const fetchFn = mockFetch({
        '/paper/batch': () => {
          if (!limited) return json(200, [s2(SEED)]);
          limited = false;
          return json(429, {}, { 'Retry-After': '0' });
        },
      });
      globalThis.fetch = fetchFn as unknown as typeof fetch;

      const content = (await papersPlugin({ siteDir } as LoadContext).loadContent?.()) as PapersData;
      expect(fetchFn).toHaveBeenCalledTimes(3);
      expect(content.papers.map(paper => paper.id)).toEqual(['live']);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('falls back to the snapshot with a single warning when Semantic Scholar is unreachable', async () => {
      process.env.NODE_ENV = 'production';
      await writeSnapshot();
      globalThis.fetch = jest.fn<FetchFn>(async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch;

      const content = await papersPlugin({ siteDir } as LoadContext).loadContent?.();
      expect(content).toEqual(snapshot);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(jest.mocked(console.warn).mock.calls[0][0]).toContain('[papers] Could not fetch everything');
      expect(jest.mocked(console.warn).mock.calls[0][0]).toContain('papers citing Seed a: fetch failed');
    });

    it('uses the snapshot on the dev server', async () => {
      process.env.NODE_ENV = 'development';
      await writeSnapshot();
      const fetchFn = jest.fn<FetchFn>();
      globalThis.fetch = fetchFn as unknown as typeof fetch;

      expect(await papersPlugin({ siteDir } as LoadContext).loadContent?.()).toEqual(snapshot);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[papers] Using the snapshot'));
    });
  });
});
