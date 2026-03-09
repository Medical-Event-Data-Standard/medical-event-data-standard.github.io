const BASE_URL = 'https://raw.githubusercontent.com/Medical-Event-Data-Standard/MEDS-DEV/_web';

import { MedsEntityType, RawBenchmarkResults, MedsEntityFlatTree, BenchmarkEntryWithId } from './types';

import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

export async function loadEntities<T>(target: MedsEntityType): Promise<MedsEntityFlatTree<T> | null> {
  const url = `${BASE_URL}/entities/${target}s.json`;
  return readOrFetchToCache<MedsEntityFlatTree<T>>(url);
}

function parseIfStringAndFixNaNs(input: unknown): object | null {
  if (typeof input === 'string') {
    const fixed = input.replace(/\bNaN\b/g, 'null');
    try {
      return JSON.parse(fixed);
    } catch (err) {
      console.error('Failed to parse JSON after NaN fix:', err);
      return null;
    }
  } else if (typeof input === 'object' && input !== null) {
    return input;
  } else {
    return null;
  }
}

/**
 * Deduplicate benchmark entries by (dataset, task, model), keeping the entry
 * with the most recent timestamp for each combination.
 */
function deduplicateResults(entries: BenchmarkEntryWithId[]): BenchmarkEntryWithId[] {
  const best = new Map<string, BenchmarkEntryWithId>();

  for (const entry of entries) {
    const key = `${entry.dataset}|${entry.task}|${entry.model}`;
    const existing = best.get(key);

    if (!existing || entry.timestamp > existing.timestamp) {
      best.set(key, entry);
    }
  }

  return Array.from(best.values());
}

export async function loadMedsDevResults(): Promise<BenchmarkEntryWithId[]> {
  const url = `${BASE_URL}/results/all_results.json`;
  const out_raw = await readOrFetchToCache<RawBenchmarkResults>(url);

  const out_or_null = parseIfStringAndFixNaNs(out_raw);

  if (!out_or_null) return [];

  const out = out_or_null as RawBenchmarkResults;

  const results: BenchmarkEntryWithId[] = [];

  for (const [id, result] of Object.entries(out)) {
    if (!result) continue;
    results.push({ id, ...result });
  }

  return deduplicateResults(results);
}
