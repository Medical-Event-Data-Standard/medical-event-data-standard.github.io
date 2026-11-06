import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Link from '@docusaurus/Link';

import { GitHubMarkdownSource, gitHubBlobUrl, rawGitHubUrl } from '@site/src/lib/githubMarkdown/urls';
import { createMarkdownComponents } from './markdownComponents';
import { renderMarkdown } from './renderMarkdown';

export interface GitHubMarkdownViewerProps {
  /** The repository, as `owner/name`. */
  repo: string;
  /** The branch, tag or commit to show the file at. */
  version: string;
  /** The path of the markdown file within the repository. */
  markdownPath: string;
  /** How many levels to demote the file's headings by; see `TreeOptions.headingOffset`. */
  headingOffset?: number;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; content: string };

/** Fetches a markdown file from GitHub in the browser and renders it, with links and images pointing to GitHub. */
export default function GitHubMarkdownViewer({
  repo,
  version,
  markdownPath,
  headingOffset = 0,
}: GitHubMarkdownViewerProps) {
  const source: GitHubMarkdownSource = useMemo(
    () => ({ repo, version, path: markdownPath }),
    [repo, version, markdownPath]
  );
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    // Ignore a response that arrives after the source changed (e.g. when versions are switched quickly).
    let current = true;
    setState({ status: 'loading' });
    axios
      .get<string>(rawGitHubUrl(source), { responseType: 'text' })
      .then(res => {
        if (current) setState({ status: 'loaded', content: res.data });
      })
      .catch((err: Error) => {
        if (current) setState({ status: 'error', message: err.message });
      });
    return () => {
      current = false;
    };
  }, [source]);

  const content = state.status === 'loaded' ? state.content : null;
  const rendered = useMemo(
    () =>
      content === null ? null : renderMarkdown(content, createMarkdownComponents(source), { headingOffset }),
    [content, source, headingOffset]
  );

  if (state.status === 'loading') return <div>Loading {markdownPath}...</div>;
  if (state.status === 'error') {
    return (
      <div role="alert">
        Could not load {markdownPath} from GitHub ({state.message}). You can read it on{' '}
        <Link to={gitHubBlobUrl(source)} target="_blank" rel="noopener noreferrer">
          GitHub
        </Link>{' '}
        instead.
      </div>
    );
  }
  return <div className="markdown">{rendered}</div>;
}
