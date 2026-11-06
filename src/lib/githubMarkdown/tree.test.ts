import {
  GITHUB_ALERT_PROPERTY,
  TreeNode,
  createSlugger,
  markGitHubAlert,
  prepareGitHubMarkdownTree,
  textContent,
} from '@site/src/lib/githubMarkdown/tree';

const text = (value: string): TreeNode => ({ type: 'text', value });
const el = (
  tagName: string,
  children: TreeNode[] = [],
  properties: Record<string, unknown> = {}
): TreeNode => ({
  type: 'element',
  tagName,
  properties,
  children,
});
// The hast `remark-rehype` produces for `> [!NOTE]\n> Some text`: blockquote children are wrapped in newlines.
const blockquote = (...children: TreeNode[]) => el('blockquote', [text('\n'), ...children, text('\n')]);

describe('createSlugger', () => {
  it('turns heading text into the anchor id GitHub gives it', () => {
    const slug = createSlugger();
    expect(slug('Philosophy')).toBe('philosophy');
    expect(slug('Example: MIMIC-IV demo dataset')).toBe('example-mimic-iv-demo-dataset');
    expect(slug('The DataSchema schema')).toBe('the-dataschema-schema');
    expect(slug('Re-running commands and do_overwrite')).toBe('re-running-commands-and-do_overwrite');
    expect(slug('Sentinel Split Names:')).toBe('sentinel-split-names');
    expect(slug('Ünïcode “quotes”')).toBe('ünïcode-quotes');
  });

  it('numbers repeated headings', () => {
    const slug = createSlugger();
    expect(['Examples', 'Examples', 'Examples'].map(slug)).toEqual(['examples', 'examples-1', 'examples-2']);
    expect(createSlugger()('Examples')).toBe('examples');
  });
});

describe('textContent', () => {
  it('concatenates the text of all descendants', () => {
    expect(textContent(el('h3', [text('The '), el('code', [text('DataSchema')]), text(' schema')]))).toBe(
      'The DataSchema schema'
    );
    expect(textContent({ type: 'text' })).toBe('');
    expect(textContent({ type: 'comment' })).toBe('');
  });
});

describe('markGitHubAlert', () => {
  it('marks an alert and removes its marker', () => {
    const quote = blockquote(el('p', [text('[!NOTE]\nMEDS also tracks '), el('code', [text('text_value')])]));
    expect(markGitHubAlert(quote)).toBe('note');
    expect(quote.properties).toEqual({ [GITHUB_ALERT_PROPERTY]: 'note' });
    expect(quote.children).toEqual([
      text('\n'),
      el('p', [text('MEDS also tracks '), el('code', [text('text_value')])]),
      text('\n'),
    ]);
  });

  it('removes a paragraph that only held the marker', () => {
    const quote = blockquote(el('p', [text('[!Warning] ')]), text('\n'), el('p', [text('Careful.')]));
    expect(markGitHubAlert(quote)).toBe('warning');
    expect(quote.children).toEqual([text('\n'), text('\n'), el('p', [text('Careful.')]), text('\n')]);
  });

  it.each(['tip', 'important', 'caution'])('recognizes [!%s]', type => {
    expect(markGitHubAlert(blockquote(el('p', [text(`[!${type.toUpperCase()}]\nText`)])))).toBe(type);
  });

  it('skips text nodes without a value before the first paragraph', () => {
    expect(markGitHubAlert(blockquote({ type: 'text' }, el('p', [text('[!NOTE]\nText')])))).toBe('note');
  });

  it.each([
    ['a plain quote', blockquote(el('p', [text('Just a quote.')]))],
    ['an unknown alert type', blockquote(el('p', [text('[!FOO]\nText')]))],
    ['a marker that is not on its own line', blockquote(el('p', [text('[!NOTE] text on the same line')]))],
    ['a quote that starts with a list', blockquote(el('ul', [el('li', [text('[!NOTE]')])]))],
    ['a quote that starts with a link', blockquote(el('p', [el('a', [text('[!NOTE]')])]))],
    ['a paragraph without children', blockquote({ type: 'element', tagName: 'p' })],
    ['an empty paragraph', blockquote(el('p', []))],
    ['a paragraph starting with a text node without a value', blockquote(el('p', [{ type: 'text' }]))],
    ['an empty quote', { type: 'element', tagName: 'blockquote' }],
  ])('leaves %s alone', (_, quote) => {
    const before = JSON.stringify(quote);
    expect(markGitHubAlert(quote)).toBeUndefined();
    expect(JSON.stringify(quote)).toBe(before);
  });
});

describe('prepareGitHubMarkdownTree', () => {
  const tree = () =>
    el('root', [
      el('h1', [text('Title')]),
      el('h2', [text('Examples')]),
      el('h6', [text('Examples')]),
      el('h3', [text('Custom')], { id: 'kept' }),
      blockquote(el('p', [text('[!TIP]\nUse it.')])),
      el('p', [text('Not a heading')]),
    ]);

  it('gives headings GitHub anchor ids, keeping existing ids', () => {
    const root = tree();
    prepareGitHubMarkdownTree(root);
    const headings = root.children!.filter(node => /^h\d$/.test(node.tagName ?? ''));
    expect(headings.map(node => [node.tagName, node.properties?.id])).toEqual([
      ['h1', 'title'],
      ['h2', 'examples'],
      ['h6', 'examples-1'],
      ['h3', 'kept'],
    ]);
    expect(root.children![5].properties).toEqual({});
  });

  it('demotes headings by headingOffset, down to h6 at most', () => {
    const root = tree();
    prepareGitHubMarkdownTree(root, { headingOffset: 1 });
    expect(root.children!.slice(0, 4).map(node => node.tagName)).toEqual(['h2', 'h3', 'h6', 'h4']);
  });

  it('marks GitHub alerts anywhere in the tree', () => {
    const root = el('root', [el('li', [blockquote(el('p', [text('[!CAUTION]\nNested.')]))])]);
    prepareGitHubMarkdownTree(root);
    expect(root.children![0].children![0].properties).toEqual({ [GITHUB_ALERT_PROPERTY]: 'caution' });
    const top = tree();
    prepareGitHubMarkdownTree(top);
    expect(top.children![4].properties).toEqual({ [GITHUB_ALERT_PROPERTY]: 'tip' });
  });

  it('tolerates elements without a tag name or properties', () => {
    const root = el('root', [
      { type: 'element' },
      { type: 'element', tagName: 'h2', children: [text('Bare')] },
    ]);
    prepareGitHubMarkdownTree(root, { headingOffset: -3 });
    expect(root.children).toEqual([
      { type: 'element' },
      { type: 'element', tagName: 'h1', properties: { id: 'bare' }, children: [text('Bare')] },
    ]);
  });
});
