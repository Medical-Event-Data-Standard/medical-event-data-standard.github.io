/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';

import GitHubMarkdownPage from './GitHubMarkdownPage';

jest.mock('axios');
// The viewer is tested on its own; this stand-in shows the props it is given.
jest.mock('./GitHubMarkdownViewer', () => ({
  __esModule: true,
  default: ({ repo, version, markdownPath, headingOffset }: Record<string, unknown>) =>
    `viewer: ${repo}@${version}/${markdownPath} offset=${headingOffset}`,
}));
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

const mockGet = jest.mocked(axios.get);
const versionOptions = () => screen.getAllByRole('option').map(option => option.textContent);

describe('GitHubMarkdownPage', () => {
  beforeEach(() => mockGet.mockReset());

  it('lets you pick the default branch or any tag, and shows the file at that version', async () => {
    mockGet.mockResolvedValue({ data: [{ name: '0.4.1' }, { name: '0.3.3' }] });
    render(<GitHubMarkdownPage repo="Org/repo" markdownPath="README.md" headingOffset={1} />);

    expect(screen.getByText('viewer: Org/repo@main/README.md offset=1')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: '0.4.1' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('https://api.github.com/repos/Org/repo/tags', {
      params: { per_page: 100 },
    });
    expect(versionOptions()).toEqual(['main', '0.4.1', '0.3.3']);

    fireEvent.change(screen.getByLabelText('Version:'), { target: { value: '0.3.3' } });
    expect(screen.getByText('viewer: Org/repo@0.3.3/README.md offset=1')).toBeInTheDocument();
    const githubLink = screen.getByRole('link', { name: 'View README.md on GitHub' });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/Org/repo/blob/0.3.3/README.md');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });

  it('only offers the default branch when the tags cannot be fetched', async () => {
    mockGet.mockRejectedValue(new Error('API rate limit exceeded'));
    render(<GitHubMarkdownPage repo="Org/repo" markdownPath="README.md" />);
    await act(async () => {});
    expect(versionOptions()).toEqual(['main']);
  });

  it('ignores tags that arrive after the page is gone', async () => {
    let resolveTags!: (tags: { data: { name: string }[] }) => void;
    mockGet.mockReturnValue(new Promise(resolve => (resolveTags = resolve)));
    const { unmount } = render(<GitHubMarkdownPage repo="Org/repo" markdownPath="README.md" />);
    unmount();
    await act(async () => resolveTags({ data: [{ name: '0.4.1' }] }));
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
