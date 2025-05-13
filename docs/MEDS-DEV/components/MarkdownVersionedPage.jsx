import React, { useEffect, useState } from 'react';
import axios from 'axios';
import VersionSelector from './VersionSelector';
import MarkdownViewer from './MarkdownViewer';

export default function MarkdownVersionedPage({ repo, markdownPath }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('main');

  useEffect(() => {
    axios.get(`https://api.github.com/repos/${repo}/tags`).then((res) => {
      const tags = res.data.map((tag) => tag.name);
      setVersions(['main', ...tags]);
    });
  }, [repo]);

  const markdownUrl = `https://raw.githubusercontent.com/${repo}/${selectedVersion}/${markdownPath}`;

  return (
    <div>
      <VersionSelector
        versions={versions}
        selectedVersion={selectedVersion}
        onChange={setSelectedVersion}
      />
      <MarkdownViewer markdownUrl={markdownUrl} />
    </div>
  );
}

