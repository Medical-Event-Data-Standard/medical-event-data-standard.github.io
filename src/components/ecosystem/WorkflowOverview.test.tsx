/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import WorkflowOverview, {
  MEDS_DATA_TUTORIAL,
  STAGE_TUTORIALS,
  WORKFLOW_PAGE_PATH,
  toolSummary,
} from './WorkflowOverview';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { groupByStage, stagePackages, workflowSections } from '@site/src/lib/ecosystem/workflow';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build. The stand-in for `Link`
// renders a plain link; `useBrokenLinks` is used by the flowchart, whose list styles the guide shares.
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
const docsDir = path.join(__dirname, '..', '..', '..', 'docs');

const workflow = () =>
  screen.getByRole('list', { name: 'The MEDS workflow, from raw EHR data to a benchmark result' });

/** The entries of the timeline, in order. */
const entries = () =>
  within(workflow())
    .getAllByRole('listitem')
    .filter(item => item.parentElement === workflow());

/** The sections of the flowchart for the given data, as the guide shows them. */
function sectionsOf(data: Record<string, RawCategory>) {
  return workflowSections(groupByStage(parseCategoryMap(data)));
}

describe('WorkflowOverview', () => {
  it('shows the workflow top to bottom: the raw data, the first step, the data in MEDS, then the other steps', () => {
    render(<WorkflowOverview data={ecosystemYaml} />);

    const items = entries();
    expect(items).toHaveLength(9);
    expect(items.map(item => item.querySelectorAll('p')[1].textContent)).toEqual([
      'Your raw EHR data',
      'Convert your data to MEDS',
      'Your data in MEDS',
      'Explore and inspect',
      'Pre-process and load',
      'Define a prediction task',
      'Build models',
      'Evaluate',
      'Benchmark and share',
    ]);
    expect(items.map(item => item.querySelector('p')!.textContent)).toEqual([
      'Start',
      'Step 1',
      'Milestone',
      'Step 2',
      'Step 3',
      'Step 4',
      'Step 5',
      'Step 6',
      'Step 7',
    ]);

    // The data in MEDS, with its four columns.
    const columns = within(items[2]).getByRole('list', { name: 'The columns of MEDS data' });
    expect(
      within(columns)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['subject_id', 'time', 'code', 'numeric_value']);
  });

  it("links each step to its tutorial pages, if there are any, and not to the ecosystem's pages", () => {
    render(<WorkflowOverview data={ecosystemYaml} />);
    const tutorialLinks = (item: HTMLElement) =>
      within(item)
        .queryAllByRole('link')
        .map(link => [link.textContent, link.getAttribute('href')]);

    const items = entries();
    expect(items.map(tutorialLinks)).toEqual([
      [],
      [['Converting to MEDS', '/docs/tutorials/ml4h2025/converting_to_MEDS']],
      [['Getting Familiar with MEDS', '/docs/tutorials/ml4h2025/MEDS_intro']],
      [],
      [['Pre-processing MEDS Data', '/docs/tutorials/ml4h2025/preprocessing_MEDS_data']],
      [['Extracting a Prediction Task', '/docs/tutorials/ml4h2025/extracting_prediction_tasks']],
      [
        ['Build a Tabular Baseline', '/docs/tutorials/ml4h2025/build_a_model_tabular'],
        ['Build a Neural Network', '/docs/tutorials/ml4h2025/build_a_model_NN'],
      ],
      [['Build a Tabular Baseline', '/docs/tutorials/ml4h2025/build_a_model_tabular']],
      [['Compare with MEDS-DEV', '/docs/tutorials/ml4h2025/compare_with_meds_dev']],
    ]);
    expect(items[7]).toHaveTextContent('Tutorial: Build a Tabular Baseline (Evaluating the Model)');
  });

  it('links only to tutorial pages that exist', () => {
    const tutorials = [...Object.values(STAGE_TUTORIALS).flat(), MEDS_DATA_TUTORIAL];
    for (const { to } of tutorials) {
      const page = path.join(docsDir, `${to.replace(/^\/docs\//, '')}.mdx`);
      expect(fs.existsSync(page)).toBe(true);
    }
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

    // Every tool is counted once, including those used at any step. Only this line links to the tools.
    const total = Object.keys(parseCategoryMap(ecosystemYaml).packages).length;
    const summary = screen.getByText(`${total} tools`).closest('p')!;
    expect(summary).toHaveTextContent(
      `${total} tools in all, across the workflow. See which tool to use for what.`
    );
    expect(within(summary).getByRole('link', { name: 'See which tool to use for what' })).toHaveAttribute(
      'href',
      WORKFLOW_PAGE_PATH
    );
    expect(WORKFLOW_PAGE_PATH).toBe('/docs/intro_pages/ecosystem_workflow');
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
