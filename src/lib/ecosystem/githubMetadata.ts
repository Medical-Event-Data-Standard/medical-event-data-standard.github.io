// Shared between the build-time `ecosystem-metadata` plugin (plugins/ecosystemMetadata.ts, Node.js) and the
// browser. Keep this file free of imports so it is cheap to load in both environments.

/** Name of the build-time plugin that fetches GitHub metadata (stars, releases) for ecosystem packages. */
export const ECOSYSTEM_METADATA_PLUGIN = 'ecosystem-metadata';

/** Key under which a repository's metadata is stored. GitHub `owner/repo` names are case-insensitive. */
export function repoKey(githubRepo: string): string {
  return githubRepo.trim().toLowerCase();
}
