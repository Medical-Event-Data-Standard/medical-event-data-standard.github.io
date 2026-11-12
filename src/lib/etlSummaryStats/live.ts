import { normalizeStatsDocument } from './normalize';
import type { EtlStatsEntry } from './types';

// Keeps the "Datasets" page (src/pages/datasets.mdx) up to date between builds of the site. The build collects the
// ETLs' `meds_summary_stats` files (plugins/etlSummaryStats.ts), and the page shows those first; then, in the
// browser, it loads the current version of each file from its repository's default branch (`HEAD`, i.e. `main`) on
// raw.githubusercontent.com, which allows cross-origin requests and caches files for at most 5 minutes, and shows
// that instead. A file that can't be loaded keeps the version the build collected.
//
// Only the files the build found are refreshed: finding new ones takes the GitHub API, whose limit for a browser
// (60 requests an hour) a single visitor would soon reach. New files appear when the site is next built. Files
// committed to this site's repository (`local_files`) are part of the site, so they are not refreshed either.

const RAW_GITHUB = 'https://raw.githubusercontent.com';

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Where the current version of a stats file is loaded from: its repository's default branch. */
export const liveStatsUrl = (entry: Pick<EtlStatsEntry, 'githubRepo' | 'path'>): string =>
  `${RAW_GITHUB}/${entry.githubRepo}/HEAD/${entry.path}`;

/** Whether the page loads the current version of a file, rather than showing the one the build collected. */
export const isLiveTracked = (entry: Pick<EtlStatsEntry, 'host'>): boolean => entry.host === 'etl';

export interface LiveStats {
  /** The entries, with each file that could be loaded replaced by its current version. */
  datasets: EtlStatsEntry[];
  /** How many files were loaded. */
  loaded: number;
  /** How many of those differ from the version the build collected. */
  changed: number;
  /** The labels of the files that couldn't be loaded, which keep the version the build collected. */
  failed: string[];
  /** When the files were loaded (ISO 8601). */
  checkedAt: string;
}

/** Loads the current version of one file, as the build would read it. Throws if it can't. */
async function loadEntry(entry: EtlStatsEntry, fetchFn: FetchFn): Promise<EtlStatsEntry> {
  // `no-cache` asks the browser to revalidate rather than reuse a copy from an earlier visit.
  const res = await fetchFn(liveStatsUrl(entry), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const normalized = normalizeStatsDocument(JSON.parse(await res.text()));
  // The file's identity, label and variant, and any dataset name this site sets, come from the site's configuration.
  return { ...entry, ...normalized };
}

/**
 * Loads the current version of every file the page tracks (see `isLiveTracked`), in parallel. Never throws: a file
 * that can't be loaded, or isn't a stats document any more, keeps the version the build collected.
 */
export async function loadLiveStats(
  entries: EtlStatsEntry[],
  fetchFn: FetchFn,
  now: () => Date = () => new Date()
): Promise<LiveStats> {
  const results = await Promise.all(
    entries.map(async entry => {
      if (!isLiveTracked(entry)) return { entry, status: 'kept' as const };
      try {
        const current = await loadEntry(entry, fetchFn);
        const changed = JSON.stringify(current) !== JSON.stringify(entry);
        return { entry: current, status: changed ? ('changed' as const) : ('same' as const) };
      } catch {
        return { entry, status: 'failed' as const };
      }
    })
  );
  return {
    datasets: results.map(result => result.entry),
    loaded: results.filter(result => result.status === 'changed' || result.status === 'same').length,
    changed: results.filter(result => result.status === 'changed').length,
    failed: results.filter(result => result.status === 'failed').map(result => result.entry.label),
    checkedAt: now().toISOString(),
  };
}
