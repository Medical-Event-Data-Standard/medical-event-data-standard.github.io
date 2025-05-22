import React, { useEffect, useState } from 'react';
import { CircularProgress } from '@mui/material';

import { Package, PackageWithMetadata } from '@site/src/lib/ecosystem/types';
import { loadPackageMetadata } from '@site/src/lib/ecosystem/loadPackageMetadata';

export default function PackageTable({ packages }: { packages: Package[] }): React.JSX.Element {
  const [pkgData, setPkgData] = useState<PackageWithMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all(packages.map(loadPackageMetadata))
      .then(results => {
        setPkgData(results);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading package metadata:', err);
        setLoading(false);
      });
  }, [packages]);

  if (loading) return <CircularProgress />;

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
            <td>{pkg.stargazers_count ?? '—'}</td>
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
