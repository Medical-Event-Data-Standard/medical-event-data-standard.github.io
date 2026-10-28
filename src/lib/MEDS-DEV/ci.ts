import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

const REPOSITORY = 'Medical-Event-Data-Standard/MEDS-DEV';
export const CI_REPORT_URL = `https://raw.githubusercontent.com/${REPOSITORY}/_web/ci/latest.json`;
export const CI_ACTIONS_URL = `https://github.com/${REPOSITORY}/actions`;
export const CI_STATUSES = ['passed', 'failed', 'skipped', 'cancelled', 'not_run', 'other'] as const;
export type CiStatus = (typeof CI_STATUSES)[number];
export type CiSummary = Record<CiStatus | 'total', number>;

export interface CiResult {
  model: string;
  dataset: string;
  task: string;
  status: CiStatus;
  job_conclusion: string | null;
  test_conclusion: string | null;
  job_id: number | null;
  job_url: string | null;
}

export interface CiReport {
  schema_version: 1;
  repository: string;
  run_id: number;
  run_attempt: number;
  run_url: string;
  commit_sha: string;
  branch: string;
  generated_at: string;
  scope: 'full-integration';
  summary: CiSummary;
  results: CiResult[];
}

export interface CiFilters {
  dataset?: string;
  task?: string;
  model?: string;
}

export interface CiMatrixRow {
  dataset: string;
  task: string;
  cells: Map<string, CiResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function countCiResults(results: CiResult[]): CiSummary {
  const counts: CiSummary = {
    total: results.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    cancelled: 0,
    not_run: 0,
    other: 0,
  };
  for (const result of results) counts[result.status]++;
  return counts;
}

/** Reject an invalid snapshot as a whole rather than silently hiding malformed cells. */
export function parseCiReport(input: unknown): CiReport | null {
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (
    !isRecord(input) ||
    input.schema_version !== 1 ||
    input.repository !== REPOSITORY ||
    input.scope !== 'full-integration' ||
    input.branch !== 'main' ||
    !isPositiveInteger(input.run_id) ||
    !isPositiveInteger(input.run_attempt) ||
    input.run_url !== `${CI_ACTIONS_URL}/runs/${input.run_id}` ||
    !isText(input.commit_sha) ||
    !/^[a-f0-9]{7,40}$/i.test(input.commit_sha) ||
    !isText(input.generated_at) ||
    !Number.isFinite(Date.parse(input.generated_at)) ||
    !isRecord(input.summary) ||
    !Array.isArray(input.results)
  )
    return null;

  const seen = new Set<string>();
  for (const result of input.results) {
    if (
      !isRecord(result) ||
      !isText(result.model) ||
      !isText(result.dataset) ||
      !isText(result.task) ||
      !CI_STATUSES.includes(result.status as CiStatus) ||
      !(result.job_conclusion === null || isText(result.job_conclusion)) ||
      !(result.test_conclusion === null || isText(result.test_conclusion)) ||
      !(result.job_id === null || isPositiveInteger(result.job_id)) ||
      !(
        result.job_url === null ||
        (isPositiveInteger(result.job_id) && result.job_url === `${input.run_url}/job/${result.job_id}`)
      )
    )
      return null;
    const key = JSON.stringify([result.dataset, result.task, result.model]);
    if (seen.has(key)) return null;
    seen.add(key);
  }
  const counts = countCiResults(input.results as CiResult[]);
  const summary = input.summary;
  if (Object.entries(counts).some(([key, count]) => summary[key] !== count)) return null;
  return input as unknown as CiReport;
}

export async function loadCiReport(): Promise<CiReport | null> {
  try {
    return parseCiReport(await readOrFetchToCache<unknown>(CI_REPORT_URL));
  } catch {
    // Includes unavailable browser storage as well as network/cache errors.
    return null;
  }
}

/** Only collected combinations contribute to counts; an absent cell stays absent. */
export function buildCiMatrix(results: CiResult[], filters: CiFilters = {}) {
  const filtered = results.filter(
    result =>
      (!filters.dataset || result.dataset === filters.dataset) &&
      (!filters.task || result.task === filters.task) &&
      (!filters.model || result.model === filters.model)
  );
  const models = [...new Set(filtered.map(result => result.model))].sort();
  const byRow = new Map<string, CiMatrixRow>();
  for (const result of filtered) {
    const key = JSON.stringify([result.dataset, result.task]);
    let row = byRow.get(key);
    if (!row) {
      row = { dataset: result.dataset, task: result.task, cells: new Map() };
      byRow.set(key, row);
    }
    row.cells.set(result.model, result);
  }
  const rows = [...byRow.values()].sort(
    (a, b) => a.dataset.localeCompare(b.dataset) || a.task.localeCompare(b.task)
  );
  return { models, rows, counts: countCiResults(filtered) };
}
