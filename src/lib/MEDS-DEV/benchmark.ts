import { loadMedsDevResults } from './load';

import { BenchmarkEntryWithId } from './types';

export async function getFilteredResults(
  dataset: string | null = null,
  task: string | null = null,
  model: string | null = null
): Promise<BenchmarkEntryWithId[]> {
  let results: BenchmarkEntryWithId[] = await loadMedsDevResults();

  if (dataset) {
    results = results.filter(r => r.dataset === dataset);
  }

  if (task) {
    results = results.filter(r => r.task === task);
  }

  if (model) {
    results = results.filter(r => r.model === model);
  }

  return results;
}
