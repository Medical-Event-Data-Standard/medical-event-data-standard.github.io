import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Link from '@docusaurus/Link';

import { gitHubBlobUrl } from '@site/src/lib/githubMarkdown/urls';
import GitHubMarkdownViewer from './GitHubMarkdownViewer';
import VersionSelector from './VersionSelector';

/** The version shown first; the repositories rendered this way all use `main` as their default branch. */
export const DEFAULT_VERSION = 'main';

export interface GitHubMarkdownPageProps {
  /** The repository, as `owner/name`. */
  repo: string;
  /** The path of the markdown file within the repository. */
  markdownPath: string;
  /** How many levels to demote the file's headings by; see `TreeOptions.headingOffset`. */
  headingOffset?: number;
}

/**
 * Renders a markdown file from a GitHub repository (typically its README), with a selector to show it at the
 * default branch or at any of the repository's tags.
 */
export default function GitHubMarkdownPage({ repo, markdownPath, headingOffset }: GitHubMarkdownPageProps) {
  const [versions, setVersions] = useState<string[]>([DEFAULT_VERSION]);
  const [version, setVersion] = useState(DEFAULT_VERSION);

  useEffect(() => {
    let current = true;
    axios
      .get<{ name: string }[]>(`https://api.github.com/repos/${repo}/tags`, { params: { per_page: 100 } })
      .then(res => {
        if (current) setVersions([DEFAULT_VERSION, ...res.data.map(tag => tag.name)]);
      })
      .catch(() => {
        // E.g. when the unauthenticated GitHub API rate limit is hit: only the default branch can be shown.
      });
    return () => {
      current = false;
    };
  }, [repo]);

  return (
    <div>
      <div className="margin-bottom--md" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <VersionSelector versions={versions} selectedVersion={version} onChange={setVersion} />
        <Link
          to={gitHubBlobUrl({ repo, version, path: markdownPath })}
          target="_blank"
          rel="noopener noreferrer"
        >
          View {markdownPath} on GitHub
        </Link>
      </div>
      <GitHubMarkdownViewer
        repo={repo}
        version={version}
        markdownPath={markdownPath}
        headingOffset={headingOffset}
      />
    </div>
  );
}
