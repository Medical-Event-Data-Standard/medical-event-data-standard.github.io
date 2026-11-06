/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import EcosystemFlowchart from './EcosystemFlowchart';
import { RawCategory } from '@site/src/lib/ecosystem/types';

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
const ecosystemYaml = parse(fs.readFileSync(yamlPath, 'utf8')) as Record<string, RawCategory>;

describe('EcosystemFlowchart', () => {
  it('shows the steps of the MEDS workflow in order, with the tools of static/data/ecosystem.yaml', () => {
    render(<EcosystemFlowchart data={ecosystemYaml} />);

    const steps = within(screen.getByRole('list', { name: 'Steps of the MEDS workflow' }));
    expect(steps.getAllByRole('heading').map(heading => heading.textContent)).toEqual([
      'Convert your data to MEDS',
      'Explore and inspect',
      'Pre-process and load',
      'Define a prediction task',
      'Build models',
      'Evaluate',
      'Benchmark and share',
    ]);

    const aces = within(
      screen.getByRole('list', { name: 'Define a prediction task: Task Extraction' })
    ).getByRole('link', { name: 'ACES' });
    expect(aces).toHaveAttribute('href', 'https://github.com/justin13601/ACES');
    expect(aces).toHaveAttribute('target', '_blank');
    expect(aces).toHaveAttribute('rel', 'noopener noreferrer');
    expect(aces).toHaveAttribute('title', 'ACES (GitHub)');

    // A dataset without a GitHub repository links to its PhysioNet page instead.
    expect(screen.getByRole('link', { name: 'MIMIC-IV Demo' })).toHaveAttribute(
      'href',
      'https://physionet.org/content/mimic-iv-demo-meds/0.0.1/'
    );

    // Category names are shown in stages with several categories, such as the dataset ETLs, but not otherwise.
    expect(screen.getByText('Public Datasets')).toBeInTheDocument();
    expect(screen.queryByText('Task Extraction')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Across the workflow' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Other tools' })).not.toBeInTheDocument();
    expect(screen.queryByText('No tools listed yet.')).not.toBeInTheDocument();
  });

  it('lists tools of categories without a stage under "Other tools", and marks empty steps', () => {
    render(
      <EcosystemFlowchart
        data={{
          etls: { name: 'ETLs', stage: 'convert', packages: [{ name: 'An ETL', github_repo: 'org/etl' }] },
          misc: { name: 'Misc', packages: [{ name: 'Unlinked tool' }] },
        }}
      />
    );

    const other = within(screen.getByRole('list', { name: 'Other tools: Misc' }));
    // A package without any link is shown, but not as a link.
    expect(other.getByText('Unlinked tool')).toBeInTheDocument();
    expect(other.queryByRole('link')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'An ETL' })).toHaveAttribute(
      'href',
      'https://github.com/org/etl'
    );
    // Every other step has no tools.
    expect(screen.getAllByText('No tools listed yet.')).toHaveLength(6);
    expect(screen.queryByRole('heading', { name: 'Across the workflow' })).not.toBeInTheDocument();
  });
});
