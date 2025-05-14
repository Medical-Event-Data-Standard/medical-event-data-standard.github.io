import React, { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import PackageTable from './PackageTable';

export default function Ecosystem({ yamlUrl }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(yamlUrl)
      .then((res) => res.text())
      .then((text) => yaml.load(text))
      .then(setData);
  }, [yamlUrl]);

  if (!data) return <div>Loading ecosystem data...</div>;

  return (
    <div className="space-y-8">
      {Object.entries(data).map(([categoryKey, categoryData]) => (
        <section key={categoryKey}>
          <h2>{categoryData.title}</h2>
          <p>{categoryData.description}</p>

          {Object.entries(categoryData).map(([subKey, subData]) => {
            if (subData.packages) {
              return (
                <div key={subKey}>
                  <h3>{subData.title}</h3>
                  <p>{subData.description}</p>
                  <PackageTable packages={subData.packages} />
                </div>
              );
            }
            return null;
          })}

          {categoryData.packages && (
            <PackageTable packages={categoryData.packages} />
          )}
        </section>
      ))}
    </div>
  );
}

