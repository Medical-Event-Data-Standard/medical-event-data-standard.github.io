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
    byYear: { years: [], measurements: [], subjects: [], suppressed: { cells: 12, measurements: 50 } },
    splits: {
      cells: [{ split: 'train', subjects: 80, measurements: 800 }],
      suppressed: { cells: 2, measurements: 200 },
    },
  }),
});
const big = statsEntry('Big', {
  githubRepo: 'org/Big',
  stats: etlStats(5000, {
    ontology: null,
    byYear: {
      years: [2100, 2102],
      measurements: [1000, 3000],
      subjects: [100, 300],
      suppressed: { cells: 3, measurements: 9 },
    },
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

    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(figuresIn('How much data each subject has')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(figuresIn('Data over calendar years')).toHaveLength(1);
    expect(
      within(sectionOf('Data over calendar years')).getByText(/all 12 years had fewer than 20 subjects/)
    ).toBeInTheDocument();
    expect(
      within(sectionOf('Data over calendar years')).getByText(
        '3 more years suppressed (fewer than 20 subjects each).'
      )
    ).toBeInTheDocument();
    expect(
      within(sectionOf('Train, tuning and held-out splits')).getByText(/2 splits had fewer than 20 subjects/)
    ).toBeInTheDocument();
    expect(figuresIn('Record coverage')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(figuresIn('Code concentration')).toHaveLength(1);
    expect(figuresIn('Mapping to standard vocabularies')[0].data[0].y).toEqual(['Demo']);
    expect(
      within(sectionOf('Mapping to standard vocabularies')).getByText(/maps no codes to parent codes/)
    ).toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();

    // Charts have their numbers as a table, except the record-coverage heatmap, which prints every number.
    expect(within(sectionOf('Dataset size')).getByText('Show the numbers')).toBeInTheDocument();
    expect(within(sectionOf('Record coverage')).queryByText('Show the numbers')).not.toBeInTheDocument();

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
    expect(figuresIn('How much data each subject has')[0].data[0].median).toEqual([90, 90]);

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Yearly measure' })).getByRole('button', { name: 'Subjects' })
    );
    expect(figuresIn('Data over calendar years')[0].data[0].y).toEqual([100, 300]);

    fireEvent.click(screen.getByLabelText(/Include demo datasets/));
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big']);
    expect(screen.queryByText('demo_summary_stats.json')).not.toBeInTheDocument();
    expect(figuresIn('Mapping to standard vocabularies')).toHaveLength(0);
  });

  it('adapts its notes to what the files state', () => {
    mockUsePluginData.mockReturnValue({
      updatedAt: null,
      datasets: [big, statsEntry('Other', { minCellSize: 10 })],
      reposWithoutStats: [{ githubRepo: 'org/Solo', name: 'Solo' }],
    });
    render(<DatasetStatistics />);
    expect(screen.queryByText(/collected the files on/)).not.toBeInTheDocument();
    expect(screen.getByText(/too few subjects are suppressed/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Include demo datasets/)).not.toBeInTheDocument();
    expect(screen.getByText(/No stats file yet in this ETL repository/)).toBeInTheDocument();
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
  });
});
