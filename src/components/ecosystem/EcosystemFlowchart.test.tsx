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

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build.
const collectAnchor = jest.fn();
jest.mock('@docusaurus/useBrokenLinks', () => ({ __esModule: true, default: () => ({ collectAnchor }) }), {
  virtual: true,
});

beforeEach(() => collectAnchor.mockClear());

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

  it('draws the workflow as a timeline: the raw data, step 1, the data in MEDS, then the other steps', () => {
    renderFlowchart(ecosystemYaml);

    // The raw data comes before the steps.
    const list = screen.getByRole('list', { name: 'Steps of the MEDS workflow' });
    const rawData = screen.getByText('Your raw EHR data');
    expect(rawData.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Each step is labelled with its number, and the first is followed by the data in MEDS, with its columns.
    const steps = [...list.children] as HTMLElement[];
    expect(steps.map(step => step.querySelector('p')!.textContent)).toEqual([
      'Step 1',
      'Step 2',
      'Step 3',
      'Step 4',
      'Step 5',
      'Step 6',
      'Step 7',
    ]);
    expect(steps[0]).toHaveTextContent('Your data in MEDS');
    const columns = within(steps[0]).getByRole('list', { name: 'The columns of MEDS data' });
    expect(
      within(columns)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['subject_id', 'time', 'code', 'numeric_value']);

    // The tools used at any step follow the timeline, labelled as such.
    const general = screen.getByRole('heading', { name: 'Across the workflow' }).closest('[id]')!;
    expect(general.querySelector('p')).toHaveTextContent('At any step');
  });

  it('gives each step an id that links from other pages can go to, and reports it to Docusaurus', () => {
    renderFlowchart(ecosystemYaml);

    const steps = screen.getByRole('list', { name: 'Steps of the MEDS workflow' }).children;
    expect(
      [...steps].map(
        step =>
          within(step as HTMLElement)
            .getByRole('heading')
            .closest('[id]')?.id
      )
    ).toEqual([
      'stage-convert',
      'stage-explore',
      'stage-preprocess',
      'stage-task',
      'stage-model',
      'stage-evaluate',
      'stage-benchmark',
    ]);
    expect(screen.getByRole('heading', { name: 'Across the workflow' }).closest('[id]')).toHaveAttribute(
      'id',
      'stage-general'
    );
    expect(new Set(collectAnchor.mock.calls.map(([id]) => id))).toEqual(
      new Set([
        'stage-convert',
        'stage-explore',
        'stage-preprocess',
        'stage-task',
        'stage-model',
        'stage-evaluate',
        'stage-benchmark',
        'stage-general',
      ])
    );
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
