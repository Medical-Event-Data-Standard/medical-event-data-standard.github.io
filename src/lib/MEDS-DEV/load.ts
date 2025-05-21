const BASE_URL = 'https://raw.githubusercontent.com/Medical-Event-Data-Standard/MEDS-DEV/_web';

import { MedsEntityType, BenchmarkResults, MedsEntityFlatTree } from './types';

import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

export async function loadEntities<T>(target: MedsEntityType): Promise<MedsEntityFlatTree<T> | null> {
  const url = `${BASE_URL}/entities/${target}.json`;
  return readOrFetchToCache<MedsEntityFlatTree<T>>(url);
}

export async function loadMedsDevResults(): Promise<BenchmarkResults | null> {
  const url = `${BASE_URL}/results/all_results.json`;
  return readOrFetchToCache<BenchmarkResults>(url);
}
