import { parseReadme } from '../parseMarkdown';

describe('parseReadme', () => {
  it('extracts title and normalizes headings', () => {
    const md = '# Title\n## Subtitle\nContent';
    const result = parseReadme(md, 'fallback');
    expect(result.title).toBe('Title');
    expect(result.content).toBe('### Subtitle\nContent');
  });

  it('handles front matter and fallback title', () => {
    const md = '---\na: 1\n---\nNo heading here';
    const result = parseReadme(md, 'Fallback');
    expect(result.title).toBe('Fallback');
    expect(result.content).toBe('No heading here');
  });
});
