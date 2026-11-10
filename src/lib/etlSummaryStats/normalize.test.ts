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
      normalizeDistribution({
        n: 30,
        mean: 3.5,
        std: 1,
        quantiles: { p5: 1, p25: 2, p50: 3, p75: 4, p95: 5, p99: 9 },
      })
    ).toEqual({
      suppressed: false,
      n: 30,
      mean: 3.5,
      p5: 1,
      p25: 2,
      p50: 3,
      p75: 4,
      p95: 5,
    });
  });

  it('keeps the quantiles of a distribution without a usable mean', () => {
    expect(
      normalizeDistribution({ n: 30, mean: 'x', quantiles: { p5: 1, p25: 2, p50: 3, p75: 4, p95: 5 } })
    ).toMatchObject({ suppressed: false, mean: null, p50: 3 });
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
    ).toEqual({ cells: [{ key: 'a', cell: 1 }], suppressed: { cells: 2, events: 4 } });
  });

  it('keeps unknown parts of a rollup as null, and ignores a malformed one', () => {
    expect(normalizeKeyed({ '<suppressed>': {} }, parse, 'n_things')).toEqual({
      cells: [],
      suppressed: { cells: null, events: null },
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
    // Every row is an event: `n_measurements`, not `n_events` (distinct subject and time pairs, 9,000 here).
    expect(stats.counts).toEqual({
      subjects: 500,
      events: 40000,
      uniqueCodes: 300,
      subjectsWithBirth: 500,
      subjectsWithDeath: 50,
      subjectsWithStatic: 450,
      numericValues: 30000,
    });
    expect(stats.checks).toEqual({
      emptyCodes: 0,
      nullCodes: 3,
      nullSubjectIds: 0,
      nanValues: 2,
      infiniteValues: 1,
    });
    expect(stats.perSubject.spanDays).toEqual({
      suppressed: false,
      n: 500,
      mean: 300,
      p5: 100,
      p25: 200,
      p50: 300,
      p75: 400,
      p95: 500,
    });
    expect(stats.codeMetadata).toEqual({
      present: true,
      codes: 320,
      withDescription: 300,
      dataCodesMissing: 0,
      metadataCodesUnused: 20,
    });
    expect(stats.concentration).toEqual({
      top10: 0.5,
      top100: 0.9,
      top1000: 1,
      codesFor50: 10,
      codesFor90: 100,
      codesFor99: 250,
    });
    // Sorted by name; `<no-vocabulary>` is not a vocabulary, and a mistyped `recognized` is unknown.
    expect(stats.ontology).toEqual({
      eventsMapped: 0.4,
      codesWithParents: 0.2,
      vocabularies: [
        { name: 'ICD10CM', events: 5, recognized: null },
        { name: 'LOINC', events: 10, recognized: true },
      ],
      suppressed: { cells: 2, events: 3 },
      mappedEvents: 16000,
      noVocabularyEvents: 2,
      codesInMultipleVocabularies: 4,
    });
  });

  it('counts no events under no vocabulary when the file lists none, and unknown when it lists no count', () => {
    const ontology = (byVocabulary: unknown) =>
      normalizeStats(
        statsDocument({ code_metadata: { ontology: { present: true, by_vocabulary: byVocabulary } } })
      ).ontology;
    expect(ontology({ LOINC: { n_measurements: 10 } })?.noVocabularyEvents).toBe(0);
    expect(ontology({ '<no-vocabulary>': { n_subjects: 30 } })?.noVocabularyEvents).toBeNull();
    expect(ontology(undefined)).toMatchObject({
      noVocabularyEvents: null,
      mappedEvents: null,
      codesInMultipleVocabularies: null,
    });
  });

  it("reads each subject's rows as their events, and never the distinct subject and time pairs", () => {
    const { perSubject } = normalizeStats(statsDocument());
    // The fixture's per-subject rows are scaled by 10, its distinct timestamps by 5.
    expect(perSubject.events).toMatchObject({ suppressed: false, p50: 30 });
    expect(Object.keys(perSubject).sort()).toEqual(['events', 'eventsPerDay', 'spanDays', 'uniqueCodes']);
    expect(normalizeStats({ counts: { n_events: 9000 } }).counts.events).toBeNull();
    expect(
      normalizeStats({ per_subject: { n_events: { n: 5, suppressed: true } } }).perSubject.events
    ).toBeNull();
  });

  it("reads each subject's events per day where the file has them, quantiles or suppressed", () => {
    expect(normalizeStats(statsDocument()).perSubject.eventsPerDay).toBeNull();
    const perSubject = (eventsPerDay: unknown) =>
      normalizeStats(statsDocument({ per_subject: { measurements_per_day: eventsPerDay } })).perSubject;
    expect(
      perSubject({
        n: 400,
        mean: 2.5,
        std: 1,
        quantiles: { p1: 0.01, p5: 0.1, p25: 0.5, p50: 1.2, p75: 3, p95: 9, p99: 20 },
      }).eventsPerDay
    ).toEqual({ suppressed: false, n: 400, mean: 2.5, p5: 0.1, p25: 0.5, p50: 1.2, p75: 3, p95: 9 });
    expect(perSubject({ n: 12, suppressed: true }).eventsPerDay).toEqual({ suppressed: true, n: 12 });
  });

  it('drops calendar years, splits, digests, layout, config and dataset_digest', () => {
    const stats = normalizeStats(statsDocument());
    expect(Object.keys(stats).sort()).toEqual([
      'checks',
      'codeMetadata',
      'concentration',
      'counts',
      'ontology',
      'perSubject',
    ]);
    const json = JSON.stringify(stats);
    expect(json).not.toContain('sha256');
    expect(json).not.toContain('String');
    expect(json).not.toContain('2101');
    expect(json).not.toContain('train');
  });

  it('turns missing or mistyped fields into nulls rather than failing', () => {
    const stats = normalizeStats({
      counts: { n_subjects: '500', n_measurements: null, quality: { n_empty_code: 'none' } },
      per_subject: { n_measurements: { n: 10, suppressed: true } },
      codes: {},
      code_metadata: { present: false, ontology: { present: false } },
    });
    expect(stats.counts.subjects).toBeNull();
    expect(stats.counts.events).toBeNull();
    expect(stats.counts.numericValues).toBeNull();
    expect(stats.checks).toEqual({
      emptyCodes: null,
      nullCodes: null,
      nullSubjectIds: null,
      nanValues: null,
      infiniteValues: null,
    });
    expect(stats.perSubject).toEqual({
      events: { suppressed: true, n: 10 },
      uniqueCodes: null,
      spanDays: null,
      eventsPerDay: null,
    });
    // A dataset without codes.parquet says so; its counts are unknown.
    expect(stats.codeMetadata).toEqual({
      present: false,
      codes: null,
      withDescription: null,
      dataCodesMissing: null,
      metadataCodesUnused: null,
    });
    expect(stats.concentration).toBeNull();
    expect(stats.ontology).toBeNull();
  });

  it('handles an entirely empty document', () => {
    const stats = normalizeStats({});
    expect(stats.codeMetadata).toBeNull();
    expect(stats.concentration).toBeNull();
    expect(stats.ontology).toBeNull();
  });

  it('keeps the coverage of an ontology without a by_vocabulary block, and unknown vocabulary sizes', () => {
    expect(
      normalizeStats(
        statsDocument({
          code_metadata: { ontology: { present: true, coverage: { frac_measurements_mapped: null } } },
        })
      ).ontology
    ).toEqual({
      eventsMapped: null,
      codesWithParents: null,
      vocabularies: [],
      suppressed: null,
      mappedEvents: null,
      noVocabularyEvents: null,
      codesInMultipleVocabularies: null,
    });
    expect(
      normalizeStats(
        statsDocument({
          code_metadata: { ontology: { present: true, by_vocabulary: { SNOMED: { recognized: false } } } },
        })
      ).ontology?.vocabularies
    ).toEqual([{ name: 'SNOMED', events: null, recognized: false }]);
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
