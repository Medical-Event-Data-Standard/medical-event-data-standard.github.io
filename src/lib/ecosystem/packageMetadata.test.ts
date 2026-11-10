import { describe, expect, it } from '@jest/globals';
import { attachPackageMetadata } from '@site/src/lib/ecosystem/packageMetadata';
import { EcosystemPluginData } from '@site/src/lib/ecosystem/types';

const data: EcosystemPluginData = {
  repos: { 'org/repo': { stars: 7, lastUpdated: '2026-01-02T00:00:00Z', release: 'v0.1.0' } },
  logos: { org: 'img/ecosystem-logos/org.png' },
};

describe('attachPackageMetadata', () => {
  it('looks up metadata by GitHub repo and the logo by its owner, case-insensitively', () => {
    const pkg = attachPackageMetadata({ name: 'Pkg', githubRepo: 'Org/Repo' }, data);
    expect(pkg).toEqual({
      name: 'Pkg',
      githubRepo: 'Org/Repo',
      stars: 7,
      lastUpdated: new Date('2026-01-02T00:00:00Z'),
      release: 'v0.1.0',
      logo: 'img/ecosystem-logos/org.png',
    });
  });

  it("gives other repos of the same owner its logo, even when their metadata wasn't fetched", () => {
    expect(attachPackageMetadata({ name: 'Other', githubRepo: 'ORG/other' }, data)).toMatchObject({
      stars: null,
      logo: 'img/ecosystem-logos/org.png',
    });
  });

  it('returns nulls for packages without a repo, or without fetched metadata or a logo', () => {
    const expected = { stars: null, lastUpdated: null, release: null, logo: null };
    expect(attachPackageMetadata({ name: 'No repo' }, data)).toMatchObject(expected);
    expect(attachPackageMetadata({ name: 'Unknown', githubRepo: 'someone/other' }, data)).toMatchObject(
      expected
    );
    expect(attachPackageMetadata({ name: 'No data', githubRepo: 'org/repo' }, undefined)).toMatchObject(
      expected
    );
  });
});
