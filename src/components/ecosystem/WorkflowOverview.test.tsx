/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import WorkflowOverview, { WORKFLOW_PAGE_PATH, toolSummary } from './WorkflowOverview';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { groupByStage, stagePackages, workflowSections } from '@site/src/lib/ecosystem/workflow';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build. The stand-in for `Link`
// renders a plain link; `useBrokenLinks` is used by the flowchart, whose `StepNumber` the overview shares.
jest.mock('@docusaurus/useBrokenLinks', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
    default: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
const ecosystemYaml = parse(fs.readFileSync(yamlPath, 'utf8')) as Record<string, RawCategory>;

const workflow = () =>
  screen.getByRole('list', { name: 'The MEDS workflow, from raw EHR data to a benchmark result' });

/** The sections of the flowchart for the given data, as the overview shows them. */
function sectionsOf(data: Record<string, RawCategory>) {
  return workflowSections(groupByStage(parseCategoryMap(data)));
}

describe('WorkflowOverview', () => {
  it('shows the steps of the MEDS workflow in order, each linking to its step in the flowchart', () => {
    render(<WorkflowOverview data={ecosystemYaml} />);

    const steps = within(workflow())
      .getAllByRole('listitem')
      .filter(item => item.parentElement === workflow());
    expect(steps).toHaveLength(7);
    expect(steps.map(step => within(step).getAllByRole('link')[0].textContent)).toEqual([
      'Convert your data to MEDS',
      'Explore and inspect',
      'Pre-process and load',
      'Define a prediction task',
      'Build models',
      'Evaluate',
      'Benchmark and share',
    ]);
    expect(steps.map(step => within(step).getAllByRole('link')[0].getAttribute('href'))).toEqual([
      `${WORKFLOW_PAGE_PATH}#stage-convert`,
      `${WORKFLOW_PAGE_PATH}#stage-explore`,
      `${WORKFLOW_PAGE_PATH}#stage-preprocess`,
      `${WORKFLOW_PAGE_PATH}#stage-task`,
      `${WORKFLOW_PAGE_PATH}#stage-model`,
      `${WORKFLOW_PAGE_PATH}#stage-evaluate`,
      `${WORKFLOW_PAGE_PATH}#stage-benchmark`,
    ]);
    expect(WORKFLOW_PAGE_PATH).toBe('/docs/intro_pages/ecosystem_workflow');

    // The first step starts from the raw data and leaves it in MEDS, with its four columns.
    expect(steps[0]).toHaveTextContent('Start: your raw EHR data');
    expect(steps[0]).toHaveTextContent('Your data in MEDS');
    const columns = within(steps[0]).getByRole('list', { name: 'The columns of MEDS data' });
    expect(
      within(columns)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['subject_id', 'time', 'code', 'numeric_value']);
  });

  it("names the number of each step's tools in static/data/ecosystem.yaml, and the total", () => {
    render(<WorkflowOverview data={ecosystemYaml} />);
    const sections = sectionsOf(ecosystemYaml);

    for (const section of sections.filter(({ step }) => step)) {
      const count = stagePackages(section).length;
      expect(count).toBeGreaterThan(0);
      expect(within(workflow()).getByText(toolSummary(section))).toBeInTheDocument();
    }
    // The examples include the dataset ETLs, not only the ETL templates listed before them.
    expect(within(workflow()).getByText(/^\d+ tools, such as .*MIMIC-IV/)).toBeInTheDocument();
    expect(within(workflow()).getByText(/^\d+ tools?(:|, such as) ACES/)).toBeInTheDocument();

    // Every tool is counted once, including those used at any step.
    const total = Object.keys(parseCategoryMap(ecosystemYaml).packages).length;
    const summary = screen.getByText(`${total} tools`).closest('p')!;
    expect(summary).toHaveTextContent(
      `${total} tools in all, across the workflow. See which tool to use for what.`
    );
    expect(within(summary).getByRole('link', { name: 'See which tool to use for what' })).toHaveAttribute(
      'href',
      WORKFLOW_PAGE_PATH
    );
  });

  it('says how many tools a step has and names a few, from each of its categories', () => {
    const data: Record<string, RawCategory> = {
      etls: { name: 'ETLs', stage: 'convert', packages: [{ name: 'Template' }, { name: 'Extract' }] },
      datasets: { name: 'Datasets', stage: 'convert', packages: [{ name: 'MIMIC' }, { name: 'eICU' }] },
      models: { name: 'Models', stage: 'model', packages: [{ name: 'Tab' }, { name: 'Torch' }] },
      tasks: { name: 'Tasks', stage: 'task', packages: [{ name: 'ACES' }] },
      evaluation: {
        name: 'Evaluation',
        stage: 'evaluate',
        packages: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      },
      core: { name: 'Core', stage: 'general', packages: [{ name: 'Schema' }] },
    };
    render(<WorkflowOverview data={data} />);
    const summaries = sectionsOf(data)
      .filter(({ step }) => step)
      .map(toolSummary);

    expect(summaries).toEqual([
      '4 tools, such as Template, MIMIC and Extract',
      'No tools listed yet',
      'No tools listed yet',
      '1 tool: ACES',
      '2 tools: Tab and Torch',
      '3 tools: A, B and C',
      'No tools listed yet',
    ]);
    for (const summary of new Set(summaries)) {
      expect(within(workflow()).getAllByText(summary).length).toBeGreaterThan(0);
    }
    // The tools used at any step are counted in the total, but not shown at a step.
    expect(screen.getByText('11 tools')).toBeInTheDocument();
    expect(screen.queryByText(/Schema/)).not.toBeInTheDocument();
  });
});
