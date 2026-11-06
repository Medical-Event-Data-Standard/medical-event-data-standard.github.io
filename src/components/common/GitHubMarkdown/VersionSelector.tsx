import React, { useId } from 'react';

interface VersionSelectorProps {
  versions: string[];
  selectedVersion: string;
  onChange: (version: string) => void;
}

export default function VersionSelector({ versions, selectedVersion, onChange }: VersionSelectorProps) {
  const id = useId();
  return (
    <span>
      <label htmlFor={id}>Version: </label>
      <select
        id={id}
        value={selectedVersion}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--ifm-global-radius)' }}
      >
        {versions.map(version => (
          <option key={version} value={version}>
            {version}
          </option>
        ))}
      </select>
    </span>
  );
}
