/**
 * Adjusts the HTML syntax tree (hast) of a markdown file from GitHub before it is rendered, so that it reads the
 * way it does on GitHub: headings get GitHub's anchor ids (so in-page links such as `#philosophy` work), and
 * GitHub alerts (`> [!NOTE]` blockquotes) are marked so they can be rendered as admonitions.
 */

/** The parts of a hast node that are read or changed here; hast trees from `remark-rehype` satisfy it. */
export interface TreeNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: TreeNode[];
}

export interface TreeOptions {
  /**
   * How many levels to demote every heading by (capped at `h6`). Use `1` when the page already has its own
   * `h1`, so that the markdown file's title does not compete with it.
   */
  headingOffset?: number;
}

/** The GitHub alert types; Docusaurus admonitions support each of them as a `type`. */
export const GITHUB_ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type GitHubAlertType = (typeof GITHUB_ALERT_TYPES)[number];

/** The property set on a blockquote that is a GitHub alert; it is rendered as a `data-github-alert` attribute. */
export const GITHUB_ALERT_PROPERTY = 'dataGithubAlert';

const ALERT_MARKER = new RegExp(`^\\[!(${GITHUB_ALERT_TYPES.join('|')})\\][ \\t]*(\\r?\\n|$)`, 'i');
// Characters GitHub removes when it turns a heading into an anchor id: all but letters, marks, numbers,
// connector punctuation (such as `_`), hyphens and spaces.
const SLUG_REMOVED = new RegExp('[^\\p{L}\\p{M}\\p{N}\\p{Pc}\\- ]', 'gu');

/**
 * Returns a function that turns heading text into the anchor id GitHub gives it. Repeated headings get a
 * numbered suffix (`-1`, `-2`, ...), so one slugger should be used per document.
 */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return text => {
    const slug = text.toLowerCase().replace(SLUG_REMOVED, '').replace(/ /g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    return count === 0 ? slug : `${slug}-${count}`;
  };
}

/** The concatenated text of a node and its descendants. */
export function textContent(node: TreeNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function isBlankText(node: TreeNode): boolean {
  return node.type === 'text' && !node.value?.trim();
}

/**
 * If `blockquote` is a GitHub alert, removes the `[!TYPE]` marker from its first line, marks the blockquote
 * with its type and returns the type; otherwise leaves it unchanged and returns `undefined`.
 */
export function markGitHubAlert(blockquote: TreeNode): GitHubAlertType | undefined {
  const children = blockquote.children ?? [];
  const paragraph = children.find(child => !isBlankText(child));
  if (paragraph?.type !== 'element' || paragraph.tagName !== 'p' || !paragraph.children) return undefined;

  const firstText = paragraph.children[0];
  if (firstText?.type !== 'text') return undefined;
  const value = firstText.value ?? '';
  const match = ALERT_MARKER.exec(value);
  if (!match) return undefined;

  firstText.value = value.slice(match[0].length);
  // A marker on its own (followed by a blank line) leaves an empty paragraph behind.
  if (paragraph.children.every(isBlankText)) children.splice(children.indexOf(paragraph), 1);

  const type = match[1].toLowerCase() as GitHubAlertType;
  blockquote.properties = { ...blockquote.properties, [GITHUB_ALERT_PROPERTY]: type };
  return type;
}

/** Adds GitHub's anchor ids to headings, applies `headingOffset`, and marks GitHub alerts, in place. */
export function prepareGitHubMarkdownTree(tree: TreeNode, { headingOffset = 0 }: TreeOptions = {}): void {
  const slug = createSlugger();
  const visit = (node: TreeNode) => {
    const heading = node.type === 'element' ? /^h([1-6])$/.exec(node.tagName ?? '') : null;
    if (heading) {
      if (node.properties?.id === undefined)
        node.properties = { ...node.properties, id: slug(textContent(node)) };
      node.tagName = `h${Math.min(6, Math.max(1, Number(heading[1]) + headingOffset))}`;
    } else if (node.type === 'element' && node.tagName === 'blockquote') {
      markGitHubAlert(node);
    }
    node.children?.forEach(visit);
  };
  visit(tree);
}
