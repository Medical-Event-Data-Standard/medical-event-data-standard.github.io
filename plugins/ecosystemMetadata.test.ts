import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { LoadContext, PluginContentLoadedActions } from '@docusaurus/types';
import ecosystemMetadataPlugin, {
  collectGithubRepos,
  downloadEcosystemLogos,
  fetchEcosystemMetadata,
  isIdenticon,
  logoExtension,
  type GitHubOwner,
} from './ecosystemMetadata';

function jsonResponse(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function imageResponse(bytes: Uint8Array, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => bytes.slice().buffer,
  } as Response;
}

/** The start of a square PNG `size` pixels wide: its signature and IHDR chunk. */
function png(size: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, size);
  view.setUint32(20, size);
  return bytes;
}
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF = new TextEncoder().encode('GIF89a');

const responses: Record<string, Response> = {
  'https://api.github.com/repos/org/ok': jsonResponse(200, {
    stargazers_count: 12,
    updated_at: '2026-01-02T00:00:00Z',
    owner: {
      login: 'Org',
      type: 'Organization',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
  }),
  'https://avatars.githubusercontent.com/u/1?v=4&s=64': imageResponse(png(64)),
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
    const { metadata, owners, failures } = await fetchEcosystemMetadata(repos, { fetchFn });

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
    // Each owner once, from its first repository's details; the login is the repository's spelling if they lack it.
    expect([...owners]).toEqual([
      [
        'org',
        { login: 'Org', type: 'Organization', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' },
      ],
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
      const { metadata, owners, failures } = await fetchEcosystemMetadata([
        'org/sparse',
        'org/throws-string',
      ]);
      expect(metadata).toEqual({ 'org/sparse': { stars: null, lastUpdated: null, release: null } });
      expect([...owners]).toEqual([['org', { login: 'org', type: null, avatarUrl: null }]]);
      expect(failures).toEqual(['org/throws-string: not an Error']);
      expect(fetchFn).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      delete responses['https://api.github.com/repos/org/sparse'];
      delete responses['https://api.github.com/repos/org/sparse/releases/latest'];
    }
  });
});

describe('logoExtension', () => {
  it('recognises PNG, JPEG and GIF images by their first bytes', () => {
    expect(logoExtension(png(64))).toBe('png');
    expect(logoExtension(JPEG)).toBe('jpg');
    expect(logoExtension(GIF)).toBe('gif');
  });

  it('rejects anything else, including SVG, ICO and HTML', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(logoExtension(encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(logoExtension(encode('<!doctype html><html></html>'))).toBeNull();
    expect(logoExtension(new Uint8Array([0x00, 0x00, 0x01, 0x00]))).toBeNull();
    expect(logoExtension(new Uint8Array())).toBeNull();
  });
});

describe('isIdenticon', () => {
  it("is true for a PNG that isn't the requested size, as GitHub returns its identicons", () => {
    expect(isIdenticon(png(420), 64)).toBe(true);
    expect(isIdenticon(png(64), 64)).toBe(false);
  });

  it('is false for other images, and for PNGs too short to have a width', () => {
    expect(isIdenticon(JPEG, 64)).toBe(false);
    expect(isIdenticon(png(420).slice(0, 20), 64)).toBe(false);
  });
});

const AVATARS = 'https://avatars.githubusercontent.com/u';
const organization = (login: string, id: number): GitHubOwner => ({
  login,
  type: 'Organization',
  avatarUrl: `${AVATARS}/${id}?v=4`,
});
const OWNERS = new Map<string, GitHubOwner>([
  ['org', organization('Org', 1)],
  ['jpeg-org', organization('jpeg-org', 2)],
  ['person', { login: 'person', type: 'User', avatarUrl: `${AVATARS}/3?v=4` }],
  ['identicon-org', organization('identicon-org', 4)],
  ['html-org', organization('html-org', 5)],
  ['broken-avatar', organization('broken-avatar', 6)],
  ['no-avatar-url', { login: 'no-avatar-url', type: 'Organization', avatarUrl: null }],
]);
const avatarResponses: Record<string, Response> = {
  [`${AVATARS}/1?v=4&s=64`]: imageResponse(png(64)),
  [`${AVATARS}/2?v=4&s=64`]: imageResponse(JPEG),
  [`${AVATARS}/3?v=4&s=64`]: imageResponse(JPEG),
  [`${AVATARS}/4?v=4&s=64`]: imageResponse(png(420)),
  [`${AVATARS}/5?v=4&s=64`]: imageResponse(new TextEncoder().encode('<html></html>')),
  [`${AVATARS}/6?v=4&s=64`]: imageResponse(new Uint8Array(), 404),
};
const makeAvatarFetch = () =>
  jest.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async url => avatarResponses[url] ?? jsonResponse(500)
  );

describe('downloadEcosystemLogos', () => {
  let siteDir: string;
  let logosDir: string;

  beforeEach(async () => {
    siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ecosystem-logos-'));
    logosDir = path.join(siteDir, 'static', 'img', 'ecosystem-logos');
  });

  afterEach(async () => {
    await fs.rm(siteDir, { recursive: true, force: true });
  });

  const writeLogos = async (files: string[]) => {
    await fs.mkdir(logosDir, { recursive: true });
    await Promise.all(files.map(file => fs.writeFile(path.join(logosDir, file), 'old')));
  };

  it("downloads organizations' avatars by lower-cased owner, and deletes the logos no longer wanted", async () => {
    await writeLogos([
      'gone.png', // Its owner is no longer listed.
      'person.jpg', // A personal account.
      'org.jpg', // Replaced by org.png.
      'identicon-org.png', // Its owner no longer has an uploaded avatar.
      'limited.png', // Kept, as its repositories' details couldn't be fetched.
      'html-org.gif', // Kept, as its owner's avatar is not an image.
      'notes.txt', // Not a logo.
    ]);
    const fetchFn = makeAvatarFetch();
    const repos = [
      'Org/a',
      'org/b',
      'jpeg-org/c',
      'person/d',
      'identicon-org/e',
      'html-org/f',
      'broken-avatar/g',
      'no-avatar-url/h',
      'limited/i',
      'unknown/j', // Its details weren't fetched, and it has no earlier logo.
    ];
    const result = await downloadEcosystemLogos(siteDir, repos, OWNERS, { fetchFn });

    expect(result).toEqual({
      logos: {
        'html-org': 'img/ecosystem-logos/html-org.gif',
        'jpeg-org': 'img/ecosystem-logos/jpeg-org.jpg',
        limited: 'img/ecosystem-logos/limited.png',
        org: 'img/ecosystem-logos/org.png',
      },
      without: ['identicon-org (no uploaded avatar)', 'person (personal account)'],
      failures: [
        'broken-avatar: avatar: HTTP 404',
        'html-org: the avatar is not a PNG, JPEG or GIF image',
        'no-avatar-url: no avatar URL',
      ],
    });
    expect((await fs.readdir(logosDir)).sort()).toEqual([
      'html-org.gif',
      'jpeg-org.jpg',
      'limited.png',
      'notes.txt',
      'org.png',
    ]);
    expect(new Uint8Array(await fs.readFile(path.join(logosDir, 'org.png')))).toEqual(png(64));
    expect(new Uint8Array(await fs.readFile(path.join(logosDir, 'jpeg-org.jpg')))).toEqual(JPEG);

    const urls = fetchFn.mock.calls.map(([url]) => url);
    // One download per owner, whichever of its repositories are listed; no GitHub API requests at all.
    expect(urls.filter(url => url === `${AVATARS}/1?v=4&s=64`)).toHaveLength(1);
    expect(urls.some(url => url.startsWith('https://api.github.com/'))).toBe(false);
    // A personal account's avatar is not downloaded.
    expect(urls).not.toContain(`${AVATARS}/3?v=4&s=64`);
  });

  it("downloads personal accounts' avatars too with `personalAccounts`, creating the folder if needed", async () => {
    const result = await downloadEcosystemLogos(siteDir, ['person/d'], OWNERS, {
      fetchFn: makeAvatarFetch(),
      personalAccounts: true,
    });
    expect(result.logos).toEqual({ person: 'img/ecosystem-logos/person.jpg' });
    expect(await fs.readdir(logosDir)).toEqual(['person.jpg']);
  });

  it('uses the global fetch by default', async () => {
    const originalFetch = globalThis.fetch;
    const fetchFn = makeAvatarFetch();
    globalThis.fetch = fetchFn as unknown as typeof fetch;
    try {
      const { logos } = await downloadEcosystemLogos(siteDir, ['org/a'], OWNERS);
      expect(logos).toEqual({ org: 'img/ecosystem-logos/org.png' });
      expect(fetchFn).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
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

  it('publishes the metadata of the repos in ecosystem.yaml as global data, with the logos', async () => {
    process.env.GITHUB_TOKEN = 'secret';
    await writeEcosystemYaml(['org/ok']);
    const plugin = ecosystemMetadataPlugin({ siteDir } as LoadContext);

    expect(plugin.name).toBe('ecosystem-metadata');
    expect(plugin.getPathsToWatch?.()).toEqual([yamlPath]);

    const content = await plugin.loadContent?.();
    expect(content).toEqual({
      repos: { 'org/ok': { stars: 12, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.2.3' } },
      logos: { org: 'img/ecosystem-logos/org.png' },
    });
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('1/1 repos, and the logos of 1 owners')
    );
    expect(console.warn).not.toHaveBeenCalled();
    const logo = path.join(siteDir, 'static', 'img', 'ecosystem-logos', 'org.png');
    expect(new Uint8Array(await fs.readFile(logo))).toEqual(png(64));

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
    expect(content).toEqual({
      repos: { 'org/ok': expect.anything() },
      logos: { org: 'img/ecosystem-logos/org.png' },
    });
    const warning = jest.mocked(console.warn).mock.calls[0][0];
    expect(warning).toContain('1/2 repos');
    expect(warning).toContain('org/limited: HTTP 403');
    expect(warning).toContain('GITHUB_TOKEN is not set');

    process.env.GITHUB_TOKEN = 'secret';
    await ecosystemMetadataPlugin({ siteDir } as LoadContext).loadContent?.();
    expect(jest.mocked(console.warn).mock.calls[1][0]).not.toContain('GITHUB_TOKEN is not set');
  });

  it("warns about logos that couldn't be fetched", async () => {
    await writeEcosystemYaml(['org/ok']);
    const fetchFn = makeFetch();
    globalThis.fetch = jest.fn<typeof fetch>(async (url, init) =>
      String(url).startsWith('https://avatars.githubusercontent.com/')
        ? imageResponse(new Uint8Array(), 503)
        : fetchFn(String(url), init)
    ) as unknown as typeof fetch;

    const content = await ecosystemMetadataPlugin({ siteDir } as LoadContext).loadContent?.();
    expect(content).toEqual({ repos: { 'org/ok': expect.anything() }, logos: {} });
    expect(jest.mocked(console.warn).mock.calls[0][0]).toContain(
      'Could not fetch the logos of 1 owners, whose cards show their earlier logo or the MEDS logo:\n  Org: avatar: HTTP 503'
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('1/1 repos, and the logos of 0 owners')
    );
  });
});
