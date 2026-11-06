import {
  GitHubMarkdownSource,
  gitHubBlobUrl,
  isExternalUrl,
  rawGitHubUrl,
  resolveMarkdownUrl,
} from '@site/src/lib/githubMarkdown/urls';

const readme: GitHubMarkdownSource = { repo: 'Org/repo', version: 'main', path: 'README.md' };
const nested: GitHubMarkdownSource = { repo: 'Org/repo', version: '0.4.1', path: 'src/pkg/tasks/README.md' };

describe('rawGitHubUrl and gitHubBlobUrl', () => {
  it('point to the markdown file itself by default', () => {
    expect(rawGitHubUrl(readme)).toBe('https://raw.githubusercontent.com/Org/repo/main/README.md');
    expect(gitHubBlobUrl(readme)).toBe('https://github.com/Org/repo/blob/main/README.md');
  });

  it('point to another file in the repository at the same version', () => {
    expect(rawGitHubUrl(nested, 'static/logo.svg')).toBe(
      'https://raw.githubusercontent.com/Org/repo/0.4.1/static/logo.svg'
    );
    expect(gitHubBlobUrl(nested, 'LICENSE')).toBe('https://github.com/Org/repo/blob/0.4.1/LICENSE');
  });
});

describe('isExternalUrl', () => {
  it.each([
    ['https://example.org', true],
    ['HTTP://example.org/a', true],
    ['//cdn.example.org/x.png', true],
    ['#section', false],
    ['/docs/intro', false],
    ['mailto:someone@example.org', false],
  ])('%s -> %s', (url, expected) => {
    expect(isExternalUrl(url)).toBe(expected);
  });
});

describe('resolveMarkdownUrl', () => {
  it('points relative links to the file on GitHub at the shown version', () => {
    expect(resolveMarkdownUrl('CONTRIBUTORS.md', readme, 'link')).toBe(
      'https://github.com/Org/repo/blob/main/CONTRIBUTORS.md'
    );
    expect(resolveMarkdownUrl('docs/guide.md', { ...readme, version: '0.3.3' }, 'link')).toBe(
      'https://github.com/Org/repo/blob/0.3.3/docs/guide.md'
    );
  });

  it('keeps the query and fragment of relative links', () => {
    expect(resolveMarkdownUrl('docs/guide.md?plain=1#usage', readme, 'link')).toBe(
      'https://github.com/Org/repo/blob/main/docs/guide.md?plain=1#usage'
    );
  });

  it('resolves relative paths against the directory of the markdown file, like GitHub', () => {
    expect(resolveMarkdownUrl('../datasets', nested, 'link')).toBe(
      'https://github.com/Org/repo/blob/0.4.1/src/pkg/datasets'
    );
    expect(resolveMarkdownUrl('./a/../template.md', nested, 'link')).toBe(
      'https://github.com/Org/repo/blob/0.4.1/src/pkg/tasks/template.md'
    );
  });

  it('resolves root-relative paths against the repository root, and never above it', () => {
    expect(resolveMarkdownUrl('/LICENSE', nested, 'link')).toBe(
      'https://github.com/Org/repo/blob/0.4.1/LICENSE'
    );
    expect(resolveMarkdownUrl('../../../../../LICENSE', nested, 'link')).toBe(
      'https://github.com/Org/repo/blob/0.4.1/LICENSE'
    );
  });

  it('points relative images to their raw contents at the shown version', () => {
    expect(resolveMarkdownUrl('static/data_figure.svg', readme, 'image')).toBe(
      'https://raw.githubusercontent.com/Org/repo/main/static/data_figure.svg'
    );
    expect(resolveMarkdownUrl('../../../docs/img/a b.png?raw=true#x', nested, 'image')).toBe(
      'https://raw.githubusercontent.com/Org/repo/0.4.1/docs/img/a%20b.png?raw=true'
    );
  });

  it.each(['#philosophy', 'https://pypi.org/project/meds/', 'http://example.org', '//example.org/a.png'])(
    'leaves anchors and absolute URLs alone: %s',
    url => {
      expect(resolveMarkdownUrl(url, readme, 'link')).toBe(url);
      expect(resolveMarkdownUrl(url, readme, 'image')).toBe(url);
    }
  );

  it('leaves mailto links alone', () => {
    expect(resolveMarkdownUrl('mailto:someone@example.org', readme, 'link')).toBe(
      'mailto:someone@example.org'
    );
  });

  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<p>hi</p>', 'vbscript:x'])(
    'drops URLs with an unsafe scheme: %s',
    url => {
      expect(resolveMarkdownUrl(url, readme, 'link')).toBeUndefined();
      expect(resolveMarkdownUrl(url, readme, 'image')).toBeUndefined();
    }
  );

  it('drops inputs the URL parser treats as another host', () => {
    expect(resolveMarkdownUrl('\\\\example.org/a', readme, 'link')).toBeUndefined();
  });

  it('returns empty or missing URLs unchanged', () => {
    expect(resolveMarkdownUrl(undefined, readme, 'link')).toBeUndefined();
    expect(resolveMarkdownUrl('', readme, 'image')).toBe('');
  });
});
