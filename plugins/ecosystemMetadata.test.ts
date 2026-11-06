import { describe, expect, it, jest } from '@jest/globals';
import { collectGithubRepos, fetchEcosystemMetadata } from './ecosystemMetadata';

function jsonResponse(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('collectGithubRepos', () => {
  it('collects repos from nested categories, de-duplicating case-insensitively', () => {
    const yaml = {
      tools: {
        name: 'Tools',
        core: { packages: [{ name: 'A', github_repo: 'Org/A' }, { name: 'No repo' }] },
        sub: { deeper: { packages: [{ name: 'B', github_repo: ' org/b ' }] } },
      },
      datasets: { packages: [{ name: 'A again', github_repo: 'org/a' }, { github_repo: 42 }] },
    };
    expect(collectGithubRepos(yaml)).toEqual(['Org/A', 'org/b']);
  });

  it('handles empty input', () => {
    expect(collectGithubRepos(null)).toEqual([]);
  });
});

describe('fetchEcosystemMetadata', () => {
  const responses: Record<string, Response> = {
    'https://api.github.com/repos/org/ok': jsonResponse(200, {
      stargazers_count: 12,
      updated_at: '2026-01-02T00:00:00Z',
    }),
    'https://api.github.com/repos/org/ok/releases/latest': jsonResponse(200, { tag_name: 'v1.2.3' }),
    'https://api.github.com/repos/Org/NoRelease': jsonResponse(200, { stargazers_count: 0 }),
    'https://api.github.com/repos/Org/NoRelease/releases/latest': jsonResponse(404),
    'https://api.github.com/repos/org/limited': jsonResponse(403),
  };
  const makeFetch = () =>
    jest.fn<(url: string, init?: RequestInit) => Promise<Response>>(async url => {
      if (url === 'https://api.github.com/repos/org/throws') throw new Error('network down');
      return responses[url] ?? jsonResponse(500);
    });

  it('returns stars and releases, treats a missing release as normal, and reports failures', async () => {
    const fetchFn = makeFetch();
    const repos = ['org/ok', 'Org/NoRelease', 'org/limited', 'org/throws'];
    const { metadata, failures } = await fetchEcosystemMetadata(repos, { fetchFn });

    expect(metadata).toEqual({
      'org/ok': { stars: 12, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.2.3' },
      'org/norelease': { stars: 0, lastUpdated: null, release: null },
    });
    expect(failures.sort()).toEqual(['org/limited: HTTP 403', 'org/throws: network down']);
    // No release lookups for repos whose info could not be fetched.
    expect(fetchFn).not.toHaveBeenCalledWith(
      'https://api.github.com/repos/org/limited/releases/latest',
      expect.anything()
    );
  });

  it('sends the token only when one is given', async () => {
    const fetchFn = makeFetch();
    await fetchEcosystemMetadata(['org/ok'], { fetchFn, token: 'secret' });
    await fetchEcosystemMetadata(['org/ok'], { fetchFn });

    const authHeaders = fetchFn.mock.calls.map(
      ([, init]) => (init?.headers as Record<string, string>).Authorization
    );
    expect(authHeaders).toEqual(['Bearer secret', 'Bearer secret', undefined, undefined]);
  });
});
