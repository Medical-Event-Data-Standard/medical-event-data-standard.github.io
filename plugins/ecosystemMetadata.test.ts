import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LoadContext, PluginContentLoadedActions } from '@docusaurus/types';
import ecosystemMetadataPlugin, { collectGithubRepos, fetchEcosystemMetadata } from './ecosystemMetadata';

function jsonResponse(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const responses: Record<string, Response> = {
  'https://api.github.com/repos/org/ok': jsonResponse(200, {
    stargazers_count: 12,
    updated_at: '2026-01-02T00:00:00Z',
  }),
  'https://api.github.com/repos/org/ok/releases/latest': jsonResponse(200, { tag_name: 'v1.2.3' }),
  'https://api.github.com/repos/Org/NoRelease': jsonResponse(200, { stargazers_count: 0 }),
  'https://api.github.com/repos/Org/NoRelease/releases/latest': jsonResponse(404),
  'https://api.github.com/repos/org/limited': jsonResponse(403),
  'https://api.github.com/repos/org/bad-release': jsonResponse(200, { stargazers_count: 3 }),
  'https://api.github.com/repos/org/bad-release/releases/latest': jsonResponse(500),
};

const makeFetch = () =>
  jest.fn<(url: string, init?: RequestInit) => Promise<Response>>(async url => {
    if (url === 'https://api.github.com/repos/org/throws') throw new Error('network down');
    if (url === 'https://api.github.com/repos/org/throws-string') throw 'not an Error';
    return responses[url] ?? jsonResponse(500);
  });

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
  it('returns stars and releases, treats a missing release as normal, and reports failures', async () => {
    const fetchFn = makeFetch();
    const repos = ['org/ok', 'Org/NoRelease', 'org/limited', 'org/throws', 'org/bad-release'];
    const { metadata, failures } = await fetchEcosystemMetadata(repos, { fetchFn });

    expect(metadata).toEqual({
      'org/ok': { stars: 12, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.2.3' },
      'org/norelease': { stars: 0, lastUpdated: null, release: null },
      // A failed release lookup keeps the stars.
      'org/bad-release': { stars: 3, lastUpdated: null, release: null },
    });
    expect(failures.sort()).toEqual([
      'org/bad-release (latest release): HTTP 500',
      'org/limited: HTTP 403',
      'org/throws: network down',
    ]);
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

  it('tolerates incomplete responses and non-Error failures, using the global fetch by default', async () => {
    const originalFetch = globalThis.fetch;
    const fetchFn = makeFetch();
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    responses['https://api.github.com/repos/org/sparse'] = jsonResponse(200, {});
    responses['https://api.github.com/repos/org/sparse/releases/latest'] = jsonResponse(200, {});
    try {
      const { metadata, failures } = await fetchEcosystemMetadata(['org/sparse', 'org/throws-string']);
      expect(metadata).toEqual({ 'org/sparse': { stars: null, lastUpdated: null, release: null } });
      expect(failures).toEqual(['org/throws-string: not an Error']);
      expect(fetchFn).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      delete responses['https://api.github.com/repos/org/sparse'];
      delete responses['https://api.github.com/repos/org/sparse/releases/latest'];
    }
  });
});

describe('ecosystemMetadataPlugin', () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  let siteDir: string;
  let yamlPath: string;

  const writeEcosystemYaml = (repos: string[]) =>
    fs.writeFile(
      yamlPath,
      [
        'tools:',
        '  packages:',
        ...repos.map(repo => `    - name: '${repo}'\n      github_repo: '${repo}'`),
      ].join('\n')
    );

  beforeEach(async () => {
    siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecosystem-metadata-'));
    yamlPath = path.join(siteDir, 'static', 'data', 'ecosystem.yaml');
    await fs.mkdir(path.dirname(yamlPath), { recursive: true });
    globalThis.fetch = makeFetch() as unknown as typeof fetch;
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    jest.restoreAllMocks();
    await fs.rm(siteDir, { recursive: true, force: true });
  });

  it('fetches metadata for the repos in ecosystem.yaml and publishes it as global data', async () => {
    process.env.GITHUB_TOKEN = 'secret';
    await writeEcosystemYaml(['org/ok']);
    const plugin = ecosystemMetadataPlugin({ siteDir } as LoadContext);

    expect(plugin.name).toBe('ecosystem-metadata');
    expect(plugin.getPathsToWatch?.()).toEqual([yamlPath]);

    const content = await plugin.loadContent?.();
    expect(content).toEqual({
      'org/ok': { stars: 12, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.2.3' },
    });
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('1/1 repos'));
    expect(console.warn).not.toHaveBeenCalled();

    const setGlobalData = jest.fn();
    await plugin.contentLoaded?.({
      content,
      actions: { setGlobalData } as unknown as PluginContentLoadedActions,
    });
    expect(setGlobalData).toHaveBeenCalledWith(content);
  });

  it('warns about failed requests, suggesting GITHUB_TOKEN only when it is unset', async () => {
    await writeEcosystemYaml(['org/ok', 'org/limited']);

    delete process.env.GITHUB_TOKEN;
    const content = await ecosystemMetadataPlugin({ siteDir } as LoadContext).loadContent?.();
    expect(Object.keys(content as object)).toEqual(['org/ok']);
    const warning = jest.mocked(console.warn).mock.calls[0][0];
    expect(warning).toContain('1/2 repos');
    expect(warning).toContain('org/limited: HTTP 403');
    expect(warning).toContain('GITHUB_TOKEN is not set');

    process.env.GITHUB_TOKEN = 'secret';
    await ecosystemMetadataPlugin({ siteDir } as LoadContext).loadContent?.();
    expect(jest.mocked(console.warn).mock.calls[1][0]).not.toContain('GITHUB_TOKEN is not set');
  });
});
