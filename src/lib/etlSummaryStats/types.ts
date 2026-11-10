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

/** The key under which `meds_summary_stats` pools parent codes that name no vocabulary. */
export const NO_VOCABULARY_KEY = '<no-vocabulary>';

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
  /** Their pooled number of events, where published. */
  events: number | null;
}

/** One vocabulary that codes reach through `parent_codes` in the code metadata. */
export interface VocabularyCell {
  /** A published terminology's name, such as LOINC; never one of the dataset's own codes. */
  name: string;
  /** Events whose code has a parent in this vocabulary; null if the file doesn't state it. */
  events: number | null;
  /** Whether `meds_summary_stats` recognises the name as an OMOP CDM `vocabulary_id`; null if not stated. */
  recognized: boolean | null;
}

/**
 * The numbers of one stats file. Every row of a MEDS dataset is an event, including rows that share a subject and
 * time, so `events` counts rows: what `meds_summary_stats` calls `n_measurements`. (Its `n_events`, the distinct
 * subject and time pairs, is not read.)
 */
export interface EtlStats {
  counts: {
    subjects: number | null;
    /** Rows (`n_measurements`). */
    events: number | null;
    uniqueCodes: number | null;
    subjectsWithBirth: number | null;
    subjectsWithDeath: number | null;
    subjectsWithStatic: number | null;
    /** Events with a `numeric_value`. */
    numericValues: number | null;
  };
  perSubject: {
    /** Rows per subject (`per_subject.n_measurements`). */
    events: Distribution | null;
    uniqueCodes: Distribution | null;
    spanDays: Distribution | null;
    /**
     * Each subject's events per day (`per_subject.measurements_per_day`): their rows with a time, other than MEDS
     * birth and death, divided by the days from the earliest to the latest of those rows. `n` counts only the
     * subjects with a rate (two or more distinct timestamps). Absent (not just null) in stats collected before the
     * page read it.
     */
    eventsPerDay?: Distribution | null;
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
   * How concentrated the data is in its most frequent codes: the share of all events whose code is among the 10,
   * 100 and 1000 most frequent, and how many of the most frequent codes it takes to cover 50%, 90% and 99%.
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
    /** Share of events whose code has a parent code in some vocabulary. */
    eventsMapped: number | null;
    /** Share of the codes observed in the data that have a parent code. */
    codesWithParents: number | null;
    /** The reported vocabularies, sorted by name. */
    vocabularies: VocabularyCell[];
    /** Vocabularies withheld because fewer than the suppression floor of subjects reach each. */
    suppressed: SuppressedRollup | null;
    // The three fields below bound shares of events across several vocabularies. They are absent (not just null)
    // in stats collected before the page read them.
    /** Events whose code has a parent code in any vocabulary (`coverage.n_measurements_mapped`). */
    mappedEvents?: number | null;
    /**
     * Events whose code has a parent code that names no vocabulary (`<no-vocabulary>`): 0 if the file has no such
     * entry, since then there are none outside the suppressed rollup.
     */
    noVocabularyEvents?: number | null;
    /** Codes in the code metadata with parent codes in more than one vocabulary (`n_codes_in_multiple_vocabularies`). */
    codesInMultipleVocabularies?: number | null;
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

/**
 * Where a stats file is hosted: in an ETL's repository on GitHub (`etl`), or committed to this site's repository
 * (`site`), for datasets whose stats aren't published in an ETL repository.
 */
export type StatsHost = 'etl' | 'site';

/** The GitHub repository of this site, which hosts the stats files configured under `local_files`. */
export const SITE_GITHUB_REPO = 'Medical-Event-Data-Standard/medical-event-data-standard.github.io';

/**
 * A dataset name and version set in this site's configuration (`dataset_name` and `dataset_version` of a
 * `local_files` entry), shown instead of what the file's dataset.json states. A field that is absent is taken from
 * the file; one that is null shows nothing.
 */
export interface DatasetOverride {
  name?: string | null;
  version?: string | null;
}

/** One published stats file, as shown on the page. */
export interface EtlStatsEntry {
  /** `owner/repo/path`, unique per file. */
  id: string;
  label: string;
  variant: StatsVariant;
  host: StatsHost;
  /** The repository that hosts the file: the ETL's, or this site's (`SITE_GITHUB_REPO`). */
  githubRepo: string;
  /** Path of the stats file in the repository. */
  path: string;
  extractedAt: string | null;
  schemaVersion: number | null;
  toolVersion: string | null;
  dataset: DatasetInfo | null;
  /** The dataset name and version that this site's configuration shows instead of `dataset`'s, if any. */
  datasetOverride?: DatasetOverride;
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
