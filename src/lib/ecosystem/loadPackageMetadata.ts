import { Package, PackageWithMetadata, GitHubRepoResponse, GitHubReleaseResponse } from './types';
import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

async function loadRepoInfo(pkg: Package): Promise<GitHubRepoResponse | null> {
  if (!pkg.github_repo) {
    throw new Error(`Package ${pkg.name} does not have a GitHub repository.`);
  }

  const repoUrl = `https://api.github.com/repos/${pkg.github_repo}`;
  return readOrFetchToCache<GitHubRepoResponse>(repoUrl);
}

async function loadReleaseInfo(pkg: Package): Promise<GitHubReleaseResponse | null> {
  if (!pkg.github_repo) {
    throw new Error(`Package ${pkg.name} does not have a GitHub repository.`);
  }

  const releaseUrl = `https://api.github.com/repos/${pkg.github_repo}/releases/latest`;
  return readOrFetchToCache<GitHubReleaseResponse>(releaseUrl);
}

export async function loadPackageMetadata(pkg: Package): Promise<PackageWithMetadata> {
  if (!pkg.github_repo) return pkg;

  const repoInfo = (await loadRepoInfo(pkg)) || {};
  const { tag_name: latest_release = 'N/A' } = (await loadReleaseInfo(pkg)) || {};

  return {
    ...pkg,
    ...repoInfo,
    latest_release,
  };
}
