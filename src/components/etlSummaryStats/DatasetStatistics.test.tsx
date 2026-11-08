/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import DatasetStatistics from './DatasetStatistics';
import { etlStats, statsEntry } from '@site/src/lib/etlSummaryStats/testFixtures';
import type { EtlStats, EtlStatsData } from '@site/src/lib/etlSummaryStats/types';

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

    // The sections, in order; the calendar-year, split and code-concentration charts are gone, and the vocabulary
    // heatmap and mapping bars are one section.
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
      'Datasets and their stats files',
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'Pace of measurements',
      'Record coverage',
      'How long the tail of codes is',
      'Mapping to vocabularies',
      'Health check',
    ]);

    // Dataset size has a fixed order, the most measurements first, and no sort controls.
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(screen.queryByRole('group', { name: /Sort by|Order/ })).not.toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByRole('img')).toHaveAccessibleName(
      'Events, measurements and unique codes per dataset, grouped bars, most measurements first'
    );
    expect(figuresIn('Depth vs. breadth')[0].data[0].text).toEqual(['Big', 'Demo']);
    expect(
      within(sectionOf('Depth vs. breadth')).getByText(
        'Bubble area is proportional to the number of unique codes.'
      )
    ).toBeInTheDocument();
    expect(within(sectionOf('Depth vs. breadth')).queryByText(/Left unlabelled/)).not.toBeInTheDocument();
    expect(figuresIn('How much data each subject has')[0].data[0].y).toEqual(['Big', 'Demo']);
    // No file has the per-subject rate yet: only the exact ratio per event, with a note and no toggle.
    const pace = within(sectionOf('Pace of measurements'));
    expect(figuresIn('Pace of measurements')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(pace.getByRole('img')).toHaveAccessibleName('Measurements per event, one bar per dataset');
    expect(pace.queryByRole('group', { name: 'Pace measure' })).not.toBeInTheDocument();
    expect(pace.getByText(/will appear here once the ETLs publish it/)).toBeInTheDocument();
    expect(pace.queryByText(/average/)).not.toBeInTheDocument();
    expect(figuresIn('Record coverage')[0].data[0].y).toEqual(['Big', 'Demo']);
    // Every dataset has its own curve and legend entry; none is highlighted at first.
    const tail = within(sectionOf('How long the tail of codes is'));
    expect(figuresIn('How long the tail of codes is')[0].data.map(trace => trace.name)).toEqual([
      'Big',
      'Demo',
    ]);
    expect(figuresIn('How long the tail of codes is')[0].layout.yaxis).toMatchObject({ type: 'log' });
    expect(tail.getByLabelText('Highlight')).toHaveValue('');
    expect(tail.getByRole('img')).toHaveAccessibleName(
      'Share of measurements outside the most frequent codes against the number of codes, both logarithmic, one curve per dataset, each in its own colour and line style'
    );
    // Every dataset has a row, Big's without a mapping marked as such.
    const mapping = within(sectionOf('Mapping to vocabularies'));
    const [, vocabularyCells] = figuresIn('Mapping to vocabularies')[0].data;
    expect(vocabularyCells.y).toEqual(['Big', 'Demo']);
    expect((vocabularyCells.x as string[]).slice(0, 2)).toEqual(['Any vocabulary', 'Codes with a parent']);
    expect(
      (figuresIn('Mapping to vocabularies')[0].layout.annotations as { y: string; text: string }[]).map(a => [
        a.y,
        a.text,
      ])
    ).toEqual([['Big', '<i>No vocabulary mapping</i>']]);
    expect(mapping.getByText(/A standard OMOP CDM vocabulary/)).toBeInTheDocument();
    expect(mapping.getByText(/2 more vocabularies are suppressed/)).toBeInTheDocument();
    expect(mapping.getByText(/de-duplicated/)).toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();

    // Charts have their numbers as a table, except those that print every number: the heatmaps and the
    // health check.
    for (const heading of [
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'Pace of measurements',
      'How long the tail of codes is',
    ]) {
      expect(within(sectionOf(heading)).getByText('Show the numbers')).toBeInTheDocument();
    }
    for (const heading of ['Record coverage', 'Mapping to vocabularies', 'Health check']) {
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
    // Only the demo's file has each subject's measurements per day.
    const demoStats = demo.stats as EtlStats;
    const rate = {
      suppressed: false as const,
      n: 100,
      mean: null,
      p5: 0.1,
      p25: 0.5,
      p50: 2,
      p75: 6,
      p95: 20,
    };
    const demoWithRate = {
      ...demo,
      stats: { ...demoStats, perSubject: { ...demoStats.perSubject, measurementsPerDay: rate } },
    };
    mockUsePluginData.mockReturnValue({ ...data, datasets: [big, demoWithRate, future] });
    render(<DatasetStatistics />);

    fireEvent.click(
      within(screen.getByRole('group', { name: 'Per-subject measure' })).getByRole('button', {
        name: 'Record span',
      })
    );
    // Big's file suppresses its record-span quantiles.
    expect(figuresIn('How much data each subject has')[0].data[0].median).toEqual([90]);

    // A file in view has the per-subject rate, so the pace starts with it, drawn as boxes.
    const pace = () => within(sectionOf('Pace of measurements'));
    const paceToggle = () => within(screen.getByRole('group', { name: 'Pace measure' }));
    expect(paceToggle().getByRole('button', { name: 'Per day, per subject' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(figuresIn('Pace of measurements')[0].data[0]).toMatchObject({
      type: 'box',
      y: ['Demo'],
      median: [2],
    });
    expect(pace().getByRole('img')).toHaveAccessibleName(
      'Measurements per day, per subject, box chart per dataset'
    );
    expect(pace().getByText(/which newer versions of meds_summary_stats publish/)).toBeInTheDocument();
    // The description gives the library's definition, and why the mean isn't shown.
    expect(pace().getByText(/Birth and death records are left out/)).toBeInTheDocument();
    expect(pace().getByText(/rather than the mean/)).toBeInTheDocument();
    expect(pace().queryByText(/will appear here once/)).not.toBeInTheDocument();
    fireEvent.click(paceToggle().getByRole('button', { name: 'Per event' }));
    expect(figuresIn('Pace of measurements')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(pace().getByRole('img')).toHaveAccessibleName('Measurements per event, one bar per dataset');
    fireEvent.click(paceToggle().getByRole('button', { name: 'Per day, per subject' }));

    fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: 'Demo' } });
    // The highlighted curve is drawn last, on top; the other keeps its colour but fades.
    const highlighted = figuresIn('How long the tail of codes is')[0].data;
    expect(highlighted.map(trace => trace.name)).toEqual(['Big', 'Demo']);
    expect(highlighted.map(trace => trace.opacity)).toEqual([0.25, 1]);
    expect(within(sectionOf('How long the tail of codes is')).getByRole('img')).toHaveAccessibleName(
      'Share of measurements outside the most frequent codes against the number of codes, both logarithmic, one curve per dataset, Demo highlighted'
    );

    fireEvent.click(screen.getByLabelText(/Include demo datasets/));
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big']);
    expect(screen.queryByText('demo_summary_stats.json')).not.toBeInTheDocument();
    // No file in view has the per-subject rate any more: only the ratio per event, with the note.
    expect(screen.queryByRole('group', { name: 'Pace measure' })).not.toBeInTheDocument();
    expect(figuresIn('Pace of measurements')[0].data[0].y).toEqual(['Big']);
    expect(pace().getByText(/will appear here once/)).toBeInTheDocument();
    expect(figuresIn('Mapping to vocabularies')[0].data[1].y).toEqual(['Big']);
    // The highlighted demo dataset is gone, so nothing is highlighted, and Big keeps its colour.
    expect(screen.getByLabelText('Highlight')).toHaveValue('');
    const remaining = figuresIn('How long the tail of codes is')[0].data;
    expect(remaining.map(trace => trace.name)).toEqual(['Big']);
    expect((remaining[0].line as { color: string }).color).toBe(
      (highlighted[0].line as { color: string }).color
    );

    // Highlighting a dataset and then choosing "None" clears the highlight.
    fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: 'Big' } });
    expect(figuresIn('How long the tail of codes is')[0].data[0].opacity).toBe(1);
    fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: '' } });
    expect(screen.getByLabelText('Highlight')).toHaveValue('');
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
    expect(figuresIn('Mapping to vocabularies')).toHaveLength(1);
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
