import { Package, PackageWithMetadata } from './types';
import { readOrFetchToCache } from '@site/src/lib/loadAndCache';

interface GitHubRepoResponse {
  stargazers_count: number;
  updated_at: string;
}

interface GitHubReleaseResponse {
  tag_name: string;
}

async function loadRepoInfo(pkg: Package): Promise<GitHubRepoResponse | null> {
  if (!pkg.githubRepo) {
    throw new Error(`Package ${pkg.name} does not have a GitHub repository.`);
  }

  const repoUrl = `https://api.github.com/repos/${pkg.githubRepo}`;
  return readOrFetchToCache<GitHubRepoResponse>(repoUrl);
}

async function loadReleaseInfo(pkg: Package): Promise<GitHubReleaseResponse | null> {
  if (!pkg.githubRepo) {
    throw new Error(`Package ${pkg.name} does not have a GitHub repository.`);
  }

  const releaseUrl = `https://api.github.com/repos/${pkg.githubRepo}/releases/latest`;
  return readOrFetchToCache<GitHubReleaseResponse>(releaseUrl);
}

export async function loadPackageMetadata(pkg: Package): Promise<PackageWithMetadata> {
  if (!pkg.githubRepo)
    return {
      ...pkg,
      stars: null,
      lastUpdated: null,
      release: null,
    };

  const repoInfo: GitHubRepoResponse | null = await loadRepoInfo(pkg);
  if (!repoInfo) {
    console.warn(`No repository info found for package ${pkg.name}`);
  }

  const { stargazers_count: stars = null, updated_at: lastUpdatedStr = null } = repoInfo || {};
  const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;

  const releaseInfo: GitHubReleaseResponse | null = await loadReleaseInfo(pkg);
  let release: string | null = null;
  if (!releaseInfo || !releaseInfo.tag_name) {
    console.warn(`No release info found for package ${pkg.name}`);
  } else {
    release = releaseInfo.tag_name;
  }

  return {
    ...pkg,
    stars,
    lastUpdated,
    release,
  };
}
