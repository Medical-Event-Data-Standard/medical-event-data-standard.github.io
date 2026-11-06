import { describe, expect, it } from '@jest/globals';
import {
  isEtlStatsData,
  normalizeDistribution,
  normalizeKeyed,
  normalizeStats,
  normalizeStatsDocument,
} from './normalize';
import { statsDocument } from './testFixtures';

describe('normalizeDistribution', () => {
  it('keeps the quantiles the page draws', () => {
    expect(
      normalizeDistribution({ n: 30, quantiles: { p5: 1, p25: 2, p50: 3, p75: 4, p95: 5, p99: 9 } })
    ).toEqual({
      suppressed: false,
      n: 30,
      p5: 1,
      p25: 2,
      p50: 3,
      p75: 4,
      p95: 5,
    });
  });

  it('keeps a suppressed distribution as suppressed, with only its count', () => {
    expect(normalizeDistribution({ n: 12, suppressed: true })).toEqual({ suppressed: true, n: 12 });
  });

  it('rejects malformed distributions', () => {
    expect(normalizeDistribution(null)).toBeNull();
    expect(normalizeDistribution([1, 2])).toBeNull();
    expect(normalizeDistribution({ quantiles: {} })).toBeNull();
    expect(normalizeDistribution({ n: 5 })).toBeNull();
    expect(
      normalizeDistribution({ n: 5, quantiles: { p5: 1, p25: 2, p50: '3', p75: 4, p95: 5 } })
    ).toBeNull();
    expect(normalizeDistribution({ n: Infinity, suppressed: true })).toBeNull();
  });
});

describe('normalizeKeyed', () => {
  const parse = (key: string, cell: unknown) => (typeof cell === 'number' ? { key, cell } : null);

  it('separates the suppressed rollup from the reported cells and drops cells the parser rejects', () => {
    expect(
      normalizeKeyed({ a: 1, b: 'x', '<suppressed>': { n_measurements: 4, n_things: 2 } }, parse, 'n_things')
    ).toEqual({ cells: [{ key: 'a', cell: 1 }], suppressed: { cells: 2, measurements: 4 } });
  });

  it('keeps unknown parts of a rollup as null, and ignores a malformed one', () => {
    expect(normalizeKeyed({ '<suppressed>': {} }, parse, 'n_things')).toEqual({
      cells: [],
      suppressed: { cells: null, measurements: null },
    });
    expect(normalizeKeyed({ '<suppressed>': 5 }, parse, 'n_things')).toEqual({ cells: [], suppressed: null });
  });

  it('returns null for a missing block', () => {
    expect(normalizeKeyed(undefined, parse, 'n')).toBeNull();
  });
});

describe('normalizeStats', () => {
  it('reduces a full document to the charted numbers', () => {
    const stats = normalizeStats(statsDocument());
    expect(stats.counts).toEqual({
      subjects: 500,
      events: 9000,
      measurements: 40000,
      uniqueCodes: 300,
      subjectsWithBirth: 500,
      subjectsWithDeath: 50,
      subjectsWithStatic: 450,
      numericValues: 30000,
    });
    expect(stats.perSubject.spanDays).toEqual({
      suppressed: false,
      n: 500,
      p5: 100,
      p25: 200,
      p50: 300,
      p75: 400,
      p95: 500,
    });
    // Sorted by year; the suppressed years stay a rollup.
    expect(stats.byYear).toEqual({
      years: [2099, 2101],
      measurements: [200, 100],
      subjects: [40, 30],
      suppressed: { cells: 3, measurements: 7 },
    });
    expect(stats.splits).toEqual({
      cells: [
        { split: 'train', subjects: 400, measurements: 30000 },
        { split: 'tuning', subjects: 50, measurements: 5000 },
        { split: 'held_out', subjects: 50, measurements: 5000 },
      ],
      suppressed: null,
    });
    expect(stats.concentration).toEqual({ top10: 0.5, top100: 0.9, top1000: 1 });
    expect(stats.ontology).toEqual({
      measurementsMapped: 0.4,
      codesWithParents: 0.2,
      vocabularies: ['ICD10CM', 'LOINC'],
      suppressed: { cells: 2, measurements: 3 },
    });
  });

  it('drops digests, layout, config and dataset_digest', () => {
    const json = JSON.stringify(normalizeStats(statsDocument()));
    expect(json).not.toContain('sha256');
    expect(json).not.toContain('String');
  });

  it('turns missing or mistyped fields into nulls rather than failing', () => {
    const stats = normalizeStats({
      counts: { n_subjects: '500', n_events: null },
      per_subject: { n_measurements: { n: 10, suppressed: true } },
      time: { by_year: { notayear: { n_measurements: 1, n_subjects: 1 }, '2000': { n_measurements: 1 } } },
      splits: { present: false },
      codes: {},
      code_metadata: { ontology: { present: false } },
    });
    expect(stats.counts.subjects).toBeNull();
    expect(stats.counts.events).toBeNull();
    expect(stats.counts.numericValues).toBeNull();
    expect(stats.perSubject).toEqual({
      measurements: { suppressed: true, n: 10 },
      events: null,
      uniqueCodes: null,
      spanDays: null,
    });
    expect(stats.byYear).toEqual({ years: [], measurements: [], subjects: [], suppressed: null });
    expect(stats.splits).toBeNull();
    expect(stats.concentration).toBeNull();
    expect(stats.ontology).toBeNull();
  });

  it('handles an entirely empty document', () => {
    const stats = normalizeStats({});
    expect(stats.byYear).toBeNull();
    expect(stats.splits).toBeNull();
    expect(stats.ontology).toBeNull();
  });

  it('keeps a split rollup and the coverage of an ontology without a by_vocabulary block', () => {
    const stats = normalizeStats(
      statsDocument({
        splits: {
          present: true,
          by_split: {
            train: { n_subjects: 80, n_measurements: 900 },
            noSubjects: { n_measurements: 5 },
            noMeasurements: { n_subjects: 5 },
            '<suppressed>': { n_measurements: 99, n_splits: 2 },
          },
        },
        code_metadata: { ontology: { present: true, coverage: { frac_measurements_mapped: null } } },
      })
    );
    expect(stats.splits?.suppressed).toEqual({ cells: 2, measurements: 99 });
    // Splits missing a count are dropped.
    expect(stats.splits?.cells.map(cell => cell.split)).toEqual(['train']);
    expect(stats.ontology).toEqual({
      measurementsMapped: null,
      codesWithParents: null,
      vocabularies: [],
      suppressed: null,
    });
  });
});

describe('normalizeStatsDocument', () => {
  it('normalises a supported document with its provenance', () => {
    const doc = normalizeStatsDocument(statsDocument());
    expect(doc).toMatchObject({
      extractedAt: '2026-11-04T22:16:51.111265',
      schemaVersion: 1,
      toolVersion: '0.0.3',
      minCellSize: 20,
      problem: null,
      dataset: {
        name: 'Example',
        version: '1.0',
        etlName: 'MEDS_transforms',
        etlVersion: '0.7.0',
        medsVersion: '0.4.0',
      },
    });
    expect(doc.stats?.counts.subjects).toBe(500);
  });

  it('keeps a document with an unknown schema version, without stats, and says why', () => {
    const doc = normalizeStatsDocument(statsDocument({ stats_schema_version: 2 }));
    expect(doc.stats).toBeNull();
    expect(doc.schemaVersion).toBe(2);
    expect(doc.problem).toMatch(
      /schema version is 2, which this page cannot read yet \(it reads version 1\)/
    );
  });

  it('treats a missing or absent dataset block as unknown', () => {
    expect(normalizeStatsDocument(statsDocument({ dataset: { present: false } })).dataset).toBeNull();
    const doc = normalizeStatsDocument({ stats_schema_version: 1 });
    expect(doc).toMatchObject({ dataset: null, extractedAt: null, toolVersion: null, minCellSize: null });
  });

  it('throws for something that is not a stats document', () => {
    expect(() => normalizeStatsDocument([])).toThrow('not a JSON object');
    expect(() => normalizeStatsDocument({ counts: {} })).toThrow('no `stats_schema_version`');
    expect(() => normalizeStatsDocument({ stats_schema_version: '1' })).toThrow('no `stats_schema_version`');
    expect(() => normalizeStatsDocument({ stats_schema_version: 1.5 })).toThrow('no `stats_schema_version`');
  });
});

describe('isEtlStatsData', () => {
  const entry = { id: 'o/r/f.json', label: 'L', githubRepo: 'o/r', path: 'f.json', stats: null };

  it('accepts well-formed data', () => {
    expect(
      isEtlStatsData({
        updatedAt: null,
        datasets: [entry],
        reposWithoutStats: [{ githubRepo: 'o/x', name: 'X' }],
      })
    ).toBe(true);
  });

  it('rejects malformed data', () => {
    expect(isEtlStatsData(null)).toBe(false);
    expect(isEtlStatsData({ updatedAt: 3, datasets: [], reposWithoutStats: [] })).toBe(false);
    expect(isEtlStatsData({ updatedAt: null, datasets: {}, reposWithoutStats: [] })).toBe(false);
    expect(
      isEtlStatsData({ updatedAt: null, datasets: [{ ...entry, label: 1 }], reposWithoutStats: [] })
    ).toBe(false);
    expect(
      isEtlStatsData({ updatedAt: null, datasets: [{ ...entry, stats: 'x' }], reposWithoutStats: [] })
    ).toBe(false);
    expect(isEtlStatsData({ updatedAt: null, datasets: [], reposWithoutStats: [{}] })).toBe(false);
    expect(isEtlStatsData({ updatedAt: null, datasets: [] })).toBe(false);
  });
});
