import { describe, expect, it } from '@jest/globals';
import {
  buildPapersData,
  emptyLiveFetch,
  isPapersData,
  normalizePaper,
  paperMatchesId,
  semanticScholarUrl,
  type LiveFetch,
  type PapersConfig,
  type S2Paper,
} from './normalize';
import type { CitingPaper, Paper, PapersData } from './types';

const SEED_A = 'a'.repeat(40);
const SEED_B = 'b'.repeat(40);

const s2 = (paperId: string, overrides: Partial<S2Paper> = {}): S2Paper => ({
  paperId,
  title: `Paper ${paperId}`,
  year: 2025,
  publicationDate: null,
  authors: [{ name: 'Author' }],
  externalIds: {},
  citationCount: 0,
  ...overrides,
});

const paper = (id: string, overrides: Partial<CitingPaper> = {}): CitingPaper => ({
  ...(normalizePaper(s2(id)) as Paper),
  cites: [],
  ...overrides,
});

describe('normalizePaper', () => {
  it('normalises a full record, linking to the DOI', () => {
    expect(
      normalizePaper({
        paperId: 'p1',
        title: '  A   Paper\n Title ',
        year: 2025,
        publicationDate: '2025-08-03',
        venue: 'KDD',
        publicationVenue: { name: 'Knowledge Discovery and Data Mining' },
        authors: [
          { name: ' Ada Lovelace ' },
          { name: null },
          { name: '' },
          null as never,
          { name: 'Alan Turing' },
        ],
        externalIds: { DOI: '10.1145/123', ArXiv: '2401.00001', CorpusId: 42 },
        url: 'https://www.semanticscholar.org/paper/p1',
        citationCount: 7,
      })
    ).toEqual({
      id: 'p1',
      title: 'A Paper Title',
      authors: ['Ada Lovelace', 'Alan Turing'],
      venue: 'Knowledge Discovery and Data Mining',
      year: 2025,
      publicationDate: '2025-08-03',
      doi: '10.1145/123',
      arxivId: '2401.00001',
      url: 'https://doi.org/10.1145/123',
      citationCount: 7,
    });
  });

  it('links to arXiv, then the Semantic Scholar URL, then a constructed Semantic Scholar URL', () => {
    expect(normalizePaper(s2('p', { externalIds: { ArXiv: '2401.00001' } }))?.url).toBe(
      'https://arxiv.org/abs/2401.00001'
    );
    expect(normalizePaper(s2('p', { url: 'https://s2.example/p' }))?.url).toBe('https://s2.example/p');
    expect(normalizePaper(s2('p', { externalIds: null }))?.url).toBe(semanticScholarUrl('p'));
  });

  it('cleans up venues, years and counts', () => {
    expect(normalizePaper(s2('p', { venue: 'arXiv.org' }))?.venue).toBe('arXiv');
    expect(normalizePaper(s2('p', { venue: ' ', publicationVenue: { name: null } }))?.venue).toBeNull();
    expect(normalizePaper(s2('p', { year: null, publicationDate: '2024-05-01' }))?.year).toBe(2024);
    expect(normalizePaper(s2('p', { year: null, publicationDate: 'unknown' }))?.year).toBeNull();
    expect(normalizePaper(s2('p', { year: undefined }))?.year).toBeNull();
    expect(normalizePaper(s2('p', { citationCount: null, authors: null }))).toMatchObject({
      citationCount: null,
      authors: [],
    });
  });

  it('returns null for records that cannot be listed', () => {
    expect(normalizePaper(null)).toBeNull();
    expect(normalizePaper(undefined)).toBeNull();
    expect(normalizePaper(s2('p', { title: '  ' }))).toBeNull();
    expect(normalizePaper(s2('', {}))).toBeNull();
    expect(normalizePaper({ paperId: null, title: 'No id' })).toBeNull();
  });
});

describe('paperMatchesId', () => {
  const p = paper(SEED_A, { doi: '10.1145/ABC', arxivId: '2401.00001' });

  it('matches a paperId, DOI or arXiv id', () => {
    expect(paperMatchesId(p, SEED_A)).toBe(true);
    expect(paperMatchesId(p, ` ${SEED_A} `)).toBe(true);
    expect(paperMatchesId(p, SEED_B)).toBe(false);
    expect(paperMatchesId(p, 'doi:10.1145/abc')).toBe(true);
    expect(paperMatchesId(p, 'DOI: 10.1145/ABC')).toBe(true);
    expect(paperMatchesId(p, 'DOI:10.1145/other')).toBe(false);
    expect(paperMatchesId(p, 'ARXIV:2401.00001v3')).toBe(true);
    expect(paperMatchesId(p, 'arxiv:2401.00002')).toBe(false);
  });

  it('does not match identifiers of other kinds, or papers lacking that identifier', () => {
    expect(paperMatchesId(p, 'CorpusId:42')).toBe(false);
    expect(paperMatchesId(paper('x'), 'DOI:10.1145/abc')).toBe(false);
    expect(paperMatchesId(paper('x'), 'ARXIV:2401.00001')).toBe(false);
  });
});

describe('buildPapersData', () => {
  const config: PapersConfig = {
    seeds: [
      { id: SEED_A, label: 'Seed A' },
      { id: SEED_B, label: 'Seed B' },
    ],
    include: [],
    exclude: [],
  };

  const liveWith = (overrides: Partial<LiveFetch>): LiveFetch => ({ ...emptyLiveFetch(), ...overrides });

  it('merges papers citing several seeds, leaves out the seeds themselves, and applies include/exclude', () => {
    const live = liveWith({
      seeds: new Map([
        [SEED_A, s2(SEED_A, { title: 'Seed A paper' })],
        [SEED_B, s2(SEED_B, { title: 'Seed B paper' })],
      ]),
      citations: new Map([
        [
          SEED_A,
          [
            s2('both', { publicationDate: '2025-06-01' }),
            s2(SEED_B), // Seed B cites seed A; it is listed as a seed, not as a citing paper.
            s2('excluded-by-doi', { externalIds: { DOI: '10.1/X' } }),
            s2('untitled', { title: null }),
          ],
        ],
        [SEED_B, [s2('only-b', { year: 2024 }), s2('both', { publicationDate: '2025-06-01' })]],
      ]),
      included: new Map([
        ['ARXIV:2401.00001', s2('manual', { year: 2026 })],
        ['only-b', s2('only-b', { year: 2024 })],
      ]),
    });

    const result = buildPapersData(
      { ...config, include: ['ARXIV:2401.00001', 'only-b'], exclude: ['doi:10.1/x'] },
      live,
      null
    );

    expect(result.seeds.map(seed => [seed.id, seed.label, seed.title])).toEqual([
      [SEED_A, 'Seed A', 'Seed A paper'],
      [SEED_B, 'Seed B', 'Seed B paper'],
    ]);
    expect(result.papers.map(p => [p.id, p.cites, p.manual])).toEqual([
      ['manual', [], true],
      ['both', [SEED_A, SEED_B], undefined],
      // Cites seed B and is also in `include`.
      ['only-b', [SEED_B], true],
    ]);
    expect(result.fromSnapshot).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('lists the cited seeds in configuration order, whatever order the citations came in', () => {
    const live = liveWith({
      citations: new Map([
        [SEED_B, [s2('p')]],
        [SEED_A, [s2('p')]],
      ]),
    });
    const reversed = { ...config, seeds: [...config.seeds].reverse() };
    expect(buildPapersData(config, live, null).papers[0].cites).toEqual([SEED_A, SEED_B]);
    expect(buildPapersData(reversed, live, null).papers[0].cites).toEqual([SEED_B, SEED_A]);
  });

  const snapshot: PapersData = {
    updatedAt: '2026-01-01T00:00:00.000Z',
    seeds: [{ ...paper(SEED_A), title: 'Saved seed A', label: 'Old label' }],
    papers: [
      paper('saved-a', { cites: [SEED_A, 'removed-seed'], manual: true }),
      paper('saved-both', { cites: [SEED_A, SEED_B], citationCount: 1 }),
      paper('saved-manual', { cites: [], manual: true, doi: '10.1/manual' }),
      paper('saved-removed', { cites: ['removed-seed'] }),
    ],
  };

  it('fills in from the snapshot whatever could not be fetched', () => {
    const live = liveWith({
      // Seed A's details failed; its citations came back incomplete.
      seeds: new Map([[SEED_B, s2(SEED_B)]]),
      citations: new Map([
        [SEED_A, [s2('live-a')]],
        [SEED_B, [s2('saved-both', { citationCount: 9 })]],
      ]),
      incompleteSeeds: new Set([SEED_A]),
    });

    const result = buildPapersData({ ...config, include: ['DOI:10.1/MANUAL'] }, live, snapshot);

    expect(result.seeds[0]).toMatchObject({ id: SEED_A, title: 'Saved seed A', label: 'Seed A' });
    expect(result.seeds[0]).not.toHaveProperty('cites');
    const byId = Object.fromEntries(result.papers.map(p => [p.id, p]));
    expect(Object.keys(byId).sort()).toEqual(['live-a', 'saved-a', 'saved-both', 'saved-manual']);
    // Live data wins over the snapshot's copy; a snapshot paper's stale `cites`/`manual` are not carried over.
    expect(byId['saved-both']).toMatchObject({ citationCount: 9, cites: [SEED_A, SEED_B] });
    expect(byId['saved-a'].cites).toEqual([SEED_A]);
    expect(byId['saved-a']).not.toHaveProperty('manual');
    expect(byId['saved-manual']).toMatchObject({ cites: [], manual: true });
    expect(result.fromSnapshot).toEqual([
      'details of Seed A',
      'papers citing Seed A',
      'included paper DOI:10.1/MANUAL',
    ]);
    expect(result.missing).toEqual([]);
  });

  it('uses the snapshot when a seed unexpectedly has no citing papers, but accepts a seed that has none', () => {
    const live = liveWith({
      citations: new Map([
        [SEED_A, []],
        [SEED_B, []],
      ]),
    });
    const result = buildPapersData(config, live, snapshot);
    expect(result.papers.map(p => p.id).sort()).toEqual(['saved-a', 'saved-both']);
    // Seed B's only snapshot paper also cites seed A, so it counts as filled in for both.
    expect(result.fromSnapshot).toEqual([
      'details of Seed A',
      'papers citing Seed A',
      'papers citing Seed B',
    ]);

    const noneSaved = buildPapersData(config, live, { ...snapshot, papers: [] });
    expect(noneSaved.papers).toEqual([]);
    expect(noneSaved.fromSnapshot).toEqual(['details of Seed A']);
    expect(noneSaved.missing).toEqual(['details of Seed B']);
  });

  it('counts a failed seed with no citing papers in the snapshot as filled in only if the snapshot knows it', () => {
    const result = buildPapersData(config, emptyLiveFetch(), { ...snapshot, papers: [] });
    expect(result.fromSnapshot).toEqual(['details of Seed A', 'papers citing Seed A']);
    expect(result.missing).toEqual(['details of Seed B', 'papers citing Seed B']);
  });

  it('falls back to placeholders when there is neither live data nor a snapshot', () => {
    const result = buildPapersData({ ...config, include: ['DOI:10.1/missing'] }, emptyLiveFetch(), null);
    expect(result.seeds[1]).toEqual({
      id: SEED_B,
      label: 'Seed B',
      title: 'Seed B',
      authors: [],
      venue: null,
      year: null,
      publicationDate: null,
      doi: null,
      arxivId: null,
      url: semanticScholarUrl(SEED_B),
      citationCount: null,
    });
    expect(result.papers).toEqual([]);
    expect(result.fromSnapshot).toEqual([]);
    expect(result.missing).toEqual([
      'details of Seed A',
      'details of Seed B',
      'papers citing Seed A',
      'papers citing Seed B',
      'included paper DOI:10.1/missing',
    ]);
  });
});

describe('isPapersData', () => {
  const valid: PapersData = {
    updatedAt: null,
    seeds: [{ ...paper('s'), label: 'S' }],
    papers: [paper('p', { cites: ['s'] })],
  };

  it('accepts well-formed data', () => {
    expect(isPapersData(valid)).toBe(true);
    expect(isPapersData({ ...valid, updatedAt: '2026-01-01T00:00:00Z' })).toBe(true);
  });

  it('rejects malformed data', () => {
    expect(isPapersData(null)).toBe(false);
    expect(isPapersData('data')).toBe(false);
    expect(isPapersData({ ...valid, updatedAt: 5 })).toBe(false);
    expect(isPapersData({ ...valid, seeds: {} })).toBe(false);
    expect(isPapersData({ ...valid, seeds: [null] })).toBe(false);
    expect(isPapersData({ ...valid, seeds: [{ id: 's', title: 'S' }] })).toBe(false);
    expect(isPapersData({ ...valid, papers: undefined })).toBe(false);
    expect(isPapersData({ ...valid, papers: [{ ...paper('p'), cites: undefined }] })).toBe(false);
    expect(isPapersData({ ...valid, papers: [{ ...paper('p'), cites: [], id: 1 }] })).toBe(false);
  });
});
