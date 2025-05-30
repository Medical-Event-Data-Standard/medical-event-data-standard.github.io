const BASE_URL = 'https://raw.githubusercontent.com/Medical-Event-Data-Standard/MEDS-DEV/_web';

import { MedsEntityType, RawBenchmarkResults, MedsEntityFlatTree, BenchmarkEntryWithId } from './types';

import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

export async function loadEntities<T>(target: MedsEntityType): Promise<MedsEntityFlatTree<T> | null> {
  const url = `${BASE_URL}/entities/${target}s.json`;
  return readOrFetchToCache<MedsEntityFlatTree<T>>(url);
}

function parseIfStringAndFixNaNs(input: unknown): object | null {
  if (typeof input === 'string') {
    // Replace standalone `NaN` with `null`
    const fixed = input.replace(/\bNaN\b/g, 'null');
    try {
      return JSON.parse(fixed);
    } catch (err) {
      console.error('Failed to parse JSON after NaN fix:', err);
      return null;
    }
  } else if (typeof input === 'object' && input !== null) {
    return input; // Already a valid object
  } else {
    console.warn('Unexpected input type:', typeof input);
    return null;
  }
}

export async function loadMedsDevResults(): Promise<BenchmarkEntryWithId[]> {
  const url = `${BASE_URL}/results/all_results.json`;
  const out_raw = await readOrFetchToCache<RawBenchmarkResults>(url);

  const out_or_null = parseIfStringAndFixNaNs(out_raw);

  if (!out_or_null) return [];

  const out = out_or_null as RawBenchmarkResults;

  const results: BenchmarkEntryWithId[] = [];

  let i: number = 0;

  for (const [id, result] of Object.entries(out)) {
    if (!result) continue;

    const entry: BenchmarkEntryWithId = { id, ...result };
    console.log(`Processing entry ${id}:`, entry);

    results.push(entry);
    i++;

    if (i > 100) {
      console.warn('Processed 100 entries, stopping to avoid excessive output');
      break;
    }
  }

  console.log(`Total processed entries: ${i}`);
  return results;
}
