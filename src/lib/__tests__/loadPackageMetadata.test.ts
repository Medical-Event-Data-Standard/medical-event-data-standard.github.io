import { loadPackageMetadata } from '../ecosystem/loadPackageMetadata';

jest.mock('../loadAndCache', () => ({
  readOrFetchToCache: jest.fn(),
}));

import { readOrFetchToCache } from '../loadAndCache';

describe('loadPackageMetadata', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns nulls when no github repo', async () => {
    const pkg = { name: 'pkg' } as any;
    const result = await loadPackageMetadata(pkg);
    expect(result).toEqual({ ...pkg, stars: null, lastUpdated: null, release: null });
  });

  it('fetches metadata when repo given', async () => {
    (readOrFetchToCache as jest.Mock).mockResolvedValueOnce({
      stargazers_count: 5,
      updated_at: '2020-01-01T00:00:00Z',
    });
    (readOrFetchToCache as jest.Mock).mockResolvedValueOnce({ tag_name: 'v1' });
    const pkg = { name: 'pkg', githubRepo: 'meds/pkg' } as any;
    const result = await loadPackageMetadata(pkg);
    expect(result.stars).toBe(5);
    expect(result.lastUpdated?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(result.release).toBe('v1');
  });
});
