import { isLiveTracked, liveStatsUrl, loadLiveStats } from './live';
import { statsDocument, statsEntry } from './testFixtures';
import { normalizeStatsDocument } from './normalize';
import { SITE_GITHUB_REPO } from './types';

/** A response with the given body, as `fetch` would return it. */
const respond = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }) as Response;

/** An entry exactly as the build collected it from the given document. */
const collected = (label: string, doc: Record<string, unknown>) =>
  statsEntry(label, normalizeStatsDocument(doc));

describe('liveStatsUrl', () => {
  it("loads a file from its repository's default branch on raw.githubusercontent.com", () => {
    expect(
      liveStatsUrl({ githubRepo: 'org/ETL_MEDS', path: 'tests/regression/full_summary_stats.json' })
    ).toBe('https://raw.githubusercontent.com/org/ETL_MEDS/HEAD/tests/regression/full_summary_stats.json');
  });

  it("tracks the ETLs' files, not those committed to this site's repository", () => {
    expect(isLiveTracked(statsEntry('ETL'))).toBe(true);
    expect(isLiveTracked(statsEntry('Local', { host: 'site', githubRepo: SITE_GITHUB_REPO }))).toBe(false);
  });
});

describe('loadLiveStats', () => {
  const old = statsDocument();
  const updated = statsDocument({
    extracted_at: '2026-11-12T08:00:00',
    counts: { ...(old.counts as Record<string, unknown>), n_subjects: 650 },
  });

  it('replaces each file with its current version, and counts those that changed', async () => {
    const changed = collected('Changed', old);
    const same = collected('Same', old);
    const fetchFn = jest.fn<Promise<Response>, [string, RequestInit?]>(async url =>
      respond(url === liveStatsUrl(changed) ? updated : old)
    );

    const live = await loadLiveStats([changed, same], fetchFn, () => new Date('2026-11-12T09:00:00Z'));

    expect(fetchFn.mock.calls.map(([url, init]) => [url, init])).toEqual([
      [liveStatsUrl(changed), { cache: 'no-cache' }],
      [liveStatsUrl(same), { cache: 'no-cache' }],
    ]);
    expect(live.datasets.map(entry => entry.stats?.counts.subjects)).toEqual([650, 500]);
    expect(live.datasets[0]).toMatchObject({
      id: changed.id,
      label: 'Changed',
      variant: 'full',
      host: 'etl',
      extractedAt: '2026-11-12T08:00:00',
    });
    expect(live.datasets[1]).toEqual(same);
    expect(live).toMatchObject({ loaded: 2, changed: 1, failed: [], checkedAt: '2026-11-12T09:00:00.000Z' });
  });

  it("keeps the version the build collected for a file that can't be loaded or read, and this site's own files", async () => {
    const missing = collected('Missing', old);
    const offline = collected('Offline', old);
    const broken = collected('Broken', old);
    const local = statsEntry('Local', { host: 'site', githubRepo: SITE_GITHUB_REPO });
    const fetchFn = jest.fn<Promise<Response>, [string, RequestInit?]>(async url => {
      if (url === liveStatsUrl(missing)) return respond({}, 404);
      if (url === liveStatsUrl(offline)) throw new TypeError('Failed to fetch');
      return respond({ not: 'a stats file' });
    });

    const live = await loadLiveStats([missing, offline, broken, local], fetchFn);

    expect(live.datasets).toEqual([missing, offline, broken, local]);
    expect(live).toMatchObject({ loaded: 0, changed: 0, failed: ['Missing', 'Offline', 'Broken'] });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
