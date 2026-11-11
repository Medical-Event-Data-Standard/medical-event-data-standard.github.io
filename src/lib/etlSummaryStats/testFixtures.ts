// Made-up test data for the dataset statistics code (no real dataset's numbers). Only imported by tests.
import type { EtlStats, EtlStatsEntry } from './types';

/** A small schema-version-1 `meds_summary_stats` document with every block the page reads, and some it drops. */
export function statsDocument(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const dist = (scale: number) => ({
    n: 500,
    mean: 3 * scale,
    std: scale,
    quantiles: {
      p1: 1,
      p5: scale,
      p25: 2 * scale,
      p50: 3 * scale,
      p75: 4 * scale,
      p95: 5 * scale,
      p99: 6 * scale,
    },
  });
  return {
    stats_schema_version: 1,
    meds_summary_stats_version: '0.0.3',
    extracted_at: '2026-11-04T22:16:51.111265',
    config: { min_cell_size: 20, min_numeric_cell_size: 20 },
    dataset: {
      present: true,
      dataset_name: 'Example',
      dataset_version: '1.0',
      etl_name: 'MEDS_transforms',
      etl_version: '0.7.0',
      meds_version: '0.4.0',
      created_at: '2026-11-01',
    },
    counts: {
      n_subjects: 500,
      n_events: 9000,
      n_measurements: 40000,
      n_unique_codes: 300,
      n_subjects_with_birth: 500,
      n_subjects_with_death: 50,
      n_subjects_with_static: 450,
      numeric: { n_present: 30000, n_nan: 2, n_infinite: 1, mean: 1, std: 2 },
      quality: { n_empty_code: 0, n_null_code: 3, n_null_subject_id: 0 },
    },
    per_subject: {
      n_measurements: dist(10),
      n_events: dist(5),
      n_unique_codes: dist(2),
      span_days: dist(100),
    },
    time: {
      by_year: {
        '2101': { n_measurements: 100, n_subjects: 30 },
        '2099': { n_measurements: 200, n_subjects: 40 },
        '<suppressed>': { n_measurements: 7, n_years: 3 },
      },
    },
    splits: {
      present: true,
      n_splits: 3,
      by_split: {
        train: { n_measurements: 30000, n_subjects: 400 },
        tuning: { n_measurements: 5000, n_subjects: 50 },
        held_out: { n_measurements: 5000, n_subjects: 50 },
      },
    },
    codes: {
      digests: { alphabetical: 'sha256:abc' },
      concentration: {
        frac_measurements_in_top_10: 0.5,
        frac_measurements_in_top_100: 0.9,
        frac_measurements_in_top_1000: 1,
        n_codes_covering_50pct: 10,
        n_codes_covering_90pct: 100,
        n_codes_covering_99pct: 250,
      },
      n_codes_below_min_cell_size: 40,
    },
    code_metadata: {
      present: true,
      n_codes: 320,
      n_with_description: 300,
      n_data_codes_missing_from_metadata: 0,
      n_metadata_codes_absent_from_data: 20,
      description_length: { n: 300, mean: 40, std: 9 },
      ontology: {
        present: true,
        n_codes_in_multiple_vocabularies: 4,
        coverage: {
          frac_measurements_mapped: 0.4,
          frac_observed_codes_with_parents: 0.2,
          n_measurements_mapped: 16000,
        },
        by_vocabulary: {
          LOINC: { n_measurements: 10, n_subjects: 30, recognized: true, keys_digest: 'sha256:def' },
          ICD10CM: { n_measurements: 5, n_subjects: 25, recognized: 'yes' },
          '<no-vocabulary>': { n_measurements: 2, n_subjects: 21 },
          '<suppressed>': { n_measurements: 3, n_child_codes: 1, n_vocabularies: 2 },
        },
      },
    },
    layout: { data_columns: { code: 'String' } },
    dataset_digest: { combined: 'sha256:123' },
    ...overrides,
  };
}

/**
 * A schema-version-2 document, as `meds_summary_stats` 0.0.4 writes it: the version-1 document plus each subject's
 * measurements per day, with the quantiles that would depend on the smallest or largest value left out (the 1st and
 * 99th percentiles of fewer than 101 values, and the 5th and 95th of fewer than 21).
 */
export function statsDocumentV2(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const v1 = statsDocument();
  return {
    ...v1,
    stats_schema_version: 2,
    meds_summary_stats_version: '0.0.4',
    per_subject: {
      ...(v1.per_subject as Record<string, unknown>),
      measurements_per_day: {
        n: 480,
        mean: 2.5,
        std: 4,
        quantiles: { p1: 0.01, p5: 0.05, p25: 0.4, p50: 1.1, p75: 3, p95: 9, p99: 30 },
      },
      span_days: { n: 20, mean: 300, std: 100, quantiles: { p25: 200, p50: 300, p75: 400 } },
    },
    ...overrides,
  };
}

const quantiles = (scale: number) => ({
  suppressed: false as const,
  n: 100,
  mean: 4 * scale,
  p5: scale,
  p25: 2 * scale,
  p50: 3 * scale,
  p75: 4 * scale,
  p95: 5 * scale,
});

/** Complete normalised stats for a dataset with `subjects` subjects; `overrides` replaces whole blocks. */
export function etlStats(subjects: number, overrides: Partial<EtlStats> = {}): EtlStats {
  return {
    counts: {
      subjects,
      events: subjects * 100,
      uniqueCodes: 50,
      subjectsWithBirth: subjects,
      subjectsWithDeath: subjects / 10,
      subjectsWithStatic: subjects / 2,
      numericValues: subjects * 25,
    },
    checks: { emptyCodes: 0, nullCodes: 0, nullSubjectIds: 0, nanValues: 0, infiniteValues: 0 },
    perSubject: {
      events: quantiles(10),
      uniqueCodes: quantiles(1),
      spanDays: quantiles(30),
    },
    codeMetadata: {
      present: true,
      codes: 50,
      withDescription: 50,
      dataCodesMissing: 0,
      metadataCodesUnused: 0,
    },
    concentration: { top10: 0.3, top100: 0.8, top1000: 0.99, codesFor50: 4, codesFor90: 20, codesFor99: 45 },
    ontology: {
      eventsMapped: 0.6,
      codesWithParents: 0.25,
      vocabularies: [{ name: 'LOINC', events: subjects * 50, recognized: true }],
      suppressed: null,
    },
    ...overrides,
  };
}

/** A collected stats file; `stats: null` with a `problem` models an unreadable file. */
export function statsEntry(label: string, overrides: Partial<EtlStatsEntry> = {}): EtlStatsEntry {
  return {
    id: `org/${label.toLowerCase()}/stats/full_summary_stats.json`,
    label,
    variant: 'full',
    host: 'etl',
    githubRepo: `org/${label}`,
    path: 'stats/full_summary_stats.json',
    extractedAt: '2026-11-04T22:16:51.111265',
    schemaVersion: 1,
    toolVersion: '0.0.3',
    dataset: { name: label, version: '1.0', etlName: 'etl', etlVersion: '0.1', medsVersion: '0.4.0' },
    minCellSize: 20,
    stats: etlStats(1000),
    problem: null,
    ...overrides,
  };
}
