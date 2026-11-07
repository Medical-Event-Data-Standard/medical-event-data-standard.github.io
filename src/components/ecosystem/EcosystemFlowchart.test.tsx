/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import EcosystemFlowchart from './EcosystemFlowchart';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { groupByStage, toolAnchorIds, workflowSections } from '@site/src/lib/ecosystem/workflow';

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
const ecosystemYaml = parse(fs.readFileSync(yamlPath, 'utf8')) as Record<string, RawCategory>;

function renderFlowchart(
  data: Record<string, RawCategory>,
  { selectedId, onSelectTool = jest.fn() }: { selectedId?: string; onSelectTool?: jest.Mock } = {}
) {
  const sections = workflowSections(groupByStage(parseCategoryMap(data)));
  render(
    <EcosystemFlowchart
      sections={sections}
      toolIds={toolAnchorIds(sections)}
      selectedId={selectedId}
      onSelectTool={onSelectTool}
    />
  );
}

describe('EcosystemFlowchart', () => {
  it('shows the steps of the MEDS workflow in order, with the tools of static/data/ecosystem.yaml', () => {
    renderFlowchart(ecosystemYaml);

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

    // Each tool links to its tile on the page, rather than to another site.
    const aces = within(
      screen.getByRole('list', { name: 'Define a prediction task: Task Extraction' })
    ).getByRole('link', { name: 'ACES' });
    expect(aces).toHaveAttribute('href', '#tool-aces');
    expect(aces).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'OMOP (via MEDS-ETL)' })).toHaveAttribute(
      'href',
      '#tool-omop-via-meds-etl'
    );

    // Category names are shown in stages with several categories, such as the dataset ETLs, but not otherwise.
    expect(screen.getByText('Public Datasets')).toBeInTheDocument();
    expect(screen.queryByText('Task Extraction')).not.toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Across the workflow' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Other tools' })).not.toBeInTheDocument();
    expect(screen.queryByText('No tools listed yet.')).not.toBeInTheDocument();
  });

  it('lists tools of categories without a stage under "Other tools", and marks empty steps', () => {
    renderFlowchart({
      etls: { name: 'ETLs', stage: 'convert', packages: [{ name: 'An ETL', github_repo: 'org/etl' }] },
      misc: { name: 'Misc', packages: [{ name: 'Unlinked tool' }] },
    });

    // A tool without any links of its own still has a tile to link to.
    expect(
      within(screen.getByRole('list', { name: 'Other tools: Misc' })).getByRole('link', {
        name: 'Unlinked tool',
      })
    ).toHaveAttribute('href', '#tool-unlinked-tool');
    expect(screen.getByRole('link', { name: 'An ETL' })).toHaveAttribute('href', '#tool-an-etl');
    // Every other step has no tools.
    expect(screen.getAllByText('No tools listed yet.')).toHaveLength(6);
    expect(screen.queryByRole('heading', { name: 'Across the workflow' })).not.toBeInTheDocument();
  });

  it('marks the selected tool, and reports clicks on a tool with the id of its tile', () => {
    const onSelectTool = jest.fn();
    renderFlowchart(ecosystemYaml, { selectedId: 'tool-aces', onSelectTool });

    const aces = screen.getByRole('link', { name: 'ACES' });
    expect(aces).toHaveAttribute('aria-current', 'true');
    expect(aces).toHaveClass('MuiChip-filled', 'MuiChip-colorPrimary');
    const tabular = screen.getByRole('link', { name: 'MEDS-Tab' });
    expect(tabular).not.toHaveAttribute('aria-current');
    expect(tabular).toHaveClass('MuiChip-outlined');

    fireEvent.click(tabular);
    expect(onSelectTool).toHaveBeenCalledTimes(1);
    expect(onSelectTool).toHaveBeenCalledWith('tool-meds-tab', expect.objectContaining({ type: 'click' }));
  });
});
