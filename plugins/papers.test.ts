import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LoadContext, PluginContentLoadedActions } from '@docusaurus/types';
import papersPlugin, {
  createApiClient,
  fetchFromSemanticScholar,
  fetchInstitutionRecords,
  fetchInstitutionsFromOpenAlex,
  findInstitutionIcons,
  loadPapers,
  papersSource,
  parsePapersConfig,
  readSnapshot,
  retryAfterMs,
  updateInstitutionIcons,
  updatePapersSnapshot,
  type ApiClientOptions,
  type ApiRequest,
} from './papers';
import { parse } from 'yaml';
import {
  institutionLocations,
  institutionRenamer,
  normalizePaper,
  paperMatchesId,
  showInstitutions,
  type OpenAlexWork,
  type PapersConfig,
  type S2Paper,
} from '../src/lib/papers/normalize';
import type { Paper, PapersData } from '../src/lib/papers/types';

const SEED = 'a'.repeat(40);
const OTHER_SEED = 'b'.repeat(40);
const API = 'https://api.semanticscholar.org/graph/v1';
const OPENALEX = 'https://api.openalex.org';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers });

const s2 = (paperId: string, overrides: Partial<S2Paper> = {}): S2Paper => ({
  paperId,
  title: `Paper ${paperId}`,
  year: 2025,
  authors: [{ name: 'Ada Lovelace' }],
  externalIds: {},
  ...overrides,
});

/** A made-up OpenAlex institution id, as a URL. */
const openAlexId = (name: string): string => `https://openalex.org/I${name.replace(/\W/g, '')}`;

/** A PNG's signature and a few more bytes, as the favicon service returns. */
const png = (): Response =>
  new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]), { status: 200 });

/** An OpenAlex work by Ada Lovelace, with an author at each of `institutions`. */
const work = (title: string, institutions: string[], doi: string | null = null): OpenAlexWork => ({
  doi: doi && `https://doi.org/${doi}`,
  title,
  authorships: [
    {
      author: { display_name: 'Ada Lovelace' },
      institutions: institutions.map(name => ({ id: openAlexId(name), display_name: name })),
    },
  ],
});

/** A fake clock: `sleep` advances it instantly and records each delay. */
function fakeClock(start = 0): Required<Pick<ApiClientOptions, 'sleep' | 'now'>> & { sleeps: number[] } {
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

describe('createApiClient', () => {
  it('sends GETs and POSTs, with the API key only when one is given', async () => {
    const fetchFn = jest.fn<FetchFn>(async () => json(200, { ok: true }));
    const clock = fakeClock();
    const withKey = createApiClient({ fetchFn, apiKey: 'secret', ...clock });
    await expect(withKey('/paper/x')).resolves.toEqual({ ok: true });
    await withKey('/paper/batch', { ids: ['x'] });
    await createApiClient({ fetchFn, ...clock })('/paper/y');

    const [[getUrl, get], [, post], [, anonymous]] = fetchFn.mock.calls;
    expect(getUrl).toBe(`${API}/paper/x`);
    expect(get).toMatchObject({ method: 'GET', body: undefined });
    expect(get?.headers).toEqual({ 'User-Agent': expect.any(String), 'x-api-key': 'secret' });
    expect(post).toMatchObject({ method: 'POST', body: JSON.stringify({ ids: ['x'] }) });
    expect(post?.headers).toMatchObject({ 'Content-Type': 'application/json', 'x-api-key': 'secret' });
    expect(anonymous?.headers).not.toHaveProperty('x-api-key');
  });

  it('sends requests to another API at `baseUrl`', async () => {
    const fetchFn = jest.fn<FetchFn>(async () => json(200, {}));
    await createApiClient({ fetchFn, baseUrl: OPENALEX, ...fakeClock() })('/works?filter=doi:x');
    expect(fetchFn.mock.calls[0][0]).toBe(`${OPENALEX}/works?filter=doi:x`);
  });

  it('spaces requests out by the minimum interval', async () => {
    const clock = fakeClock();
    const request = createApiClient({ fetchFn: async () => json(200), minIntervalMs: 1000, ...clock });
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
    const request = createApiClient({ fetchFn, minIntervalMs: 0, baseDelayMs: 100, ...clock });

    await expect(request('/x')).resolves.toEqual({ data: 'finally' });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(clock.sleeps).toEqual([7000, 200, 400]);
  });

  it('gives up after maxRetries, and does not retry other errors', async () => {
    const clock = fakeClock();
    const limited = createApiClient({
      fetchFn: async () => json(429),
      maxRetries: 2,
      minIntervalMs: 0,
      ...clock,
    });
    await expect(limited('/x')).rejects.toThrow('HTTP 429');
    expect(clock.sleeps).toHaveLength(2);

    const fetchFn = jest.fn<FetchFn>(async () => json(404));
    await expect(createApiClient({ fetchFn, ...clock })('/x')).rejects.toThrow('HTTP 404');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('stops retrying, and sending requests, once the time budget is used up', async () => {
    const clock = fakeClock();
    const fetchFn = jest.fn<FetchFn>(async () => json(429, {}, { 'Retry-After': '60' }));
    const request = createApiClient({ fetchFn, budgetMs: 30_000, minIntervalMs: 1000, ...clock });
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
      const request = createApiClient({ minIntervalMs: 5 });
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
    include: [
      { id: 'DOI:10.1/x' },
      { id: 'ARXIV:0000.00000' },
      { id: 'DOI:10.1/own', overrides: { title: 'Own' } },
    ],
    exclude: [],
    merge: [],
    affiliations: [],
    institutions: [],
  };

  it('fetches the seeds and included papers in one batch, then every page of citations', async () => {
    const request = jest.fn(async (pathAndQuery: string, body?: unknown) => {
      if (pathAndQuery.startsWith('/paper/batch')) {
        expect(body).toEqual({ ids: [SEED, OTHER_SEED, 'DOI:10.1/x', 'ARXIV:0000.00000', 'DOI:10.1/own'] });
        // Nothing for the last paper at all, which Semantic Scholar should not do, but counts as not found.
        return [s2(SEED), null, s2('included'), null];
      }
      if (pathAndQuery.includes(`${SEED}/citations`) && pathAndQuery.endsWith('offset=0')) {
        return { next: 1000, data: [{ citingPaper: s2('c1') }, { citingPaper: null }] };
      }
      if (pathAndQuery.includes(`${SEED}/citations`)) return { data: [{ citingPaper: s2('c2') }] };
      return { next: 0, data: undefined }; // A `next` that doesn't advance must not loop forever.
    }) as unknown as ApiRequest;

    const { live, failures } = await fetchFromSemanticScholar(config, request);

    expect([...live.seeds.keys()]).toEqual([SEED]);
    // Included papers that Semantic Scholar doesn't have are recorded as such (null).
    expect([...live.included]).toEqual([
      ['DOI:10.1/x', s2('included')],
      ['ARXIV:0000.00000', null],
      ['DOI:10.1/own', null],
    ]);
    expect(live.citations.get(SEED)?.map(p => p.paperId)).toEqual(['c1', 'c2']);
    expect(live.citations.get(OTHER_SEED)).toEqual([]);
    expect(live.incompleteSeeds.size).toBe(0);
    // An included paper with a title in papers.yaml is listed from it, so its absence is no failure.
    expect(failures).toEqual([
      `${OTHER_SEED}: not found on Semantic Scholar`,
      'ARXIV:0000.00000: not found on Semantic Scholar',
    ]);
    expect(jest.mocked(request).mock.calls[1][0]).toBe(
      `/paper/${SEED}/citations?fields=title,year,venue,publicationVenue,authors,externalIds,url,publicationDate&limit=1000&offset=0`
    );
  });

  it('reports failures and keeps partial citation lists', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.startsWith('/paper/batch')) throw new Error('HTTP 429');
      if (pathAndQuery.endsWith('offset=0') && pathAndQuery.includes(SEED)) {
        return { next: 1000, data: [{ citingPaper: s2('c1') }] };
      }
      throw 'offline';
    }) as unknown as ApiRequest;

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

describe('fetchInstitutionsFromOpenAlex', () => {
  const paper = (id: string, title: string, externalIds: Record<string, string> = {}): Paper =>
    normalizePaper(s2(id, { title, externalIds })) as Paper;
  const papers = [
    paper('by-doi', 'Found By DOI', { DOI: '10.1/A' }),
    paper('preprint', 'A Preprint: Later Published', { ArXiv: '2401.00002' }),
    paper('nowhere', 'Not On OpenAlex'),
    paper('odd-doi', 'Odd DOI', { DOI: '10.1/a,b' }),
  ];

  it('looks papers up by DOI in one request, then by title those it could not find institutions for', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.includes('filter=doi:')) {
        return {
          results: [
            work('Found By DOI', ['University A', 'University B'], '10.1/a'),
            work('A Preprint: Later Published', [], '10.48550/arxiv.2401.00002'),
          ],
        };
      }
      if (pathAndQuery.includes('title.search:a%20preprint%20later%20published&')) {
        return {
          results: [
            work('A Preprint: Later Published', []), // The record found by DOI.
            work('A Preprint: Later Published, Extended', ['Other Title University']),
            {
              title: 'A preprint: later published',
              authorships: [
                {
                  author: { display_name: 'Alan Turing' },
                  institutions: [{ display_name: 'Other Authors' }],
                },
              ],
            },
            work('A preprint: later <i>published</i>', ['Published University']),
          ],
        };
      }
      return { results: pathAndQuery.includes('odd%20doi') ? [work('Odd DOI', ['Odd University'])] : [] };
    }) as unknown as ApiRequest;

    const { institutions, ids, failures } = await fetchInstitutionsFromOpenAlex(papers, request, 'key');

    expect(failures).toEqual([]);
    expect([...institutions]).toEqual([
      ['by-doi', ['University A', 'University B']],
      ['preprint', ['Published University']],
      ['nowhere', []],
      ['odd-doi', ['Odd University']],
    ]);
    // Only institutions of the records used, not of rejected title matches.
    expect([...ids]).toEqual([
      ['University A', 'IUniversityA'],
      ['University B', 'IUniversityB'],
      ['Published University', 'IPublishedUniversity'],
      ['Odd University', 'IOddUniversity'],
    ]);
    const paths = jest.mocked(request).mock.calls.map(([pathAndQuery]) => pathAndQuery);
    expect(paths).toEqual([
      '/works?filter=doi:10.1%2Fa|10.48550%2Farxiv.2401.00002&per_page=100&select=doi,title,authorships&api_key=key',
      '/works?filter=title.search:a%20preprint%20later%20published&per_page=5&select=doi,title,authorships&api_key=key',
      '/works?filter=title.search:not%20on%20openalex&per_page=5&select=doi,title,authorships&api_key=key',
      '/works?filter=title.search:odd%20doi&per_page=5&select=doi,title,authorships&api_key=key',
    ]);
  });

  it('records each institution id once, skips institutions without one, and copes with empty responses', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.includes('filter=doi:')) {
        const second = work('Second', ['University A', 'No Id University'], '10.1/second');
        // OpenAlex doesn't always know an institution's id.
        delete (second.authorships?.[0].institutions?.[1] as { id?: string }).id;
        return { results: [work('First', ['University A'], '10.1/first'), second] };
      }
      return {}; // No `results` at all.
    }) as unknown as ApiRequest;

    const { institutions, ids, failures } = await fetchInstitutionsFromOpenAlex(
      [
        paper('first', 'First', { DOI: '10.1/first' }),
        paper('second', 'Second', { DOI: '10.1/second' }),
        paper('untitled', 'Not Found'),
      ],
      request
    );

    expect(failures).toEqual([]);
    expect([...institutions]).toEqual([
      ['first', ['University A']],
      ['second', ['University A', 'No Id University']],
      ['untitled', []],
    ]);
    expect([...ids]).toEqual([['University A', 'IUniversityA']]);
  });

  it('reports failures, leaving out the papers whose lookup failed', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.includes('filter=doi:')) throw new Error('HTTP 429');
      throw 'offline';
    }) as unknown as ApiRequest;

    const { institutions, failures } = await fetchInstitutionsFromOpenAlex(papers, request);

    expect(institutions.size).toBe(0);
    expect(failures).toEqual([
      'institutions of 2 papers, by DOI: HTTP 429',
      'institutions of 2 papers, by title: offline',
    ]);
    // Papers whose DOI lookup failed are not looked up by title too.
    expect(jest.mocked(request)).toHaveBeenCalledTimes(3);
    expect(jest.mocked(request).mock.calls[0][0]).not.toContain('api_key');
  });
});

describe('fetchInstitutionRecords', () => {
  /** An OpenAlex institution record, as the API returns it. */
  const institution = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id: `https://openalex.org/${id}`,
    display_name: name,
    lineage: [`https://openalex.org/${id}`],
    geo: { city: 'City', country_code: 'XX', latitude: 1, longitude: 2 },
    homepage_url: `https://${id.toLowerCase()}.example/`,
    ...extra,
  });

  it('looks institutions up by id, 50 per request, and the others by exact name', async () => {
    const names = Array.from({ length: 51 }, (_, i) => `University ${i}`);
    const ids = new Map(names.map((name, i) => [name, `I${i}`]));
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.includes('filter=id:')) {
        const batch = /filter=id:([^&]*)/.exec(pathAndQuery)?.[1].split('|') ?? [];
        // I1 isn't on OpenAlex (any more).
        return { results: batch.filter(id => id !== 'I1').map(id => institution(id, `Name of ${id}`)) };
      }
      if (pathAndQuery.includes('display_name.search:named%20hospital&')) {
        return {
          results: [
            institution('I100', 'Named Hospital Foundation'),
            institution('I101', 'Named Hospital', { lineage: ['https://openalex.org/I0'], geo: null }),
          ],
        };
      }
      return { results: [] };
    }) as unknown as ApiRequest;

    const lookup = await fetchInstitutionRecords(
      [...names, 'Named Hospital', 'Unknown'],
      ids,
      request,
      'key'
    );

    expect(lookup.failures).toEqual([]);
    expect(lookup.failed.size).toBe(0);
    expect(lookup.records.size).toBe(51);
    expect(lookup.records.get('University 0')).toEqual({
      id: 'I0',
      partOf: [],
      location: { latitude: 1, longitude: 2, city: 'City', country: 'XX' },
    });
    expect(lookup.records.has('University 1')).toBe(false);
    expect(lookup.records.get('Named Hospital')).toEqual({ id: 'I101', partOf: ['I0'], location: null });
    expect(lookup.homepages.get('Named Hospital')).toBe('https://i101.example/');
    expect(lookup.records.has('Unknown')).toBe(false);
    const paths = jest.mocked(request).mock.calls.map(([pathAndQuery]) => pathAndQuery);
    expect(paths).toHaveLength(4);
    expect(paths[0]).toMatch(/^\/institutions\?filter=id:I0\|I1\|.*\|I49&per_page=50&/);
    expect(paths[0]).toContain('&select=id,display_name,lineage,geo,homepage_url&api_key=key');
    expect(paths[1]).toMatch(/^\/institutions\?filter=id:I50&/);
    expect(paths[2]).toBe(
      '/institutions?filter=display_name.search:named%20hospital&per_page=5' +
        '&select=id,display_name,lineage,geo,homepage_url&api_key=key'
    );
  });

  it('copes with records and responses that lack fields', async () => {
    const request = jest.fn(async (pathAndQuery: string) => {
      if (pathAndQuery.includes('filter=id:')) {
        return {
          results: [
            institution('I1', 'No Homepage', { homepage_url: null }),
            { display_name: 'No Id' },
            null,
          ],
        };
      }
      if (pathAndQuery.includes('nameless')) return { results: [null, { id: 'https://openalex.org/I9' }] };
      return {}; // No `results` at all.
    }) as unknown as ApiRequest;

    const lookup = await fetchInstitutionRecords(
      ['No Homepage', 'Missing', 'Nameless', 'Empty'],
      new Map([
        ['No Homepage', 'I1'],
        ['Missing', 'I2'],
      ]),
      request
    );

    expect([...lookup.records.keys()]).toEqual(['No Homepage']);
    expect(lookup.homepages.size).toBe(0);
    expect(lookup.failures).toEqual([]);
  });

  it('reports the institutions whose lookup failed', async () => {
    const request = jest.fn(async () => {
      throw new Error('HTTP 429');
    }) as unknown as ApiRequest;

    const lookup = await fetchInstitutionRecords(
      ['By Id', 'By Name', 'Also By Name'],
      new Map([['By Id', 'I1']]),
      request
    );

    expect(lookup.records.size).toBe(0);
    expect([...lookup.failed]).toEqual(['By Id', 'By Name', 'Also By Name']);
    expect(lookup.failures).toEqual([
      'details of 1 institutions: HTTP 429',
      'details of 2 institutions, by name: HTTP 429',
    ]);
    expect(jest.mocked(request).mock.calls[0][0]).not.toContain('api_key');
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
      include: [{ id: 'DOI:10.1/X' }, { id: 'ARXIV:2401.00001' }, { id: OTHER_SEED }],
      exclude: [],
      merge: [],
      affiliations: [],
      institutions: [],
    });
  });

  it("parses an included paper's details, and ignores any but the id of an excluded paper", () => {
    const details = {
      title: ' A Thesis ',
      authors: ['Ada Lovelace'],
      venue: 'PhD thesis, University of Example',
      year: 2026,
      url: 'https://example.org/thesis',
    };
    expect(
      parsePapersConfig({
        seeds: [{ id: SEED, label: 'Seed' }],
        include: [{ id: 'DOI:10.1/thesis', note: 'why', ...details }],
        exclude: [{ id: 'DOI:10.1/other', title: 'Not checked' }],
      })
    ).toEqual({
      seeds: [{ id: SEED, label: 'Seed' }],
      include: [{ id: 'DOI:10.1/thesis', overrides: { ...details, title: 'A Thesis' } }],
      exclude: ['DOI:10.1/other'],
      merge: [],
      affiliations: [],
      institutions: [],
    });
  });

  it("parses institutions' renames, homepages and whether they are kept separate", () => {
    expect(
      parsePapersConfig({
        seeds: [{ id: SEED, label: 'Seed' }],
        institutions: [
          { name: ' Institut national ', rename: ' Inria ', note: 'why' },
          { name: 'GSK plc', homepage: ' https://www.gsk.com ' },
          { name: 'Hospital', separate: true, note: 'Wrong lineage.' },
        ],
      }).institutions
    ).toEqual([
      { name: 'Institut national', rename: 'Inria' },
      { name: 'GSK plc', homepage: 'https://www.gsk.com' },
      { name: 'Hospital', separate: true },
    ]);
  });

  it.each([
    [{ institutions: 'x' }, '`institutions` must be a list'],
    [{ institutions: [{ rename: 'X' }] }, '`institutions[0].name` must be a non-empty string'],
    [{ institutions: [null] }, '`institutions[0].name` must be a non-empty string'],
    [{ institutions: [{ name: 'X', rename: ' ' }] }, '`institutions[0].rename` must be a non-empty string'],
    [
      { institutions: [{ name: 'X', homepage: 'www.x.org' }] },
      '`institutions[0].homepage` must be an http(s) URL',
    ],
    [{ institutions: [{ name: 'X', homepage: 5 }] }, '`institutions[0].homepage` must be an http(s) URL'],
    [{ institutions: [{ name: 'X' }] }, '`institutions[0]` must set `rename`, `homepage` or `separate`'],
    [{ institutions: [{ name: 'X', separate: false }] }, '`institutions[0].separate` must be `true`'],
    [{ institutions: [{ name: 'X', separate: 'yes' }] }, '`institutions[0].separate` must be `true`'],
    [
      { institutions: [{ name: 'X', rename: 'Y', icon: 'z' }] },
      '`institutions[0]` has an unknown field `icon`',
    ],
  ])('rejects invalid institutions %j', (fields, error) => {
    expect(() => parsePapersConfig({ seeds: [{ id: SEED, label: 'S' }], ...fields })).toThrow(
      `Invalid static/data/papers.yaml: ${error}`
    );
  });

  it('parses the records to merge into others, normalising their identifiers', () => {
    expect(
      parsePapersConfig({
        seeds: [{ id: SEED, label: 'Seed' }],
        merge: [
          { id: 'doi:10.1101/X', into: 'arxiv:2505.20323v2', note: 'Same abstract.' },
          { id: OTHER_SEED.toUpperCase(), into: SEED },
        ],
      }).merge
    ).toEqual([
      { id: 'DOI:10.1101/X', into: 'ARXIV:2505.20323' },
      { id: OTHER_SEED, into: SEED },
    ]);
  });

  it.each([
    [{ merge: 'x' }, '`merge` must be a list'],
    [{ merge: [{ into: 'DOI:10.1/a' }] }, '`merge[0]` must have an `id`'],
    [{ merge: [{ id: 'DOI:10.1/a' }] }, '`merge[0].into` must be a Semantic Scholar paperId'],
    [
      { merge: [{ id: 'DOI:10.1/a', into: 'CorpusId:1' }] },
      '`merge[0].into` must be a Semantic Scholar paperId',
    ],
    [{ merge: [{ id: 'doi:10.1/a', into: 'DOI:10.1/a' }] }, '`merge[0]` merges a paper into itself'],
    [
      {
        merge: [
          { id: 'DOI:10.1/a', into: 'DOI:10.1/b' },
          { id: 'DOI:10.1/b', into: 'DOI:10.1/c' },
        ],
      },
      '`merge[0].into` is itself merged into another paper',
    ],
    [
      { merge: [{ id: 'DOI:10.1/a', into: 'DOI:10.1/b', title: 'T' }] },
      '`merge[0]` has an unknown field `title`',
    ],
  ])('rejects invalid merges %j', (fields, error) => {
    expect(() => parsePapersConfig({ seeds: [{ id: SEED, label: 'S' }], ...fields })).toThrow(
      `Invalid static/data/papers.yaml: ${error}`
    );
  });

  it("parses papers' affiliations, without duplicate institutions", () => {
    expect(
      parsePapersConfig({
        seeds: [{ id: SEED, label: 'Seed' }],
        affiliations: [
          {
            id: 'arxiv:2401.00001v2',
            note: 'From the PDF.',
            institutions: [' University A ', 'University A'],
          },
        ],
      }).affiliations
    ).toEqual([{ id: 'ARXIV:2401.00001', institutions: ['University A'] }]);
  });

  it.each([
    [{ institutions: [] }, '`affiliations[0].institutions` must be a non-empty list of names'],
    [{ institutions: 'University A' }, '`affiliations[0].institutions` must be a non-empty list of names'],
    [
      { institutions: ['University A', ' '] },
      '`affiliations[0].institutions` must be a non-empty list of names',
    ],
    [{ institutions: ['University A'], title: 'T' }, '`affiliations[0]` has an unknown field `title`'],
  ])('rejects invalid affiliations %j', (fields, error) => {
    expect(() =>
      parsePapersConfig({
        seeds: [{ id: SEED, label: 'S' }],
        affiliations: [{ id: 'DOI:10.1/x', ...fields }],
      })
    ).toThrow(`Invalid static/data/papers.yaml: ${error}`);
  });

  it.each([
    [{ year: 2026.5 }, '`include[0].year` must be a whole number'],
    [{ title: '' }, '`include[0].title` must be a non-empty string'],
    [{ label: 'Only seeds have labels' }, '`include[0]` has an unknown field `label`'],
  ])('rejects invalid details of an included paper %j', (fields, error) => {
    expect(() =>
      parsePapersConfig({ seeds: [{ id: SEED, label: 'S' }], include: [{ id: 'DOI:10.1/x', ...fields }] })
    ).toThrow(`Invalid static/data/papers.yaml: ${error}`);
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
        cites: [SEED],
        institutions: ['Saved University'],
      },
    ],
  };
  const writeSnapshot = (data: unknown = snapshot) => fs.writeFile(snapshotPath, JSON.stringify(data));

  /**
   * Routes Semantic Scholar requests (one seed with one citing paper) and OpenAlex ones (any search finds the citing
   * paper, with an author at Live University). `overrides` replace responses by URL prefix (without Semantic
   * Scholar's base URL).
   */
  const mockFetch = (overrides: Record<string, () => Response> = {}) =>
    jest.fn<FetchFn>(async url => {
      const route = url.replace(API, '');
      for (const [prefix, respond] of Object.entries(overrides))
        if (route.startsWith(prefix)) return respond();
      if (route.startsWith('/paper/batch')) return json(200, [s2(SEED, { title: 'Live seed' })]);
      if (route.startsWith(`/paper/${SEED}/citations`))
        return json(200, { data: [{ citingPaper: s2('live') }] });
      if (route.startsWith(`${OPENALEX}/works`))
        return json(200, { results: [work('Paper live', ['Live University'])] });
      if (route.startsWith(`${OPENALEX}/institutions`)) {
        return json(200, {
          results: [
            {
              id: openAlexId('Live University'),
              display_name: 'Live University',
              lineage: [openAlexId('Live University')],
              geo: { city: 'Live City', country_code: 'XX', latitude: 10, longitude: 20 },
              homepage_url: 'https://live.example.edu/',
            },
          ],
        });
      }
      if (route.startsWith('https://www.google.com/s2/favicons?domain=live.example.edu&sz=64')) return png();
      return json(404);
    });
  const iconsDir = () => path.join(siteDir, 'static', 'img', 'institutions');

  const fastClient = (fetchFn: FetchFn): ApiClientOptions => ({ fetchFn, ...fakeClock() });
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
      expect(result.message).toBe(
        'Fetched 1 papers citing 1 MEDS papers from Semantic Scholar, and their institutions from OpenAlex.'
      );
      expect(result.data.updatedAt).toBe('2026-11-06T12:00:00.000Z');
      expect(result.data.seeds.map(seed => seed.title)).toEqual(['Live seed']);
      expect(result.data.papers.map(paper => [paper.id, paper.institutions])).toEqual([
        ['live', ['Live University']],
      ]);
      expect((fetchFn.mock.calls[0][1]?.headers as Record<string, string>)['x-api-key']).toBe('key');
      // The Semantic Scholar key is not sent to OpenAlex.
      const [openAlexUrl, openAlexInit] = fetchFn.mock.calls[2];
      expect(openAlexUrl).toMatch(/^https:\/\/api\.openalex\.org\/works\?filter=title\.search:paper%20live&/);
      expect(openAlexInit?.headers).not.toHaveProperty('x-api-key');
    });

    it('sends OPENALEX_API_KEY to OpenAlex, and does not look up papers with affiliations in papers.yaml', async () => {
      const fetchFn = mockFetch();
      const result = await loadPapers(siteDir, {
        env: { OPENALEX_API_KEY: ' oa-key ' },
        source: 'live',
        client: fastClient(fetchFn),
        now,
      });
      expect(fetchFn.mock.calls[2][0]).toContain('&api_key=oa-key');
      expect(result.data.papers[0].institutions).toEqual(['Live University']);

      await writeYaml([SEED], "affiliations:\n  - id: 'DOI:10.1/LIVE'\n    institutions: ['From YAML']\n");
      const configured = mockFetch({
        [`/paper/${SEED}/citations`]: () =>
          json(200, { data: [{ citingPaper: s2('live', { externalIds: { DOI: '10.1/live' } }) }] }),
      });
      const fromYaml = await loadPapers(siteDir, { source: 'live', client: fastClient(configured), now });
      expect(fromYaml.warning).toBe(false);
      expect(fromYaml.data.papers[0].institutions).toEqual(['From YAML']);
      // Its work isn't looked up; its institution is, by name.
      const openAlexUrls = configured.mock.calls.map(([url]) => url).filter(url => url.startsWith(OPENALEX));
      expect(openAlexUrls).toEqual([
        expect.stringContaining('/institutions?filter=display_name.search:from%20yaml&'),
      ]);
    });

    it("takes institutions from the snapshot when OpenAlex can't be reached", async () => {
      await writeSnapshot({ ...snapshot, papers: [{ ...snapshot.papers[0], id: 'live' }] });
      const fetchFn = mockFetch({ [OPENALEX]: () => json(503) });
      const result = await loadPapers(siteDir, {
        env: {},
        source: 'live',
        client: { ...fastClient(fetchFn), maxRetries: 0 },
        now,
      });

      expect(result.warning).toBe(true);
      expect(result.data.updatedAt).toBe('2026-11-06T12:00:00.000Z');
      expect(result.data.papers.map(paper => [paper.title, paper.institutions])).toEqual([
        ['Paper live', ['Saved University']],
      ]);
      expect(result.message).toMatch(/^Could not fetch everything from OpenAlex; /);
      expect(result.message).toContain('institutions of 1 papers, by title: HTTP 503');
      expect(result.message).toContain('Taken from the snapshot instead: institutions of 1 papers.');
      expect(result.message).not.toContain('SEMANTIC_SCHOLAR_API_KEY');
    });

    it('retries rate-limited requests', async () => {
      let limited = 2;
      const fetchFn = mockFetch({
        '/paper/batch': () => (limited-- > 0 ? json(429) : json(200, [s2(SEED)])),
      });
      const result = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchFn), now });
      expect(result.warning).toBe(false);
      // 3 batch requests, the citations, and OpenAlex's work and institution.
      expect(fetchFn).toHaveBeenCalledTimes(6);
    });

    it('falls back to the snapshot, keeping its date, when the fetch fails', async () => {
      await writeSnapshot();
      const fetchFn = mockFetch({ '/paper': () => json(429), [OPENALEX]: () => json(429) });
      const result = await loadPapers(siteDir, {
        env: {},
        source: 'live',
        client: { ...fastClient(fetchFn), maxRetries: 1 },
        now,
      });

      expect(result.warning).toBe(true);
      expect(result.data).toEqual(snapshot);
      expect(result.message).toContain('Could not fetch everything from Semantic Scholar or OpenAlex');
      expect(result.message).toContain('as of 2026-01-01T00:00:00.000Z');
      expect(result.message).toContain('details of the seed and included papers: HTTP 429');
      expect(result.message).toContain(
        'Taken from the snapshot instead: details of Seed a; papers citing Seed a; institutions of 1 papers.'
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
          'Set PAPERS_SOURCE=live to fetch from Semantic Scholar and OpenAlex instead.'
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

    it('renames institutions as papers.yaml says, and passes on their locations and homepages', async () => {
      const location = { latitude: 10, longitude: 20, city: 'Live City', country: 'XX' };
      const fetched = await loadPapers(siteDir, { source: 'live', client: fastClient(mockFetch()), now });
      expect(fetched.data.institutions).toEqual({
        'Live University': { id: 'ILiveUniversity', partOf: [], location },
      });
      expect(fetched.institutionLocations).toEqual({ 'Live University': location });
      expect([...fetched.institutionHomepages]).toEqual([['Live University', 'https://live.example.edu/']]);

      await writeYaml(
        [SEED],
        "institutions:\n  - name: 'Live University'\n    rename: 'LU'\n    homepage: 'https://lu.example/'\n"
      );
      const result = await loadPapers(siteDir, { source: 'live', client: fastClient(mockFetch()), now });

      expect(result.data.papers.map(paper => paper.institutions)).toEqual([['LU']]);
      // Records keep OpenAlex's names; the page gets the names it shows.
      expect(Object.keys(result.data.institutions ?? {})).toEqual(['Live University']);
      expect(result.institutionLocations).toEqual({ LU: location });
      expect([...result.institutionHomepages]).toEqual([['LU', 'https://lu.example/']]);
    });

    describe('with institutions that are part of others', () => {
      const institution = (name: string, partOf: string[] = [], latitude = 1) => ({
        id: openAlexId(name),
        display_name: name,
        lineage: [name, ...partOf].map(openAlexId),
        geo: { city: null, country_code: null, latitude, longitude: 2 },
        homepage_url: `https://${name.split(' ')[0].toLowerCase()}.example/`,
      });
      const records = [
        institution('University', [], 1),
        institution('Medical School', ['University'], 2),
        institution('Teaching Hospital', ['University'], 3),
      ];
      const fetchWith = (overrides: Record<string, () => Response> = {}) =>
        mockFetch({
          [`${OPENALEX}/works`]: () =>
            json(200, {
              results: [work('Paper live', ['Medical School', 'University', 'Teaching Hospital'])],
            }),
          [`${OPENALEX}/institutions`]: () => json(200, { results: records }),
          ...overrides,
        });
      const yaml = "institutions:\n  - name: 'Teaching Hospital'\n    separate: true\n";

      it('shows them as those, unless papers.yaml keeps them separate, and stores every record', async () => {
        await writeYaml([SEED], yaml);
        const result = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchWith()), now });

        expect(result.warning).toBe(false);
        expect(result.data.papers.map(paper => paper.institutions)).toEqual([
          ['University', 'Teaching Hospital'],
        ]);
        expect(Object.keys(result.data.institutions ?? {})).toEqual([
          'Medical School',
          'Teaching Hospital',
          'University',
        ]);
        expect(result.data.institutions?.['Medical School'].partOf).toEqual(['IUniversity']);
        expect(Object.keys(result.institutionLocations)).toEqual(['University', 'Teaching Hospital']);
        expect(result.institutionLocations.University.latitude).toBe(1);
        expect([...result.institutionHomepages.keys()]).toEqual(['University', 'Teaching Hospital']);
      });

      it("uses the snapshot's records when OpenAlex's institutions can't be reached", async () => {
        await writeYaml([SEED], yaml);
        const first = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchWith()), now });
        await writeSnapshot(first.data);

        const failing = fetchWith({ [`${OPENALEX}/institutions`]: () => json(503) });
        const result = await loadPapers(siteDir, {
          source: 'live',
          client: { ...fastClient(failing), maxRetries: 0 },
          now,
        });
        expect(result.warning).toBe(true);
        expect(result.data.papers.map(paper => paper.institutions)).toEqual([
          ['University', 'Teaching Hospital'],
        ]);
        expect(result.data.institutions).toEqual(first.data.institutions);
        expect(result.institutionLocations).toEqual(first.institutionLocations);
        expect(result.message).toContain('details of 3 institutions: HTTP 503');
        expect(result.message).toContain('Taken from the snapshot instead: details of 3 institutions.');

        // The dev server rolls up the snapshot's institutions too.
        const { papers } = first.data;
        await writeSnapshot({
          ...first.data,
          papers: papers.map(p => ({ ...p, institutions: ['Medical School'] })),
        });
        const fromSnapshot = await loadPapers(siteDir, { source: 'snapshot' });
        expect(fromSnapshot.data.papers.map(paper => paper.institutions)).toEqual([['Medical School']]);
        await writeSnapshot({
          ...first.data,
          papers: papers.map(p => ({ ...p, institutions: ['Medical School', 'University'] })),
        });
        const rolledUp = await loadPapers(siteDir, { source: 'snapshot' });
        expect(rolledUp.data.papers.map(paper => paper.institutions)).toEqual([['University']]);
        expect(rolledUp.institutionLocations).toEqual({ University: first.institutionLocations.University });
      });

      it('looks institutions up by the id in the snapshot rather than by name', async () => {
        await writeYaml([SEED], "affiliations:\n  - id: 'DOI:10.1/LIVE'\n    institutions: ['University']\n");
        await writeSnapshot({
          ...snapshot,
          institutions: { University: { id: 'IUniversity', partOf: [], location: null } },
        });
        const fetchFn = fetchWith({
          [`/paper/${SEED}/citations`]: () =>
            json(200, { data: [{ citingPaper: s2('live', { externalIds: { DOI: '10.1/live' } }) }] }),
        });
        const result = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchFn), now });

        const openAlexUrls = fetchFn.mock.calls.map(([url]) => url).filter(url => url.startsWith(OPENALEX));
        expect(openAlexUrls).toEqual([expect.stringMatching(/\/institutions\?filter=id:IUniversity&/)]);
        expect(result.data.institutions?.University.location?.latitude).toBe(1);
      });
    });

    it("lists an included paper that Semantic Scholar doesn't have from its details, without a warning", async () => {
      await writeYaml([SEED], "include:\n  - id: 'DOI:10.1/thesis'\n    title: 'A Thesis'\n    year: 2026\n");
      const fetchFn = mockFetch({ '/paper/batch': () => json(200, [s2(SEED), null]) });
      const result = await loadPapers(siteDir, { source: 'live', client: fastClient(fetchFn), now });

      expect(result.warning).toBe(false);
      expect(
        result.data.papers.map(paper => [paper.id, paper.title, paper.manual, paper.institutions])
      ).toEqual([
        ['DOI:10.1/thesis', 'A Thesis', true, []],
        ['live', 'Paper live', undefined, ['Live University']],
      ]);
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
      expect(written).not.toHaveProperty('institutionIcons');
      expect(await fs.readdir(iconsDir())).toEqual(['live-university.png']);
      expect(result.message).toContain(
        'Institution icons: 1 downloaded, 0 removed; 0 institutions have none.'
      );
    });

    it('warns when icons could not be fetched', async () => {
      const fetchFn = mockFetch({ [`${OPENALEX}/institutions`]: () => json(500) });
      const result = await updatePapersSnapshot(siteDir, {
        client: { ...fastClient(fetchFn), maxRetries: 0 },
        now,
      });
      expect(result.warning).toBe(true);
      expect(result.message).toContain(
        'Institution icons: 0 downloaded, 0 removed; 1 institutions have none.'
      );
      expect(result.message).toContain('details of 1 institutions: HTTP 500');
    });

    it('reports icons that could not be fetched', async () => {
      const fetchFn = mockFetch({
        'https://www.google.com/s2/favicons?domain=live.example.edu': () => {
          throw new Error('offline');
        },
      });
      const result = await updatePapersSnapshot(siteDir, { client: fastClient(fetchFn), now });
      expect(result.warning).toBe(true);
      expect(result.message).toContain(
        'Institution icons: 0 downloaded, 0 removed; 1 institutions have none.'
      );
      expect(result.message).toContain('\n  icons of 1 institutions: offline');
    });

    it('uses the global fetch by default, as `npm run papers:update` does', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      const { data } = await updatePapersSnapshot(siteDir);

      // Semantic Scholar twice, then OpenAlex for the paper and its institution, then the icon.
      expect(fetchFn).toHaveBeenCalledTimes(5);
      expect(JSON.parse(await fs.readFile(snapshotPath, 'utf8'))).toEqual(data);
    });
  });

  describe('institution icons', () => {
    // Each institution's homepage is https://<first two words>.example/, or www.<that> for Bare University.
    const names = [
      'Kept University',
      'Icon University',
      'JPEG University',
      'Duck University',
      'Bare University',
      'No Icon University',
      'Not Image University',
      'No Homepage University',
      'No Id University',
      'Broken University',
    ];
    const host = (name: string) => name.split(' ').slice(0, 2).join('').toLowerCase() + '.example';
    const homepage = (name: string) =>
      name === 'Bare University' ? `https://www.${host(name)}/` : `https://${host(name)}/`;
    // No Homepage and No Id University have none.
    const homepages = new Map(
      names.filter(name => !/No (Homepage|Id)/.test(name)).map(name => [name, homepage(name)])
    );
    const google = (h: string) => `https://www.google.com/s2/favicons?domain=${h}&sz=64`;
    const duck = (h: string) => `https://icons.duckduckgo.com/ip3/${h}.ico`;
    const bytes = (...values: number[]) => new Response(new Uint8Array(values), { status: 200 });

    beforeEach(async () => {
      await fs.mkdir(iconsDir(), { recursive: true });
      await fs.writeFile(path.join(iconsDir(), 'kept-university.ico'), 'kept');
      await fs.writeFile(path.join(iconsDir(), 'gone-university.png'), 'gone');
      await fs.writeFile(path.join(iconsDir(), 'notes.txt'), 'not an icon');
    });

    it('downloads missing icons from the first service that has one, and deletes icons no longer needed', async () => {
      const responses: Record<string, () => Response> = {
        [google('iconuniversity.example')]: png,
        [google('jpeguniversity.example')]: () => bytes(0xff, 0xd8, 0xff, 0xe0, 1),
        [duck('duckuniversity.example')]: () => bytes(0x00, 0x00, 0x01, 0x00, 1),
        [google('bareuniversity.example')]: png,
        [google('notimage.example')]: () => new Response('<html>', { status: 200 }),
      };
      const fetchFn = jest.fn<FetchFn>(async url => {
        if (url.includes('brokenuniversity')) throw new Error('boom');
        return responses[url]?.() ?? new Response('', { status: 404 });
      });

      const result = await updateInstitutionIcons(siteDir, names, { homepages, fetchFn });

      expect(result).toEqual({
        downloaded: 4,
        removed: 1,
        without: 5,
        failures: ['icons of 1 institutions: boom'],
      });
      expect((await fs.readdir(iconsDir())).sort()).toEqual([
        'bare-university.png',
        'duck-university.ico',
        'icon-university.png',
        'jpeg-university.jpg',
        'kept-university.ico',
        'notes.txt',
      ]);
      const asked = fetchFn.mock.calls.map(([url]) => url);
      // The host without `www.` is tried after the host itself, and DuckDuckGo after Google.
      expect(asked.filter(url => url.includes('bareuniversity'))).toEqual([
        google('www.bareuniversity.example'),
        google('bareuniversity.example'),
      ]);
      // DuckDuckGo after Google, then the homepage's own icons.
      expect(asked.filter(url => url.includes('noicon'))).toEqual([
        google('noicon.example'),
        duck('noicon.example'),
        'https://noicon.example/',
        'https://noicon.example/favicon.ico',
      ]);
      // Kept University has an icon; No Homepage and No Id University have no website to ask about.
      expect(asked.some(url => /kept|nohomepage|noid/.test(url))).toBe(false);
      expect(fetchFn.mock.calls[0][1]?.headers).toEqual({ 'User-Agent': expect.any(String) });
    });

    it('creates the icon directory if needed, and gives institutions without a homepage no icon', async () => {
      await fs.rm(iconsDir(), { recursive: true });
      const fetchFn = jest.fn<FetchFn>();

      const result = await updateInstitutionIcons(siteDir, names, { homepages: new Map(), fetchFn });

      expect(result).toEqual({ downloaded: 0, removed: 0, without: 10, failures: [] });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(await fs.readdir(iconsDir())).toEqual([]);
    });

    it('uses the icons homepages link to', async () => {
      const fetchFn = jest.fn<FetchFn>(async url => {
        if (url === google('configured.example')) return png();
        // Some sites answer scripts with a 404 page that still links to their icons.
        if (url === 'https://linked.example/') {
          return new Response(
            '<link rel="icon" href="data:image/png;base64,AAAA"><link rel="apple-touch-icon" href="/touch.png">',
            { status: 404 }
          );
        }
        if (url === 'https://linked.example/touch.png') return png();
        if (url === 'https://down.example/') throw new Error('unreachable');
        if (url === 'https://unsafe.example/') return new Response('<link rel="icon" href="/logo.svg">');
        if (url === 'https://unsafe.example/logo.svg') return new Response('<svg onload="alert(1)"></svg>');
        return new Response('', { status: 404 });
      });
      const names = ['Linked', 'Configured', 'Down', 'Unsafe'];

      const result = await updateInstitutionIcons(siteDir, names, {
        homepages: new Map(names.map(name => [name, `https://${name.toLowerCase()}.example/`])),
        fetchFn,
      });

      // An unreachable homepage, or an icon that can't be used, just means no icon.
      expect(result).toEqual({ downloaded: 2, removed: 2, without: 2, failures: [] });
      expect((await fs.readdir(iconsDir())).sort()).toEqual(['configured.png', 'linked.png', 'notes.txt']);
    });

    it("skips homepages that aren't web addresses, and icon links that can't be fetched", async () => {
      const fetchFn = jest.fn<FetchFn>(async url => {
        if (url === 'https://flaky.example/') return new Response('<link rel="icon" href="/icon.png">');
        if (url === 'https://flaky.example/icon.png') throw new Error('reset');
        if (url === 'https://flaky.example/favicon.ico') return png();
        return new Response('', { status: 404 });
      });

      const result = await updateInstitutionIcons(siteDir, ['Not A URL', 'No Host', 'Flaky'], {
        homepages: new Map([
          ['Not A URL', 'not a web address'],
          ['No Host', 'mailto:someone@example.org'],
          ['Flaky', 'https://flaky.example/'],
        ]),
        fetchFn,
      });

      // The icon link that failed is skipped for the next candidate, /favicon.ico.
      expect(result).toEqual({ downloaded: 1, removed: 2, without: 2, failures: [] });
      expect((await fs.readdir(iconsDir())).sort()).toEqual(['flaky.png', 'notes.txt']);
      expect(fetchFn.mock.calls.some(([url]) => /not a web|someone/.test(url))).toBe(false);
    });

    it('finds the committed icons of institutions, whatever their image type', async () => {
      expect(await findInstitutionIcons(siteDir, ['Kept University', 'Gone University', 'Notes'])).toEqual({
        'Kept University': '/img/institutions/kept-university.ico',
        'Gone University': '/img/institutions/gone-university.png',
      });
      await fs.rm(iconsDir(), { recursive: true });
      expect(await findInstitutionIcons(siteDir, ['Kept University'])).toEqual({});
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
        iconsDir(),
      ]);

      const content = (await plugin.loadContent?.()) as PapersData;
      expect(content.papers.map(paper => paper.id)).toEqual(['live']);
      expect(console.info).toHaveBeenCalledWith(
        '[papers] Fetched 1 papers citing 1 MEDS papers from Semantic Scholar, and their institutions from OpenAlex.'
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
      expect(fetchFn).toHaveBeenCalledTimes(5);
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
      expect(content).toEqual({ ...snapshot, institutionIcons: {}, institutionLocations: {} });
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(jest.mocked(console.warn).mock.calls[0][0]).toContain('[papers] Could not fetch everything');
      expect(jest.mocked(console.warn).mock.calls[0][0]).toContain('papers citing Seed a: fetch failed');
    });

    it('uses the snapshot on the dev server', async () => {
      process.env.NODE_ENV = 'development';
      await writeSnapshot();
      const fetchFn = jest.fn<FetchFn>();
      globalThis.fetch = fetchFn as unknown as typeof fetch;

      await fs.mkdir(iconsDir(), { recursive: true });
      await fs.writeFile(path.join(iconsDir(), 'saved-university.png'), 'icon');
      const location = { latitude: 1, longitude: 2, city: null, country: null };
      await writeSnapshot({
        ...snapshot,
        institutions: { 'Saved University': { id: 'ISaved', partOf: [], location } },
      });
      expect(await papersPlugin({ siteDir } as LoadContext).loadContent?.()).toEqual({
        ...snapshot,
        institutionIcons: { 'Saved University': '/img/institutions/saved-university.png' },
        // The records themselves are not sent to the browser.
        institutionLocations: { 'Saved University': location },
      });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[papers] Using the snapshot'));
    });
  });
});

describe("this repository's papers.yaml and snapshot", () => {
  const dataDir = path.join(__dirname, '..', 'static', 'data');
  const MEDS_DEV = '7d56d69d5864c28e45d6cc3f8e8b802f666c7ecf';
  const readConfig = async () =>
    parsePapersConfig(parse(await fs.readFile(path.join(dataDir, 'papers.yaml'), 'utf8')));

  it('has MEDS-DEV as a seed, with its details from OpenReview, and no longer excludes it', async () => {
    const { seeds, include, exclude } = await readConfig();

    const medsDev = seeds.find(seed => seed.id === MEDS_DEV);
    expect(medsDev).toMatchObject({
      label: 'MEDS-DEV',
      overrides: {
        title:
          'MEDS Decentralized, Extensible Validation (MEDS-DEV) Benchmark: Establishing Reproducibility and ' +
          'Comparability in ML for Health',
        venue: 'ML4H 2024 (Demo Track)',
        year: 2024,
        url: 'https://openreview.net/forum?id=DExp3tRRel',
      },
    });
    const authors = medsDev?.overrides?.authors ?? [];
    expect(authors).toHaveLength(31);
    expect([authors[0], authors[17], authors[30]]).toEqual([
      'Matthew B.A. McDermott',
      'Robin van de Water',
      'Ryan King',
    ]);
    expect(exclude).not.toContain(MEDS_DEV);
    expect(include.map(({ id }) => id)).not.toContain(MEDS_DEV);
  });

  it('has a snapshot with every seed and included paper, and no excluded one', async () => {
    const { seeds, include, exclude } = await readConfig();
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const papers = snapshot?.papers ?? [];
    const listed = (identifier: string) => papers.some(paper => paperMatchesId(paper, identifier));

    expect(snapshot?.seeds.map(({ id }) => id)).toEqual(seeds.map(({ id }) => id));
    expect(include.map(({ id }) => id).filter(id => !listed(id))).toEqual([]);
    expect(exclude.filter(listed)).toEqual([]);
  });

  it('renames and gives homepages only to listed institutions', async () => {
    const { institutions } = await readConfig();
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const listed = new Set(snapshot?.papers.flatMap(paper => paper.institutions));

    expect(institutions.length).toBeGreaterThan(0);
    for (const { name, rename } of institutions) {
      expect([name, listed.has(rename ?? name), rename !== undefined && listed.has(name)]).toEqual([
        name,
        true,
        false,
      ]);
    }
  });

  it('has affiliations only for listed papers, and a snapshot with those institutions, as shown', async () => {
    const config = await readConfig();
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const papers = snapshot?.papers ?? [];
    const configured = (paper: Paper) => config.affiliations.find(({ id }) => paperMatchesId(paper, id));
    // As shown: rolled up into the listed institutions they are part of, and renamed.
    const shown = showInstitutions(
      papers.map(paper => ({
        ...paper,
        institutions: configured(paper)?.institutions ?? paper.institutions,
      })),
      snapshot?.institutions ?? {},
      config.institutions
    );

    expect(config.affiliations.length).toBeGreaterThan(0);
    for (const { id } of config.affiliations) {
      const listed = papers.filter(paper => paperMatchesId(paper, id)).map(paper => paper.institutions);
      const expected = shown.filter(paper => paperMatchesId(paper, id)).map(paper => paper.institutions);
      expect([id, listed.length]).toEqual([id, 1]);
      expect([id, listed]).toEqual([id, expected]);
    }
  });

  it('lists each merged record as the record it is merged into', async () => {
    const { merge } = await readConfig();
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const papers = snapshot?.papers ?? [];

    expect(merge.length).toBeGreaterThan(0);
    for (const { id, into } of merge) {
      expect([id, papers.filter(paper => paperMatchesId(paper, into)).length]).toEqual([id, 1]);
      expect([id, papers.some(paper => paperMatchesId(paper, id))]).toEqual([id, false]);
    }
  });

  it('shows no institution as itself that OpenAlex records as part of another, unless kept separate', async () => {
    const { institutions: config } = await readConfig();
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const records = snapshot?.institutions ?? {};
    const shown = new Set(snapshot?.papers.flatMap(paper => paper.institutions));
    const rename = institutionRenamer(config);
    const separate = new Set(config.filter(({ separate }) => separate).map(({ name }) => name));

    // The records of the shown institutions, by OpenAlex id.
    const shownIds = new Map(
      Object.entries(records).flatMap(([name, { id }]) =>
        shown.has(rename(name)) ? [[id, rename(name)]] : []
      )
    );
    expect(shownIds.size).toBeGreaterThan(50);
    const partOfShown = Object.entries(records).flatMap(([name, { partOf }]) =>
      shown.has(rename(name)) && !separate.has(name)
        ? partOf.flatMap(id =>
            shownIds.has(id) && shownIds.get(id) !== rename(name) ? [[name, shownIds.get(id)]] : []
          )
        : []
    );
    expect(partOfShown).toEqual([]);

    // Every institution kept separate is part of a listed one.
    for (const name of separate) {
      const ids = records[name]?.partOf ?? [];
      expect([name, ids.some(id => shownIds.has(id))]).toEqual([name, true]);
    }
  });

  it('lists each institution once per paper, with an icon for nearly all, and a location for most', async () => {
    const { snapshot } = await readSnapshot(path.join(dataDir, 'papers.snapshot.json'));
    const papers = snapshot?.papers ?? [];
    const names = [...new Set(papers.flatMap(paper => paper.institutions))];
    const { institutions: config } = await readConfig();

    for (const paper of papers) expect(new Set(paper.institutions).size).toBe(paper.institutions.length);
    const icons = await findInstitutionIcons(path.join(dataDir, '..', '..'), names);
    expect(names.length - Object.keys(icons).length).toBeLessThanOrEqual(3);
    const located = institutionLocations(names, snapshot?.institutions ?? {}, config);
    expect(Object.keys(located).length / names.length).toBeGreaterThan(0.9);
  });
});
