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
      numeric: { n_present: 30000, mean: 1, std: 2 },
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
      },
    },
    code_metadata: {
      present: true,
      ontology: {
        present: true,
        coverage: { frac_measurements_mapped: 0.4, frac_observed_codes_with_parents: 0.2 },
        by_vocabulary: {
          LOINC: { n_measurements: 10, n_subjects: 30, keys_digest: 'sha256:def' },
          ICD10CM: { n_measurements: 5, n_subjects: 25 },
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

const quantiles = (scale: number) => ({
  suppressed: false as const,
  n: 100,
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
      events: subjects * 10,
      measurements: subjects * 100,
      uniqueCodes: 50,
      subjectsWithBirth: subjects,
      subjectsWithDeath: subjects / 10,
      subjectsWithStatic: subjects / 2,
      numericValues: subjects * 25,
    },
    perSubject: {
      measurements: quantiles(10),
      events: quantiles(2),
      uniqueCodes: quantiles(1),
      spanDays: quantiles(30),
    },
    byYear: { years: [2100, 2102], measurements: [1000, 3000], subjects: [100, 300], suppressed: null },
    splits: {
      cells: [
        { split: 'train', subjects: subjects * 0.8, measurements: 80 },
        { split: 'tuning', subjects: subjects * 0.1, measurements: 10 },
        { split: 'held_out', subjects: subjects * 0.1, measurements: 10 },
      ],
      suppressed: null,
    },
    concentration: { top10: 0.3, top100: 0.8, top1000: 0.99 },
    ontology: { measurementsMapped: 0.6, codesWithParents: 0.25, vocabularies: ['LOINC'], suppressed: null },
    ...overrides,
  };
}

/** A collected stats file; `stats: null` with a `problem` models an unreadable file. */
export function statsEntry(label: string, overrides: Partial<EtlStatsEntry> = {}): EtlStatsEntry {
  return {
    id: `org/${label.toLowerCase()}/stats/full_summary_stats.json`,
    label,
    variant: 'full',
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
