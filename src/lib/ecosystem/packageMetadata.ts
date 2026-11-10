import type { EcosystemPluginData, Package, PackageWithMetadata } from './types';
import { ownerKey, repoKey } from './githubMetadata';

/**
 * Attaches the GitHub metadata fetched at build time, and the committed logo of the package's GitHub owner (both
 * from the `ecosystem-metadata` plugin), to a package. Packages without a GitHub repository, or whose metadata
 * could not be fetched during the build, get `null`s; those whose owner has no logo get a `null` logo.
 */
export function attachPackageMetadata(
  pkg: Package,
  data: EcosystemPluginData | undefined
): PackageWithMetadata {
  const repoMetadata = pkg.githubRepo ? data?.repos[repoKey(pkg.githubRepo)] : undefined;
  return {
    ...pkg,
    stars: repoMetadata?.stars ?? null,
    lastUpdated: repoMetadata?.lastUpdated ? new Date(repoMetadata.lastUpdated) : null,
    release: repoMetadata?.release ?? null,
    logo: (pkg.githubRepo && data?.logos[ownerKey(pkg.githubRepo)]) || null,
  };
}
