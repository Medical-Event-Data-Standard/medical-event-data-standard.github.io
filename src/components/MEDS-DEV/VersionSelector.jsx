import React from 'react';

export default function VersionSelector({ versions, selectedVersion, onChange }) {
  return (
    <select
      value={selectedVersion}
      onChange={e => onChange(e.target.value)}
      className="p-2 border border-gray-300 rounded-md shadow-sm"
    >
      {versions.map(version => (
        <option key={version} value={version}>
          {version}
        </option>
      ))}
    </select>
  );
}
