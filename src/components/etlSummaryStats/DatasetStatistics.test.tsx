/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import DatasetStatistics from './DatasetStatistics';
import { etlStats, statsEntry } from '@site/src/lib/etlSummaryStats/testFixtures';
import type { EtlStatsData } from '@site/src/lib/etlSummaryStats/types';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build, and Plotly needs a real
// browser, so the wrapper is replaced by a stub that exposes the figure it was given.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
jest.mock(
  '@site/src/components/MEDS-DEV/plots/PlotlyWrapper',
  () => ({
    __esModule: true,
    default: ({ data, layout }: { data: unknown[]; layout: unknown }) => (
      <div data-testid="plot" data-figure={JSON.stringify({ data, layout })} />
    ),
  }),
  { virtual: true }
);
const mockUsePluginData = jest.mocked(usePluginData);

/** The figures of the plots inside the section with the given heading. */
function figuresIn(heading: string): { data: Record<string, unknown>[]; layout: Record<string, unknown> }[] {
  const section = screen.getByRole('heading', { level: 2, name: heading }).closest('section') as HTMLElement;
  return within(section)
    .queryAllByTestId('plot')
    .map(plot => JSON.parse(plot.getAttribute('data-figure') as string));
}

const sectionOf = (heading: string) =>
  screen.getByRole('heading', { level: 2, name: heading }).closest('section') as HTMLElement;

const demo = statsEntry('Demo', {
  id: 'org/big/demo_summary_stats.json',
  githubRepo: 'org/Big',
  path: 'tests/demo_summary_stats.json',
  variant: 'demo',
  stats: etlStats(100, {
    codeMetadata: {
      present: true,
      codes: 50,
      withDescription: 20,
      dataCodesMissing: 0,
      metadataCodesUnused: 0,
    },
    ontology: {
      measurementsMapped: 0.6,
      codesWithParents: 0.25,
      vocabularies: [{ name: 'LOINC', measurements: 5000, recognized: true }],
      suppressed: { cells: 2, measurements: 9 },
    },
  }),
});
const big = statsEntry('Big', {
  githubRepo: 'org/Big',
  stats: etlStats(5000, {
    ontology: null,
    checks: { emptyCodes: null, nullCodes: null, nullSubjectIds: null, nanValues: 0, infiniteValues: 0 },
    perSubject: { ...etlStats(5000).perSubject, spanDays: { suppressed: true, n: 12 } },
  }),
});
const future = statsEntry('Future', {
  schemaVersion: 2,
  stats: null,
  problem: 'Its stats schema version is 2, which this page cannot read yet (it reads version 1).',
});

const data: EtlStatsData = {
  updatedAt: '2026-11-06T21:18:34.455Z',
  datasets: [big, demo, future],
  reposWithoutStats: [
    { githubRepo: 'org/AUMCdb_MEDS', name: 'AUMCdb' },
    { githubRepo: 'org/eICU_MEDS', name: 'eICU' },
  ],
};

describe('DatasetStatistics', () => {
  beforeEach(() => mockUsePluginData.mockReset());

  it('shows provenance, the summary table and every chart, with notes on what each leaves out', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<DatasetStatistics />);

    expect(mockUsePluginData).toHaveBeenCalledWith('etl-summary-stats');
    expect(screen.getByText(/This site collected the files on 2026-11-06\./)).toBeInTheDocument();
    expect(screen.getByText(/fewer than 20 subjects are suppressed/)).toBeInTheDocument();

    // One row per stats file, linking to the repository and the file.
    const table = within(sectionOf('Datasets and their stats files')).getAllByRole('table')[0];
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getAllByRole('link', { name: 'org/Big' })[0]).toHaveAttribute(
      'href',
      'https://github.com/org/Big'
    );
    expect(within(table).getByRole('link', { name: 'demo_summary_stats.json' })).toHaveAttribute(
      'href',
      'https://github.com/org/Big/blob/HEAD/tests/demo_summary_stats.json'
    );
    expect(within(table).getAllByText('1 (tool 0.0.3)')).toHaveLength(2);
    expect(within(table).getByText('2 (tool 0.0.3)')).toBeInTheDocument();
    for (const link of within(table).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    // A file the page can't read is listed, with why, and left out of the charts.
    expect(
      screen
        .getAllByRole('alert')
        .filter(alert => alert.textContent?.includes('Future: Its stats schema version is 2'))
    ).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'AUMCdb' })).toHaveAttribute(
      'href',
      'https://github.com/org/AUMCdb_MEDS'
    );

    // The sections, in order; the calendar-year, split and code-concentration charts are gone.
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
      'Datasets and their stats files',
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'Pace of measurements',
      'Record coverage',
      'Coverage of the most common codes',
      'Vocabularies used',
      'Mapping to standard vocabularies',
      'Health check',
    ]);

    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(figuresIn('Depth vs. breadth')[0].data[0].text).toEqual(['Big', 'Demo']);
    expect(
      within(sectionOf('Depth vs. breadth')).getByText(
        'Bubble area is proportional to the number of unique codes.'
      )
    ).toBeInTheDocument();
    expect(within(sectionOf('Depth vs. breadth')).queryByText(/Left unlabelled/)).not.toBeInTheDocument();
    expect(figuresIn('How much data each subject has')[0].data[0].y).toEqual(['Big', 'Demo']);
    // The pace per day of record needs the mean record span, which Big's file suppresses.
    expect(figuresIn('Pace of measurements')[0].data[0].y).toEqual(['Demo']);
    expect(
      within(sectionOf('Pace of measurements')).getByText(/per-subject record span summary rests on/)
    ).toBeInTheDocument();
    expect(figuresIn('Record coverage')[0].data[0].y).toEqual(['Big', 'Demo']);
    // The largest dataset is highlighted; the rest are grey.
    expect(figuresIn('Coverage of the most common codes')[0].data.map(trace => trace.name)).toEqual([
      'Other datasets',
      'Big',
    ]);
    expect(within(sectionOf('Coverage of the most common codes')).getByLabelText('Highlight')).toHaveValue(
      'Big'
    );
    expect(figuresIn('Vocabularies used')[0].data[0].y).toEqual(['Demo']);
    expect(
      within(sectionOf('Vocabularies used')).getByText(/A standard OMOP CDM vocabulary/)
    ).toBeInTheDocument();
    expect(
      within(sectionOf('Vocabularies used')).getByText(/2 more vocabularies are suppressed/)
    ).toBeInTheDocument();
    expect(figuresIn('Mapping to standard vocabularies')[0].data[0].y).toEqual(['Demo']);
    expect(
      within(sectionOf('Mapping to standard vocabularies')).getByText(/maps no codes to parent codes/)
    ).toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();

    // Charts have their numbers as a table, except those that print every number: the heatmaps and the
    // health check.
    for (const heading of [
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'Pace of measurements',
      'Coverage of the most common codes',
      'Mapping to standard vocabularies',
    ]) {
      expect(within(sectionOf(heading)).getByText('Show the numbers')).toBeInTheDocument();
    }
    for (const heading of ['Record coverage', 'Vocabularies used', 'Health check']) {
      expect(within(sectionOf(heading)).queryByText('Show the numbers')).not.toBeInTheDocument();
    }

    // The health check: one row per readable dataset, each status an icon with a name plus text.
    const health = within(sectionOf('Health check'));
    const scorecard = health.getByRole('table', { name: 'Health check of each dataset' });
    expect(within(scorecard).getAllByRole('row')).toHaveLength(3);
    expect(within(scorecard).getByRole('row', { name: /^Demo/ })).toHaveTextContent('40.0%');
    expect(within(scorecard).getAllByRole('img', { name: 'Warning' })).toHaveLength(1);
    expect(within(scorecard).getAllByRole('img', { name: 'Not known' })).toHaveLength(1);
    expect(within(scorecard).getAllByRole('img', { name: 'Passes' })).toHaveLength(6);
    expect(health.getByText(/It passes at 90% or more/)).toBeInTheDocument();
    expect(health.getByText('Future')).toBeInTheDocument();

    // Dataset size: events, measurements and unique codes side by side, largest measurements first.
    expect(figuresIn('Dataset size')[0].data.map(trace => trace.name)).toEqual([
      'Events',
      'Measurements',
      'Unique codes',
    ]);
  });

  it('switches measures and can leave out demo datasets', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<DatasetStatistics />);

    const sortBy = () => within(screen.getByRole('group', { name: 'Sort by' }));
    const order = () => within(screen.getByRole('group', { name: 'Order' }));
    const sizeOrder = () => figuresIn('Dataset size')[0].data[0].y;

    // Counts sort largest first by default, and can flip.
    fireEvent.click(sortBy().getByRole('button', { name: 'Events' }));
    expect(sizeOrder()).toEqual(['Big', 'Demo']);
    expect(order().getByRole('button', { name: 'Largest first' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(order().getByRole('button', { name: 'Smallest first' }));
    expect(sizeOrder()).toEqual(['Demo', 'Big']);
    expect(within(sectionOf('Dataset size')).getByRole('img')).toHaveAccessibleName(
      'Events, measurements and unique codes per dataset, grouped bars, sorted by events'
    );
    // Clicking the selected button again keeps it selected.
    fireEvent.click(order().getByRole('button', { name: 'Smallest first' }));
    expect(sizeOrder()).toEqual(['Demo', 'Big']);

    // Names start A–Z, with the order buttons relabelled.
    fireEvent.click(sortBy().getByRole('button', { name: 'Name' }));
    expect(sizeOrder()).toEqual(['Big', 'Demo']);
    expect(order().getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(order().getByRole('button', { name: 'Z–A' }));
    expect(sizeOrder()).toEqual(['Demo', 'Big']);

    // Switching back to a count starts largest first again.
    fireEvent.click(sortBy().getByRole('button', { name: 'Subjects' }));
    expect(sizeOrder()).toEqual(['Big', 'Demo']);

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Per-subject measure' })).getByRole('button', {
        name: 'Record span',
      })
    );
    // Big's file suppresses its record-span quantiles.
    expect(figuresIn('How much data each subject has')[0].data[0].median).toEqual([90]);

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Pace measure' })).getByRole('button', { name: 'Per event' })
    );
    expect(figuresIn('Pace of measurements')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(within(sectionOf('Pace of measurements')).getByRole('img')).toHaveAccessibleName(
      'Measurements per event, one bar per dataset'
    );

    fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: 'Demo' } });
    expect(figuresIn('Coverage of the most common codes')[0].data.map(trace => trace.name)).toEqual([
      'Other datasets',
      'Demo',
    ]);

    fireEvent.click(screen.getByLabelText(/Include demo datasets/));
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big']);
    expect(screen.queryByText('demo_summary_stats.json')).not.toBeInTheDocument();
    expect(figuresIn('Mapping to standard vocabularies')).toHaveLength(0);
    // The highlighted demo dataset is gone, so the largest remaining one is highlighted.
    expect(screen.getByLabelText('Highlight')).toHaveValue('Big');
  });

  it('adapts its notes to what the files state', () => {
    const local = statsEntry('Other', {
      minCellSize: 10,
      stats: etlStats(1000, {
        ontology: {
          measurementsMapped: 0.1,
          codesWithParents: 0.1,
          vocabularies: [{ name: 'LOCAL', measurements: 50, recognized: false }],
          suppressed: null,
        },
      }),
    });
    mockUsePluginData.mockReturnValue({
      updatedAt: null,
      datasets: [big, local],
      reposWithoutStats: [{ githubRepo: 'org/Solo', name: 'Solo' }],
    });
    render(<DatasetStatistics />);
    expect(screen.queryByText(/collected the files on/)).not.toBeInTheDocument();
    expect(screen.getByText(/too few subjects are suppressed/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Include demo datasets/)).not.toBeInTheDocument();
    expect(screen.getByText(/No stats file yet in this ETL repository/)).toBeInTheDocument();
    // No vocabulary is a recognised OMOP one, so none is marked.
    expect(figuresIn('Vocabularies used')).toHaveLength(1);
    expect(screen.queryByText(/A standard OMOP CDM vocabulary/)).not.toBeInTheDocument();
  });

  it('leaves off bubble labels that would overlap, and says which', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => statsEntry(`Dataset ${i}`));
    mockUsePluginData.mockReturnValue({ updatedAt: null, datasets: crowd, reposWithoutStats: [] });
    render(<DatasetStatistics />);
    expect(
      within(sectionOf('Depth vs. breadth')).getByText(/Left unlabelled to avoid overlaps/)
    ).toBeInTheDocument();
  });

  it('says so when no stats were collected', () => {
    mockUsePluginData.mockReturnValue(undefined);
    const { rerender } = render(<DatasetStatistics />);
    expect(screen.getByText(/No dataset statistics could be collected/)).toBeInTheDocument();

    mockUsePluginData.mockReturnValue({ updatedAt: null, datasets: [], reposWithoutStats: [] });
    rerender(<DatasetStatistics />);
    expect(screen.getByText(/No dataset statistics could be collected/)).toBeInTheDocument();
  });

  it('draws no chart where no dataset can be drawn', () => {
    mockUsePluginData.mockReturnValue({ updatedAt: null, datasets: [future], reposWithoutStats: [] });
    render(<DatasetStatistics />);
    expect(screen.queryAllByTestId('plot')).toHaveLength(0);
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();
    expect(screen.queryByLabelText('Highlight')).not.toBeInTheDocument();
    expect(within(sectionOf('Health check')).getAllByRole('row')).toHaveLength(1);
  });
});
