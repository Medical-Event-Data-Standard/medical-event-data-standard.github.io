import type { ReactElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { prepareGitHubMarkdownTree, type TreeOptions } from '@site/src/lib/githubMarkdown/tree';
import type { MarkdownComponents } from './markdownComponents';

// The same unified/remark libraries that Docusaurus renders our own `.md` docs with (through
// `@docusaurus/mdx-loader`), so they are always installed. Unlike the older `react-markdown` in our dependency
// tree, they support GitHub-flavored markdown: tables, autolinked URLs, strikethrough and task lists. Raw HTML in
// the markdown is dropped rather than rendered.
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);

/** Renders GitHub-flavored markdown to React elements, rendering the elements in `components` with them. */
export function renderMarkdown(
  markdown: string,
  components: MarkdownComponents,
  options: TreeOptions = {}
): ReactElement {
  const tree = processor.runSync(processor.parse(markdown));
  prepareGitHubMarkdownTree(tree, options);
  return toJsxRuntime(tree, {
    Fragment,
    jsx,
    jsxs,
    components,
    ignoreInvalidStyle: true,
  }) as ReactElement;
}
