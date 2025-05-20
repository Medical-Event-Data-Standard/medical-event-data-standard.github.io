import React, { useEffect, useState } from 'react';

export default function PackageTable({ packages }) {
  const [pkgData, setPkgData] = useState([]);

  useEffect(() => {
    async function fetchGitHubMetadata(pkg) {
      if (!pkg.github_repo) return pkg;

      const res = await fetch(`https://api.github.com/repos/${pkg.github_repo}`);
      const repoInfo = await res.json();
      const stars = repoInfo.stargazers_count;
      const updated_at = repoInfo.updated_at;

      let latest_release = 'N/A';
      const releaseRes = await fetch(`https://api.github.com/repos/${pkg.github_repo}/releases/latest`);
      if (releaseRes.ok) {
        const releaseData = await releaseRes.json();
        latest_release = releaseData.tag_name || 'N/A';
      }

      return {
        ...pkg,
        stars,
        updated_at,
        latest_release,
      };
    }

    async function fetchAllData() {
      const results = await Promise.all(packages.map(fetchGitHubMetadata));
      setPkgData(results);
    }

    fetchAllData();
  }, [packages]);

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Description / Warning</th>
          <th>GitHub ⭐</th>
          <th>Latest Release</th>
          <th>Updated</th>
          <th>Docs</th>
          <th>Paper</th>
          <th>PyPI</th>
        </tr>
      </thead>
      <tbody>
        {pkgData.map(pkg => (
          <tr key={pkg.name}>
            <td>
              {pkg.github_repo ? <a href={`https://github.com/${pkg.github_repo}`}>{pkg.name}</a> : pkg.name}
            </td>
            <td>
              {pkg.warn ? <em>{pkg.warn}</em> : '—'}
              {pkg.demo_available && <span> (Demo Available)</span>}
            </td>
            <td>{pkg.stars ?? '—'}</td>
            <td>{pkg.latest_release ?? '—'}</td>
            <td>{pkg.updated_at ? new Date(pkg.updated_at).toLocaleDateString() : '—'}</td>
            <td>{pkg.docs_url ? <a href={pkg.docs_url}>Docs</a> : '—'}</td>
            <td>{pkg.paper_url ? <a href={pkg.paper_url}>Paper</a> : '—'}</td>
            <td>
              {pkg.pypi_name ? (
                <a href={`https://pypi.org/project/${pkg.pypi_name}`}>{pkg.pypi_name}</a>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
