import { describe, expect, it } from '@jest/globals';
import { attachPackageMetadata } from '@site/src/lib/ecosystem/packageMetadata';
import { EcosystemMetadata } from '@site/src/lib/ecosystem/types';

const metadata: EcosystemMetadata = {
  'org/repo': { stars: 7, lastUpdated: '2026-01-02T00:00:00Z', release: 'v0.1.0' },
};

describe('attachPackageMetadata', () => {
  it('looks up metadata by GitHub repo, case-insensitively', () => {
    const pkg = attachPackageMetadata({ name: 'Pkg', githubRepo: 'Org/Repo' }, metadata);
    expect(pkg).toEqual({
      name: 'Pkg',
      githubRepo: 'Org/Repo',
      stars: 7,
      lastUpdated: new Date('2026-01-02T00:00:00Z'),
      release: 'v0.1.0',
    });
  });

  it('returns nulls for packages without a repo or without fetched metadata', () => {
    const expected = { stars: null, lastUpdated: null, release: null };
    expect(attachPackageMetadata({ name: 'No repo' }, metadata)).toMatchObject(expected);
    expect(attachPackageMetadata({ name: 'Unknown', githubRepo: 'org/other' }, metadata)).toMatchObject(
      expected
    );
    expect(attachPackageMetadata({ name: 'No data', githubRepo: 'org/repo' }, undefined)).toMatchObject(
      expected
    );
  });
});
