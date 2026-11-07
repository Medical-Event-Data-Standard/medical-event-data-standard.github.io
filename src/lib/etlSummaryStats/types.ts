// Shared between the build-time `etl-summary-stats` plugin (plugins/etlSummaryStats.ts, Node.js) and the dataset
// statistics page in the browser. Only types and constants, so it is cheap to load in both environments.
//
// The shapes below are a compact subset of a `meds_summary_stats` document
// (https://github.com/Medical-Event-Data-Standard/meds_summary_stats): only the numbers the page charts. Digests,
// `time` (calendar years, which de-identified datasets shift), `splits`, `layout`, `config` (apart from the
// suppression floor) and per-vocabulary moments are deliberately dropped, since this is global data that every page
// of the site loads.

/** Name of the build-time plugin that collects the ETLs' published `meds_summary_stats` files. */
export const ETL_SUMMARY_STATS_PLUGIN = 'etl-summary-stats';

/** The `stats_schema_version`s of `meds_summary_stats` documents that the page knows how to read. */
export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1];

/** The key under which `meds_summary_stats` rolls up cells backed by too few subjects. */
export const SUPPRESSED_KEY = '<suppressed>';

/** Whether a stats file describes the full dataset or a small, openly available demo of it. */
export type StatsVariant = 'full' | 'demo';

/**
 * The distribution of a per-subject quantity, reduced to the quantiles the page draws. `meds_summary_stats`
 * withholds the quantiles below a minimum number of values, in which case only `n` is published.
 */
export type Distribution =
  | {
      suppressed: false;
      n: number;
      /** Null if the file doesn't state it. */
      mean: number | null;
      p5: number;
      p25: number;
      p50: number;
      p75: number;
      p95: number;
    }
  | { suppressed: true; n: number };

/** A rollup of keyed cells (here: vocabularies) that were withheld because too few subjects backed each. */
export interface SuppressedRollup {
  /** How many cells were withheld, where published. */
  cells: number | null;
  /** Their pooled number of measurements, where published. */
  measurements: number | null;
}

/** One vocabulary that codes reach through `parent_codes` in the code metadata. */
export interface VocabularyCell {
  /** A published terminology's name, such as LOINC; never one of the dataset's own codes. */
  name: string;
  /** Measurements whose code has a parent in this vocabulary; null if the file doesn't state it. */
  measurements: number | null;
  /** Whether `meds_summary_stats` recognises the name as an OMOP CDM `vocabulary_id`; null if not stated. */
  recognized: boolean | null;
}

export interface EtlStats {
  counts: {
    subjects: number | null;
    events: number | null;
    measurements: number | null;
    uniqueCodes: number | null;
    subjectsWithBirth: number | null;
    subjectsWithDeath: number | null;
    subjectsWithStatic: number | null;
    /** Measurements with a `numeric_value`. */
    numericValues: number | null;
  };
  perSubject: {
    measurements: Distribution | null;
    events: Distribution | null;
    uniqueCodes: Distribution | null;
    spanDays: Distribution | null;
  };
  /** Counts that are zero in a valid MEDS dataset (`counts.quality`, and the non-finite numeric values). */
  checks: {
    emptyCodes: number | null;
    nullCodes: number | null;
    nullSubjectIds: number | null;
    nanValues: number | null;
    infiniteValues: number | null;
  };
  /** What `metadata/codes.parquet` holds; null if the file doesn't report on it. */
  codeMetadata: {
    /** False if the dataset has no `metadata/codes.parquet`. */
    present: boolean;
    codes: number | null;
    /** Null if codes.parquet has no description column. */
    withDescription: number | null;
    /** Codes in the data that codes.parquet lacks (MEDS requires none). */
    dataCodesMissing: number | null;
    /** Codes in codes.parquet that never occur in the data. */
    metadataCodesUnused: number | null;
  } | null;
  /**
   * How concentrated the data is in its most frequent codes: the share of all measurements whose code is among
   * the 10, 100 and 1000 most frequent, and how many of the most frequent codes it takes to cover 50%, 90% and 99%.
   */
  concentration: {
    top10: number | null;
    top100: number | null;
    top1000: number | null;
    codesFor50: number | null;
    codesFor90: number | null;
    codesFor99: number | null;
  } | null;
  /** Mapping of codes to external vocabularies via `parent_codes`; null if the code metadata has none. */
  ontology: {
    /** Share of measurements whose code has a parent code in some vocabulary. */
    measurementsMapped: number | null;
    /** Share of the codes observed in the data that have a parent code. */
    codesWithParents: number | null;
    /** The reported vocabularies, sorted by name. */
    vocabularies: VocabularyCell[];
    /** Vocabularies withheld because fewer than the suppression floor of subjects reach each. */
    suppressed: SuppressedRollup | null;
  } | null;
}

/** `metadata/dataset.json` of the dataset the stats describe. */
export interface DatasetInfo {
  name: string | null;
  version: string | null;
  etlName: string | null;
  etlVersion: string | null;
  medsVersion: string | null;
}

/** One published stats file, as shown on the page. */
export interface EtlStatsEntry {
  /** `owner/repo/path`, unique per file. */
  id: string;
  label: string;
  variant: StatsVariant;
  githubRepo: string;
  /** Path of the stats file in the repository. */
  path: string;
  extractedAt: string | null;
  schemaVersion: number | null;
  toolVersion: string | null;
  dataset: DatasetInfo | null;
  /** Cells backed by fewer distinct subjects than this were suppressed by `meds_summary_stats`. */
  minCellSize: number | null;
  /** Null if the file could not be read, e.g. because its schema version is not supported. */
  stats: EtlStats | null;
  /** Why `stats` is null, shown on the page. */
  problem: string | null;
}

/** An ETL repository that was searched but has no stats file (yet). */
export interface RepoWithoutStats {
  githubRepo: string;
  name: string;
}

/** The plugin's global data, and the format of the committed snapshot. */
export interface EtlStatsData {
  /** When the files were last collected from GitHub (ISO 8601), or null if never. */
  updatedAt: string | null;
  datasets: EtlStatsEntry[];
  reposWithoutStats: RepoWithoutStats[];
}
