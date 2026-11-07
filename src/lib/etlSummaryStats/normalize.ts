import {
  type DatasetInfo,
  type Distribution,
  type EtlStats,
  type EtlStatsData,
  type EtlStatsEntry,
  type SuppressedRollup,
  type VocabularyCell,
  SUPPORTED_SCHEMA_VERSIONS,
  SUPPRESSED_KEY,
} from './types';

// Validates a `meds_summary_stats` document and reduces it to the compact `EtlStats` shape the page charts. The
// files are written by tools we don't control, so every field is read defensively: a missing or mistyped field
// becomes null, and the chart that needs it skips that dataset with a note, rather than failing the build.
//
// Nothing here derives a number the document doesn't state: suppressed cells stay suppressed (only the published
// `<suppressed>` rollup is kept), and nothing is back-computed from totals.

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/** Follows `keys` into nested objects, returning undefined as soon as one is missing. */
function dig(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Reads a `{n, mean, std, quantiles}` summary, or `{n, suppressed: true}` when its quantiles were withheld. */
export function normalizeDistribution(value: unknown): Distribution | null {
  if (!isObject(value)) return null;
  const n = num(value.n);
  if (n === null) return null;
  if (value.suppressed === true) return { suppressed: true, n };
  const q = value.quantiles;
  const [p5, p25, p50, p75, p95] = ['p5', 'p25', 'p50', 'p75', 'p95'].map(key => num(dig(q, key)));
  if (p5 === null || p25 === null || p50 === null || p75 === null || p95 === null) return null;
  return { suppressed: false, n, mean: num(value.mean), p5, p25, p50, p75, p95 };
}

/**
 * Reads a keyed block such as `ontology.by_vocabulary`, whose entries backed by too few subjects were replaced by a
 * `<suppressed>` rollup. Entries that `parse` rejects are left out.
 */
export function normalizeKeyed<T>(
  value: unknown,
  parse: (key: string, cell: unknown) => T | null,
  countKey: string
): { cells: T[]; suppressed: SuppressedRollup | null } | null {
  if (!isObject(value)) return null;
  const cells: T[] = [];
  let suppressed: SuppressedRollup | null = null;
  for (const [key, cell] of Object.entries(value)) {
    if (key === SUPPRESSED_KEY) {
      if (isObject(cell)) suppressed = { cells: num(cell[countKey]), measurements: num(cell.n_measurements) };
      continue;
    }
    const parsed = parse(key, cell);
    if (parsed !== null) cells.push(parsed);
  }
  return { cells, suppressed };
}

// Vocabulary names are those of published terminologies (LOINC, ICD10CM, ...), never the dataset's own codes.
// `<no-vocabulary>` pools parent codes that name no vocabulary; it is not a vocabulary, so it is not listed.
const parseVocabulary = (key: string, cell: unknown): VocabularyCell | null => {
  if (key.startsWith('<')) return null;
  const recognized = dig(cell, 'recognized');
  return {
    name: key,
    measurements: num(dig(cell, 'n_measurements')),
    recognized: typeof recognized === 'boolean' ? recognized : null,
  };
};

/** A block that the document marks `present: false` (e.g. a dataset without a dataset.json) is absent. */
const presentBlock = (value: unknown): JsonObject | null =>
  isObject(value) && value.present !== false ? value : null;

/** Reduces a supported (schema version 1) document to the numbers the page charts. */
export function normalizeStats(doc: JsonObject): EtlStats {
  const counts = doc.counts;
  const perSubject = doc.per_subject;

  const concentrationBlock = dig(doc, 'codes', 'concentration');
  const concentration = isObject(concentrationBlock)
    ? {
        top10: num(concentrationBlock.frac_measurements_in_top_10),
        top100: num(concentrationBlock.frac_measurements_in_top_100),
        top1000: num(concentrationBlock.frac_measurements_in_top_1000),
        codesFor50: num(concentrationBlock.n_codes_covering_50pct),
        codesFor90: num(concentrationBlock.n_codes_covering_90pct),
        codesFor99: num(concentrationBlock.n_codes_covering_99pct),
      }
    : null;

  const codeMetadataBlock = doc.code_metadata;
  const codeMetadata = isObject(codeMetadataBlock)
    ? {
        present: codeMetadataBlock.present !== false,
        codes: num(codeMetadataBlock.n_codes),
        withDescription: num(codeMetadataBlock.n_with_description),
        dataCodesMissing: num(codeMetadataBlock.n_data_codes_missing_from_metadata),
        metadataCodesUnused: num(codeMetadataBlock.n_metadata_codes_absent_from_data),
      }
    : null;

  const ontologyBlock = dig(codeMetadataBlock, 'ontology');
  let ontology: EtlStats['ontology'] = null;
  if (isObject(ontologyBlock) && ontologyBlock.present === true) {
    const vocabularies = normalizeKeyed(ontologyBlock.by_vocabulary, parseVocabulary, 'n_vocabularies');
    ontology = {
      measurementsMapped: num(dig(ontologyBlock, 'coverage', 'frac_measurements_mapped')),
      codesWithParents: num(dig(ontologyBlock, 'coverage', 'frac_observed_codes_with_parents')),
      vocabularies: (vocabularies?.cells ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      suppressed: vocabularies?.suppressed ?? null,
    };
  }

  return {
    counts: {
      subjects: num(dig(counts, 'n_subjects')),
      events: num(dig(counts, 'n_events')),
      measurements: num(dig(counts, 'n_measurements')),
      uniqueCodes: num(dig(counts, 'n_unique_codes')),
      subjectsWithBirth: num(dig(counts, 'n_subjects_with_birth')),
      subjectsWithDeath: num(dig(counts, 'n_subjects_with_death')),
      subjectsWithStatic: num(dig(counts, 'n_subjects_with_static')),
      numericValues: num(dig(counts, 'numeric', 'n_present')),
    },
    checks: {
      emptyCodes: num(dig(counts, 'quality', 'n_empty_code')),
      nullCodes: num(dig(counts, 'quality', 'n_null_code')),
      nullSubjectIds: num(dig(counts, 'quality', 'n_null_subject_id')),
      nanValues: num(dig(counts, 'numeric', 'n_nan')),
      infiniteValues: num(dig(counts, 'numeric', 'n_infinite')),
    },
    perSubject: {
      measurements: normalizeDistribution(dig(perSubject, 'n_measurements')),
      events: normalizeDistribution(dig(perSubject, 'n_events')),
      uniqueCodes: normalizeDistribution(dig(perSubject, 'n_unique_codes')),
      spanDays: normalizeDistribution(dig(perSubject, 'span_days')),
    },
    codeMetadata,
    concentration,
    ontology,
  };
}

function normalizeDataset(value: unknown): DatasetInfo | null {
  const block = presentBlock(value);
  if (!block) return null;
  return {
    name: str(block.dataset_name),
    version: str(block.dataset_version),
    etlName: str(block.etl_name),
    etlVersion: str(block.etl_version),
    medsVersion: str(block.meds_version),
  };
}

export type NormalizedDocument = Pick<
  EtlStatsEntry,
  'extractedAt' | 'schemaVersion' | 'toolVersion' | 'dataset' | 'minCellSize' | 'stats' | 'problem'
>;

/**
 * Validates a parsed stats file. Throws if it is not a `meds_summary_stats` document at all. A document with a
 * schema version the page doesn't know is kept (so it is listed, with its version), but with `stats: null` and a
 * `problem`, since its fields may mean something else.
 */
export function normalizeStatsDocument(doc: unknown): NormalizedDocument {
  if (!isObject(doc)) throw new Error('it is not a JSON object');
  const schemaVersion = doc.stats_schema_version;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw new Error('it has no `stats_schema_version`, so it is not a meds_summary_stats file');
  }
  const base = {
    extractedAt: str(doc.extracted_at),
    schemaVersion,
    toolVersion: str(doc.meds_summary_stats_version),
    dataset: normalizeDataset(doc.dataset),
    minCellSize: num(dig(doc, 'config', 'min_cell_size')),
  };
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    return {
      ...base,
      stats: null,
      problem:
        `Its stats schema version is ${schemaVersion}, which this page cannot read yet ` +
        `(it reads version ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}).`,
    };
  }
  return { ...base, stats: normalizeStats(doc), problem: null };
}

/** A loose structural check of the committed snapshot (which this site wrote), so a corrupt one is ignored. */
export function isEtlStatsData(value: unknown): value is EtlStatsData {
  if (!isObject(value)) return false;
  const { updatedAt, datasets, reposWithoutStats } = value;
  return (
    (updatedAt === null || typeof updatedAt === 'string') &&
    Array.isArray(datasets) &&
    datasets.every(
      entry =>
        isObject(entry) &&
        ['id', 'label', 'githubRepo', 'path'].every(key => typeof entry[key] === 'string') &&
        (entry.stats === null || isObject(entry.stats))
    ) &&
    Array.isArray(reposWithoutStats) &&
    reposWithoutStats.every(repo => isObject(repo) && typeof repo.githubRepo === 'string')
  );
}
