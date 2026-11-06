import type { EcosystemMetadata, Package, PackageWithMetadata } from './types';
import { repoKey } from './githubMetadata';

/**
 * Attaches the GitHub metadata fetched at build time (by the `ecosystem-metadata` plugin) to a package.
 * Packages without a GitHub repository, or whose metadata could not be fetched during the build, get `null`s.
 */
export function attachPackageMetadata(
  pkg: Package,
  metadata: EcosystemMetadata | undefined
): PackageWithMetadata {
  const repoMetadata = pkg.githubRepo ? metadata?.[repoKey(pkg.githubRepo)] : undefined;
  return {
    ...pkg,
    stars: repoMetadata?.stars ?? null,
    lastUpdated: repoMetadata?.lastUpdated ? new Date(repoMetadata.lastUpdated) : null,
    release: repoMetadata?.release ?? null,
  };
}
