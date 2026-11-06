/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import axios from 'axios';

import GitHubMarkdownViewer from './GitHubMarkdownViewer';
import { renderMarkdown } from './renderMarkdown';

jest.mock('axios');
// The unified/remark packages `renderMarkdown` uses are ESM-only, which this Jest setup does not load. This
// stand-in shows the markdown as text and renders one relative link with the components it is given, so the
// tests can check which source the links resolve against.
jest.mock('./renderMarkdown', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  return {
    renderMarkdown: jest.fn((markdown: string, components: { a: React.FC<React.ComponentProps<'a'>> }) =>
      createElement(
        Fragment,
        null,
        createElement('p', null, markdown),
        createElement(components.a, { href: 'CONTRIBUTORS.md' }, 'contributors')
      )
    ),
  };
});
jest.mock(
  '@docusaurus/Link',
  () => {
    const { createElement } = jest.requireActual<typeof import('react')>('react');
    return {
      __esModule: true,
      default: ({ to, ...props }: { to: string }) => createElement('a', { ...props, href: to }),
    };
  },
  { virtual: true }
);
jest.mock('@theme/Admonition', () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock('@theme/Heading', () => ({ __esModule: true, default: () => null }), { virtual: true });

const mockGet = jest.mocked(axios.get);
const mockRenderMarkdown = jest.mocked(renderMarkdown);

/** A promise for `axios.get` that the test settles when it chooses. */
function deferred() {
  let resolve!: (content: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = content => res({ data: content });
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('GitHubMarkdownViewer', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockRenderMarkdown.mockClear();
  });

  it('fetches the file at the given version and renders it', async () => {
    mockGet.mockResolvedValue({ data: '# Hello' });
    render(
      <GitHubMarkdownViewer repo="Org/repo" version="0.4.1" markdownPath="docs/README.md" headingOffset={1} />
    );

    expect(screen.getByText('Loading docs/README.md...')).toBeInTheDocument();
    expect(await screen.findByText('# Hello')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('https://raw.githubusercontent.com/Org/repo/0.4.1/docs/README.md', {
      responseType: 'text',
    });
    expect(mockRenderMarkdown).toHaveBeenCalledWith('# Hello', expect.any(Object), { headingOffset: 1 });
    // Relative links resolve against the file's directory, at the shown version.
    expect(screen.getByRole('link', { name: 'contributors' })).toHaveAttribute(
      'href',
      'https://github.com/Org/repo/blob/0.4.1/docs/CONTRIBUTORS.md'
    );
  });

  it('does not demote headings by default', async () => {
    mockGet.mockResolvedValue({ data: 'text' });
    render(<GitHubMarkdownViewer repo="Org/repo" version="main" markdownPath="README.md" />);
    await screen.findByText('text');
    expect(mockRenderMarkdown).toHaveBeenCalledWith('text', expect.any(Object), { headingOffset: 0 });
  });

  it('links to the file on GitHub when it cannot be loaded', async () => {
    mockGet.mockRejectedValue(new Error('Request failed with status code 404'));
    render(<GitHubMarkdownViewer repo="Org/repo" version="main" markdownPath="README.md" />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Could not load README.md from GitHub (Request failed with status code 404)'
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Org/repo/blob/main/README.md'
    );
    expect(mockRenderMarkdown).not.toHaveBeenCalled();
  });

  it('shows the latest version when an earlier request finishes last', async () => {
    const first = deferred();
    const second = deferred();
    mockGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <GitHubMarkdownViewer repo="Org/repo" version="0.3.3" markdownPath="README.md" />
    );
    rerender(<GitHubMarkdownViewer repo="Org/repo" version="0.4.1" markdownPath="README.md" />);
    expect(mockGet).toHaveBeenLastCalledWith(
      'https://raw.githubusercontent.com/Org/repo/0.4.1/README.md',
      expect.anything()
    );

    await act(async () => second.resolve('version 0.4.1'));
    await act(async () => first.reject(new Error('too late')));
    expect(screen.getByText('version 0.4.1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the error of the latest version when an earlier request succeeds last', async () => {
    const first = deferred();
    const second = deferred();
    mockGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { rerender } = render(
      <GitHubMarkdownViewer repo="Org/repo" version="0.3.3" markdownPath="README.md" />
    );
    rerender(<GitHubMarkdownViewer repo="Org/repo" version="0.4.1" markdownPath="README.md" />);

    await act(async () => second.reject(new Error('Network Error')));
    await act(async () => first.resolve('version 0.3.3'));
    expect(screen.getByRole('alert')).toHaveTextContent('Network Error');
    expect(screen.queryByText('version 0.3.3')).not.toBeInTheDocument();
  });
});
