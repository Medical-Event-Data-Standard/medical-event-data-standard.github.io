import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { Category, RawCategory } from '@site/src/lib/ecosystem/types';
import { TypeGroup, categoryAnchorIds, groupByType } from '@site/src/lib/ecosystem/typeGroups';

/** Each group as "<id>: <package names>", followed by its subgroups, indented. */
function outline(groups: TypeGroup[], indent = ''): string[] {
  return groups.flatMap(({ id, packages, subgroups }) => [
    `${indent}${id}: ${packages.map(pkg => pkg.name).join(', ')}`,
    ...outline(subgroups, `${indent}  `),
  ]);
}

const ecosystem = parseCategoryMap({
  tools: {
    name: 'Tools',
    core: { name: 'Core', packages: [{ name: 'schema' }] } as unknown as RawCategory,
    empty: { name: 'Empty' } as unknown as RawCategory,
    viz: {
      name: 'Exploration',
      packages: [{ name: 'inspect' }, { name: 'plots' }],
      deep: { name: 'Deep', packages: [{ name: 'notebook' }] },
    } as unknown as RawCategory,
  },
  etls: {
    name: 'Dataset ETLs',
    packages: [{ name: 'template' }],
    public: { name: 'Public Datasets', packages: [{ name: 'MIMIC' }] } as unknown as RawCategory,
  },
});

describe('groupByType', () => {
  it('nests every category under its parent, in YAML order, leaving out those without packages', () => {
    expect(outline(groupByType(ecosystem, () => true))).toEqual([
      'tools: ',
      '  tools-core: schema',
      '  tools-exploration: inspect, plots',
      '    tools-exploration-deep: notebook',
      'dataset-etls: template',
      '  dataset-etls-public-datasets: MIMIC',
    ]);
  });

  it('shows only the packages that are shown, leaving out the categories left without any', () => {
    const shown = new Set(['plots', 'notebook', 'MIMIC']);
    expect(outline(groupByType(ecosystem, pkg => shown.has(pkg.name)))).toEqual([
      'tools: ',
      '  tools-exploration: plots',
      '    tools-exploration-deep: notebook',
      'dataset-etls: ',
      '  dataset-etls-public-datasets: MIMIC',
    ]);
    expect(outline(groupByType(ecosystem, pkg => pkg.name === 'notebook'))).toEqual([
      'tools: ',
      '  tools-exploration: ',
      '    tools-exploration-deep: notebook',
    ]);
    expect(groupByType(ecosystem, () => false)).toEqual([]);
  });

  it('groups the packages of static/data/ecosystem.yaml under Tools, Dataset ETLs and Published Models', () => {
    const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
    const parsed = parseCategoryMap(parse(fs.readFileSync(yamlPath, 'utf8')));
    const groups = groupByType(parsed, () => true);
    expect(groups.map(({ category }) => category.name)).toEqual([
      'Tools',
      'Dataset ETLs',
      'Published Models',
    ]);

    // Every package is shown once per category that lists it.
    const listed = (group: TypeGroup): number =>
      group.packages.length + group.subgroups.map(listed).reduce((a, b) => a + b, 0);
    expect(groups.map(listed).reduce((a, b) => a + b, 0)).toBe(
      parsed.categories.reduce((count, category) => count + category.packages.length, 0)
    );
  });
});

describe('categoryAnchorIds', () => {
  const category = (topic: string): Category => ({ topic, name: topic, depth: 0, packages: [] });

  it('slugs the topics, numbering repeated ids', () => {
    const ids = categoryAnchorIds(
      ['Dataset ETLs/ETL Templates/Tools', 'A b', 'A-b', 'A b', '!!!'].map(category)
    );
    expect([...ids.entries()]).toEqual([
      ['Dataset ETLs/ETL Templates/Tools', 'dataset-etls-etl-templates-tools'],
      ['A b', 'a-b'],
      ['A-b', 'a-b-2'],
      ['!!!', 'category'],
    ]);
  });
});
