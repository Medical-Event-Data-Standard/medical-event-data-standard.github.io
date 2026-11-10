// Shared between the build-time `ecosystem-metadata` plugin (plugins/ecosystemMetadata.ts, Node.js) and the
// browser. Keep this file free of imports so it is cheap to load in both environments.

/** Name of the build-time plugin that fetches GitHub metadata (stars, releases) for ecosystem packages. */
export const ECOSYSTEM_METADATA_PLUGIN = 'ecosystem-metadata';

/**
 * Where the committed logos of the packages' GitHub owners are served, relative to the site's base URL. They are
 * files in static/img/ecosystem-logos, named by `ownerKey`, which `npm run ecosystem:logos` downloads.
 */
export const ECOSYSTEM_LOGOS_PATH = 'img/ecosystem-logos';

/** The logo shown on the card of a package whose GitHub owner has no logo in `ECOSYSTEM_LOGOS_PATH`. */
export const DEFAULT_PACKAGE_LOGO = 'img/logo.svg';

/** Key under which a repository's metadata is stored. GitHub `owner/repo` names are case-insensitive. */
export function repoKey(githubRepo: string): string {
  return githubRepo.trim().toLowerCase();
}

/** Key under which the logo of a repository's owner is stored: the lower-cased owner of `owner/repo`. */
export function ownerKey(githubRepo: string): string {
  return repoKey(githubRepo).split('/')[0];
}
