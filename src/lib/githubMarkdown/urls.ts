/** A markdown file in a GitHub repository, at a given version. */
export interface GitHubMarkdownSource {
  /** The repository, as `owner/name`. */
  repo: string;
  /** The branch, tag or commit to read the file at. */
  version: string;
  /** The path of the markdown file within the repository, e.g. `README.md` or `docs/guide.md`. */
  path: string;
}

/** Whether a URL is a link target (shown on GitHub) or an image source (loaded from raw.githubusercontent). */
export type MarkdownUrlKind = 'link' | 'image';

// Absolute URLs with these schemes are kept as they are; any other scheme (e.g. `javascript:`) is dropped.
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const SCHEME = /^[a-z][a-z\d+.-]*:/i;
// A placeholder origin to resolve relative paths against; it never ends up in a returned URL.
const REPO_ROOT = 'https://repo.invalid';

/** The URL of the raw contents of a file in the repository (by default, the markdown file itself). */
export function rawGitHubUrl({ repo, version, path }: GitHubMarkdownSource, filePath: string = path): string {
  return `https://raw.githubusercontent.com/${repo}/${version}/${filePath}`;
}

/** The URL of the GitHub page showing a file in the repository (by default, the markdown file itself). */
export function gitHubBlobUrl(
  { repo, version, path }: GitHubMarkdownSource,
  filePath: string = path
): string {
  return `https://github.com/${repo}/blob/${version}/${filePath}`;
}

/** Whether a URL points to another site (`http(s)://...` or protocol-relative `//...`). */
export function isExternalUrl(url: string): boolean {
  return /^(https?:)?\/\//i.test(url);
}

/**
 * Rewrites a link or image URL found in a markdown file from GitHub so that it also works when the file is
 * rendered on this site.
 *
 * Relative paths are resolved the way GitHub resolves them: against the directory of the markdown file, or
 * against the repository root if they start with `/`. Links then point to the file's GitHub page and images to
 * its raw contents, both at `source.version`. Anchors (`#...`) and absolute URLs are returned unchanged, except
 * that URLs with an unsafe scheme such as `javascript:` are dropped (`undefined` is returned).
 */
export function resolveMarkdownUrl(
  url: string | undefined,
  source: GitHubMarkdownSource,
  kind: MarkdownUrlKind
): string | undefined {
  if (!url || url.startsWith('#') || url.startsWith('//')) return url;

  const scheme = SCHEME.exec(url);
  if (scheme) return SAFE_PROTOCOLS.has(scheme[0].toLowerCase()) ? url : undefined;

  const resolved = new URL(url, `${REPO_ROOT}/${source.path}`);
  // Inputs such as `\\example.org` are treated as absolute by the URL parser; they are not repository paths.
  if (resolved.origin !== REPO_ROOT) return undefined;

  const filePath = resolved.pathname.slice(1);
  return kind === 'image'
    ? rawGitHubUrl(source, filePath) + resolved.search
    : gitHubBlobUrl(source, filePath) + resolved.search + resolved.hash;
}
