/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import DatasetStatistics, { DATASET_STATISTICS_TOC } from './DatasetStatistics';
import { etlStats, statsEntry } from '@site/src/lib/etlSummaryStats/testFixtures';
import { type EtlStats, type EtlStatsData, SITE_GITHUB_REPO } from '@site/src/lib/etlSummaryStats/types';

// `@docusaurus/*` and `@theme/*` modules are webpack aliases that only exist inside a Docusaurus build, and Plotly
// needs a real browser, so the wrapper is replaced by a stub that exposes the figure it was given, and the theme's
// heading (which adds the permalink) by a plain one.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
jest.mock(
  '@theme/Heading',
  () => ({
    __esModule: true,
    default: ({ as: Tag, id, children }: { as: 'h2'; id: string; children: React.ReactNode }) => (
      <Tag id={id} data-permalink={`#${id}`}>
        {children}
      </Tag>
    ),
  }),
  { virtual: true }
);
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

type FigureJson = { data: Record<string, unknown>[]; layout: Record<string, Record<string, unknown>> };

/** The figures of the plots inside the section with the given heading. */
function figuresIn(heading: string): FigureJson[] {
  const section = screen.getByRole('heading', { level: 2, name: heading }).closest('section') as HTMLElement;
  return within(section)
    .queryAllByTestId('plot')
    .map(plot => JSON.parse(plot.getAttribute('data-figure') as string));
}

const sectionOf = (heading: string) =>
  screen.getByRole('heading', { level: 2, name: heading }).closest('section') as HTMLElement;

/** Clicks a choice of a labelled toggle inside a section. */
const choose = (heading: string, group: string, option: string) =>
  fireEvent.click(
    within(within(sectionOf(heading)).getByRole('group', { name: group })).getByRole('button', {
      name: option,
    })
  );

const demo = statsEntry('Demo', {
  id: 'org/big/demo_summary_stats.json',
  githubRepo: 'org/Big',
  path: 'tests/demo_summary_stats.json',
  variant: 'demo',
  // Written by meds_summary_stats 0.0.4, in stats schema version 2.
  schemaVersion: 2,
  toolVersion: '0.0.4',
  stats: etlStats(100, {
    codeMetadata: {
      present: true,
      codes: 50,
      withDescription: 20,
      dataCodesMissing: 0,
      metadataCodesUnused: 0,
    },
    ontology: {
      eventsMapped: 0.6,
      codesWithParents: 0.25,
      vocabularies: [{ name: 'LOINC', events: 5000, recognized: true }],
      suppressed: { cells: 2, events: 9 },
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
  schemaVersion: 3,
  stats: null,
  problem: 'Its stats schema version is 3, which this page cannot read yet (it reads versions 1 and 2).',
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
    expect(screen.getByText(/published in their repository/)).toBeInTheDocument();
    expect(screen.getByText(/Every row of a dataset counts as one event/)).toBeInTheDocument();

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
    expect(within(table).getByText('1 (tool 0.0.3)')).toBeInTheDocument();
    expect(within(table).getByText('2 (tool 0.0.4)')).toBeInTheDocument();
    expect(within(table).getByText('3 (tool 0.0.3)')).toBeInTheDocument();
    for (const link of within(table).getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(screen.queryByText(/committed to this site's repository/)).not.toBeInTheDocument();

    // A file the page can't read is listed, with why, and left out of the charts.
    expect(
      screen
        .getAllByRole('alert')
        .filter(alert => alert.textContent?.includes('Future: Its stats schema version is 3'))
    ).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'AUMCdb' })).toHaveAttribute(
      'href',
      'https://github.com/org/AUMCdb_MEDS'
    );

    // The sections, in order, each heading with its anchor, as the page's table of contents lists them.
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map(heading => heading.textContent)).toEqual([
      'Datasets and their stats files',
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'Pace of events',
      'Record coverage',
      'How long the tail of codes is',
      'Mapping to vocabularies',
      'Health check',
    ]);
    expect(DATASET_STATISTICS_TOC).toEqual(
      headings.map(heading => ({ value: heading.textContent, id: heading.id, level: 2 }))
    );
    for (const heading of headings) {
      expect(heading).toHaveAttribute('data-permalink', `#${heading.id}`);
      expect(heading.closest('section')).toHaveAttribute('aria-labelledby', heading.id);
    }

    // Dataset size has a fixed order, the most events first: events (rows) and unique codes side by side.
    expect(figuresIn('Dataset size')[0].data.map(trace => trace.name)).toEqual(['Events', 'Unique codes']);
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(within(sectionOf('Dataset size')).getByRole('img')).toHaveAccessibleName(
      'Events and unique codes per dataset, grouped bars, most events first'
    );
    expect(
      within(sectionOf('Dataset size')).getByText(/The axis is logarithmic: .* the fainter gridlines between/)
    ).toBeInTheDocument();
    // Nothing on the page distinguishes measurements from events; only a source field keeps its name.
    expect(document.body.textContent?.replace(/measurements_per_day/g, '')).not.toMatch(/measurement/i);

    expect(figuresIn('Depth vs. breadth')[0].data[0].text).toEqual(['Big', 'Demo']);
    expect(
      within(sectionOf('Depth vs. breadth')).getByText(
        'Bubble area is proportional to the number of unique codes.'
      )
    ).toBeInTheDocument();
    expect(
      within(sectionOf('Depth vs. breadth')).getByText(
        /Across is its breadth: the number of subjects it has\. Up is its depth: the median number of events per subject\. The bubble's area shows the number of unique codes\. Both axes are logarithmic, with fainter gridlines/
      )
    ).toBeInTheDocument();
    expect(within(sectionOf('Depth vs. breadth')).queryByText(/Left unlabelled/)).not.toBeInTheDocument();
    expect(figuresIn('How much data each subject has')[0].data[0].y).toEqual(['Big', 'Demo']);
    expect(
      within(sectionOf('How much data each subject has'))
        .getAllByRole('button')
        .map(button => button.textContent)
    ).toEqual(['Events', 'Unique codes', 'Record span', 'Log', 'Linear']);

    // No file has the per-subject rate yet: no chart, no empty frame and no scale toggle, only why.
    const pace = within(sectionOf('Pace of events'));
    expect(figuresIn('Pace of events')).toHaveLength(0);
    expect(pace.queryByRole('group')).not.toBeInTheDocument();
    expect(pace.getByText('No dataset can be drawn in this chart:')).toBeInTheDocument();
    expect(pace.getByText('Big, Demo')).toBeInTheDocument();
    expect(pace.queryByText(/per event/i)).not.toBeInTheDocument();
    expect(pace.queryByText(/The axis is/)).not.toBeInTheDocument();

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
      'Share of events outside the most frequent codes against the number of codes, both logarithmic, one curve per dataset, each in its own colour and line style'
    );
    expect(tail.getByText(/As in a power-law plot/)).toBeInTheDocument();
    expect(tail.getByText(/can't go on a logarithmic axis/)).toBeInTheDocument();
    // Every dataset has a row, Big's without a mapping marked as such.
    const mapping = within(sectionOf('Mapping to vocabularies'));
    const [, vocabularyCells] = figuresIn('Mapping to vocabularies')[0].data;
    expect(vocabularyCells.y).toEqual(['Big', 'Demo']);
    expect((vocabularyCells.x as string[]).slice(0, 2)).toEqual(['Any vocabulary', 'Codes with a parent']);
    expect(
      (
        figuresIn('Mapping to vocabularies')[0].layout.annotations as unknown as { y: string; text: string }[]
      ).map(a => [a.y, a.text])
    ).toEqual([['Big', '<i>No vocabulary mapping</i>']]);
    expect(mapping.getByText(/A standard OMOP CDM vocabulary/)).toBeInTheDocument();
    expect(mapping.getByText(/2 more vocabularies are suppressed/)).toBeInTheDocument();
    expect(mapping.getByText(/de-duplicated/)).toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();

    // Every chart with a log axis has a log/linear toggle per log axis, starting on log; the heatmaps have none.
    // (A "Show the numbers" disclosure is an unnamed group too.)
    const toggles = (heading: string) =>
      within(sectionOf(heading))
        .queryAllByRole('group')
        .map(group => group.getAttribute('aria-label'))
        .filter(Boolean);
    expect(toggles('Dataset size')).toEqual(['Horizontal axis']);
    expect(toggles('Depth vs. breadth')).toEqual([
      'Breadth',
      'Bubble size',
      'Horizontal axis',
      'Vertical axis',
    ]);
    expect(toggles('How much data each subject has')).toEqual(['Per-subject measure', 'Horizontal axis']);
    expect(toggles('How long the tail of codes is')).toEqual(['Horizontal axis', 'Vertical axis']);
    expect(toggles('Record coverage')).toEqual([]);
    expect(toggles('Mapping to vocabularies')).toEqual([]);
    for (const group of screen.getAllByRole('group', { name: /axis$/ })) {
      expect(within(group).getByRole('button', { name: 'Log' })).toHaveAttribute('aria-pressed', 'true');
    }

    // Charts have their numbers as a table, except those that print every number: the heatmaps and the
    // health check.
    for (const heading of [
      'Dataset size',
      'Depth vs. breadth',
      'How much data each subject has',
      'How long the tail of codes is',
    ]) {
      expect(within(sectionOf(heading)).getByText('Show the numbers')).toBeInTheDocument();
    }
    for (const heading of ['Pace of events', 'Record coverage', 'Mapping to vocabularies', 'Health check']) {
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
  });

  it('switches measures, bubble sizes and axis scales, and can leave out demo datasets', () => {
    // Only the demo's file has each subject's events per day, for only 20 subjects, so that it leaves out the 5th
    // and 95th percentiles.
    const demoStats = demo.stats as EtlStats;
    const rate = {
      suppressed: false as const,
      n: 20,
      mean: null,
      p5: null,
      p25: 0.5,
      p50: 2,
      p75: 6,
      p95: null,
    };
    const demoWithRate = {
      ...demo,
      stats: { ...demoStats, perSubject: { ...demoStats.perSubject, eventsPerDay: rate } },
    };
    mockUsePluginData.mockReturnValue({ ...data, datasets: [big, demoWithRate, future] });
    render(<DatasetStatistics />);

    choose('How much data each subject has', 'Per-subject measure', 'Record span');
    // Big's file suppresses its record-span quantiles.
    expect(figuresIn('How much data each subject has')[0].data[0].median).toEqual([90]);
    expect(within(sectionOf('How much data each subject has')).getByRole('img')).toHaveAccessibleName(
      'Days from first to last event per subject, box chart per dataset'
    );
    // The scale stays when the measure changes.
    choose('How much data each subject has', 'Horizontal axis', 'Linear');
    choose('How much data each subject has', 'Per-subject measure', 'Events');
    expect(figuresIn('How much data each subject has')[0].layout.xaxis).toMatchObject({
      title: { text: 'Events per subject' },
      rangemode: 'tozero',
    });

    // A file in view has the per-subject rate, so the pace is drawn as boxes, with its own scale toggle.
    const pace = () => within(sectionOf('Pace of events'));
    expect(figuresIn('Pace of events')[0].data[0]).toMatchObject({
      type: 'box',
      y: ['Demo'],
      median: [2],
      lowerfence: [0.5],
      upperfence: [6],
    });
    expect(pace().getByRole('img')).toHaveAccessibleName(
      'Events per day, per subject, box chart per dataset'
    );
    expect(
      pace().getByText(
        'Without a whisker where the stats file leaves out the 5th or 95th percentile, as meds_summary_stats ' +
          'does from version 0.0.4 on where they would depend on the smallest or largest value: Demo.'
      )
    ).toBeInTheDocument();
    expect(pace().getByText(/Not shown in this chart/)).toBeInTheDocument();
    expect(
      pace().getByText(
        /per_subject.measurements_per_day\), which meds_summary_stats writes from version 0\.0\.4 on\./
      )
    ).toBeInTheDocument();
    expect(
      pace().getByText(/writes this from version 0\.0\.4 \(stats schema version 2\) on/)
    ).toBeInTheDocument();
    // The description gives the library's definition, and why the mean isn't shown.
    expect(pace().getByText(/Birth and death records are left out/)).toBeInTheDocument();
    expect(pace().getByText(/rather than the mean/)).toBeInTheDocument();
    expect(pace().getByText(/The axis is logarithmic/)).toBeInTheDocument();
    choose('Pace of events', 'Horizontal axis', 'Linear');
    expect(figuresIn('Pace of events')[0].layout.xaxis).toMatchObject({ rangemode: 'tozero' });
    expect(figuresIn('Pace of events')[0].layout.xaxis).not.toHaveProperty('type');
    expect(pace().getByText(/The axis is linear, from zero/)).toBeInTheDocument();

    // Each chart keeps its own scales.
    choose('Dataset size', 'Horizontal axis', 'Linear');
    expect(figuresIn('Dataset size')[0].layout.xaxis).toMatchObject({ title: { text: 'Count' } });
    expect(figuresIn('How long the tail of codes is')[0].layout.xaxis).toMatchObject({ type: 'log' });
    choose('Dataset size', 'Horizontal axis', 'Log');
    expect(figuresIn('Dataset size')[0].layout.xaxis).toMatchObject({
      type: 'log',
      minor: { dtick: 'D1' },
    });

    // Bubbles are sized by unique codes at first, and by subjects on request; the axes switch independently.
    const depth = () => within(sectionOf('Depth vs. breadth'));
    choose('Depth vs. breadth', 'Bubble size', 'Subjects');
    // Subjects are then both across and the bubble size, and every text says so.
    expect(
      depth().getByText(/^Bubble area is proportional to the number of subjects, which the horizontal axis/)
    ).toBeInTheDocument();
    expect(depth().getByText('1K subjects')).toBeInTheDocument();
    expect(
      depth().getByText(/The bubble's area shows the number of subjects, as the horizontal axis does\./)
    ).toBeInTheDocument();
    expect(depth().getByRole('img')).toHaveAccessibleName(
      'Subjects against median events per subject, one bubble per dataset, sized by subjects'
    );
    expect(figuresIn('Depth vs. breadth')[0].data[0].hovertemplate).toContain(
      'Subjects (across, bubble size)'
    );
    // Unique codes across, sized by subjects.
    choose('Depth vs. breadth', 'Breadth', 'Unique codes');
    expect(figuresIn('Depth vs. breadth')[0].layout.xaxis).toMatchObject({
      title: { text: 'Unique codes (log scale)' },
    });
    expect(
      depth().getByText(
        /Across is its breadth: the number of unique codes it has\..* area shows the number of subjects\./
      )
    ).toBeInTheDocument();
    expect(depth().getByRole('img')).toHaveAccessibleName(
      'Unique codes against median events per subject, one bubble per dataset, sized by subjects'
    );
    choose('Depth vs. breadth', 'Breadth', 'Subjects');
    expect(depth().getByText(/Both axes are logarithmic/)).toBeInTheDocument();
    choose('Depth vs. breadth', 'Vertical axis', 'Linear');
    expect(figuresIn('Depth vs. breadth')[0].layout.xaxis).toMatchObject({ type: 'log' });
    expect(figuresIn('Depth vs. breadth')[0].layout.yaxis).toMatchObject({ type: 'linear' });
    expect(
      depth().getByText(/The horizontal axis is logarithmic, .* and the vertical axis linear\./)
    ).toBeInTheDocument();
    choose('Depth vs. breadth', 'Horizontal axis', 'Linear');
    expect(depth().getByText(/Both axes are linear\./)).toBeInTheDocument();
    choose('Depth vs. breadth', 'Vertical axis', 'Log');
    expect(
      depth().getByText(/The vertical axis is logarithmic, .* and the horizontal axis linear\./)
    ).toBeInTheDocument();
    choose('Depth vs. breadth', 'Bubble size', 'Unique codes');
    expect(
      depth().getByText('Bubble area is proportional to the number of unique codes.')
    ).toBeInTheDocument();

    // The tail plot's description and label follow its scales.
    const tail = () => within(sectionOf('How long the tail of codes is'));
    choose('How long the tail of codes is', 'Vertical axis', 'Linear');
    expect(figuresIn('How long the tail of codes is')[0].layout.yaxis).toMatchObject({ type: 'linear' });
    expect(tail().getByRole('img')).toHaveAccessibleName(
      /against the number of codes, logarithmic across and linear up, one curve per dataset/
    );
    expect(tail().queryByText(/can't go on a logarithmic axis/)).not.toBeInTheDocument();
    expect(tail().getByText(/With both axes logarithmic, the chart is a power-law plot/)).toBeInTheDocument();
    choose('How long the tail of codes is', 'Horizontal axis', 'Linear');
    expect(tail().getByRole('img')).toHaveAccessibleName(/codes, both linear, one curve/);
    choose('How long the tail of codes is', 'Vertical axis', 'Log');
    expect(tail().getByRole('img')).toHaveAccessibleName(
      /codes, linear across and logarithmic up, one curve/
    );
    expect(tail().getByText(/can't go on a logarithmic axis/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Highlight'), { target: { value: 'Demo' } });
    // The highlighted curve is drawn last, on top; the other keeps its colour but fades.
    const highlighted = figuresIn('How long the tail of codes is')[0].data;
    expect(highlighted.map(trace => trace.name)).toEqual(['Big', 'Demo']);
    expect(highlighted.map(trace => trace.opacity)).toEqual([0.25, 1]);
    expect(tail().getByRole('img')).toHaveAccessibleName(/, Demo highlighted$/);

    fireEvent.click(screen.getByLabelText(/Include demo datasets/));
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big']);
    expect(screen.queryByText('demo_summary_stats.json')).not.toBeInTheDocument();
    // No file in view has the per-subject rate any more: no chart and no scale toggle.
    expect(figuresIn('Pace of events')).toHaveLength(0);
    expect(pace().queryByRole('group')).not.toBeInTheDocument();
    expect(pace().getByText(/Its stats file has no per-subject events per day/)).toBeInTheDocument();
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
          eventsMapped: 0.1,
          codesWithParents: 0.1,
          vocabularies: [{ name: 'LOCAL', events: 50, recognized: false }],
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

  it('shows the missing codes as a percentage, or as a number of codes on request', () => {
    const missing = statsEntry('Missing', {
      stats: etlStats(1000, {
        codeMetadata: {
          present: true,
          codes: 50,
          withDescription: 50,
          dataCodesMissing: 5,
          metadataCodesUnused: 0,
        },
      }),
    });
    mockUsePluginData.mockReturnValue({ ...data, datasets: [big, missing] });
    render(<DatasetStatistics />);
    const scorecard = within(sectionOf('Health check')).getByRole('table');
    // 5 of the 50 distinct codes in the data.
    expect(within(scorecard).getByRole('row', { name: /^Missing/ })).toHaveTextContent('10.0%');
    expect(
      within(sectionOf('Health check')).getByText(/as a percentage of the distinct codes/)
    ).toBeInTheDocument();
    choose('Health check', 'Missing codes', 'Number of codes');
    expect(within(scorecard).getByRole('row', { name: /^Missing/ })).toHaveTextContent('5 codes');
  });

  it('groups the ICD vocabularies and says how, and marks names and versions set in the configuration', () => {
    const icd = statsEntry('Coded', {
      datasetOverride: { name: 'Coded', version: '3.2' },
      stats: etlStats(1000, {
        ontology: {
          eventsMapped: 0.6,
          codesWithParents: 0.25,
          vocabularies: [
            { name: 'ICD10CM', events: 600, recognized: true },
            { name: 'ICD9CM', events: 500, recognized: true },
          ],
          suppressed: { cells: 2, events: 9 },
          mappedEvents: 1000,
          noVocabularyEvents: 0,
          codesInMultipleVocabularies: 7,
        },
      }),
    });
    mockUsePluginData.mockReturnValue({ ...data, datasets: [big, icd] });
    const { rerender } = render(<DatasetStatistics />);
    const mapping = within(sectionOf('Mapping to vocabularies'));
    expect(
      mapping.getByText(/each column is one vocabulary \(ICD groups several, see below\): the share/)
    ).toBeInTheDocument();
    expect(
      mapping.getByText(/groups the vocabularies whose names start with ICD: ICD10CM and ICD9CM\./)
    ).toBeInTheDocument();
    // At least 1,000 - 9 = 991 and at most 1,000 of 100,000 events: 0.99% and 1.0% round alike.
    // (Big's code metadata maps nothing.)
    expect(figuresIn('Mapping to vocabularies')[0].data[1].text).toEqual([
      ['0%', '0%', '', ''],
      ['60%', '25%', '', '1.0%'],
    ]);
    expect(
      mapping.getByText(/and the range otherwise\. Suppressed vocabularies are not named/)
    ).toBeInTheDocument();
    expect(mapping.getByText('Scroll the heatmap sideways to see every vocabulary.')).toBeInTheDocument();
    // The datasets' names are beside the heatmap, for sighted readers only; the heatmap has its own label.
    const names = mapping.getByText('Coded', { selector: '[aria-hidden="true"] > *' }).parentElement;
    expect(names?.textContent).toBe('BigCoded');

    const row = within(sectionOf('Datasets and their stats files')).getByRole('row', { name: /^Coded/ });
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('Coded 3.2†');
    expect(
      screen.getByText(/Set in this site's configuration \(.*\) rather than taken from the stats file\./)
    ).toBeInTheDocument();

    // A file that only bounds its ICD share, without suppressed vocabularies, is named.
    const ranged = statsEntry('Ranged', {
      stats: etlStats(1000, {
        ontology: {
          eventsMapped: 0.0188,
          codesWithParents: 0.25,
          vocabularies: [
            { name: 'ICD10CM', events: 1600, recognized: true },
            { name: 'ICD9CM', events: 300, recognized: true },
            { name: 'PMH', events: 50, recognized: false },
          ],
          suppressed: null,
          mappedEvents: 1880,
          noVocabularyEvents: 0,
          codesInMultipleVocabularies: 90,
        },
      }),
    });
    mockUsePluginData.mockReturnValue({ ...data, datasets: [ranged] });
    rerender(<DatasetStatistics />);
    expect(figuresIn('Mapping to vocabularies')[0].data[1].text).toEqual([
      ['1.9%', '25%', '', '1.8–<br>1.9%', '0.1%'],
    ]);
    expect(
      within(sectionOf('Mapping to vocabularies')).getByText(
        /and the range otherwise \(Ranged\)\. Hover over a cell/
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Set in this site's configuration/)).not.toBeInTheDocument();
  });

  it('lists stats files committed to this repository, saying so in place of an ETL repository', () => {
    const here = (label: string) =>
      statsEntry(label, {
        id: `${SITE_GITHUB_REPO.toLowerCase()}/static/data/etl_summary_stats/${label.toLowerCase()}.json`,
        host: 'site',
        githubRepo: SITE_GITHUB_REPO,
        path: `static/data/etl_summary_stats/${label.toLowerCase()}_full_summary_stats.json`,
      });
    mockUsePluginData.mockReturnValue({ ...data, datasets: [big, here('Alpha')] });
    const { rerender } = render(<DatasetStatistics />);
    const row = within(sectionOf('Datasets and their stats files')).getByRole('row', { name: /^Alpha/ });
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent(
      "alpha_full_summary_stats.jsonin this site's repository"
    );
    expect(within(row).getAllByRole('link')).toHaveLength(1);
    expect(within(row).getByRole('link', { name: 'alpha_full_summary_stats.json' })).toHaveAttribute(
      'href',
      `https://github.com/${SITE_GITHUB_REPO}/blob/HEAD/static/data/etl_summary_stats/alpha_full_summary_stats.json`
    );
    expect(screen.queryByText(/Set in this site's configuration/)).not.toBeInTheDocument();
    expect(screen.getByText(/some are committed to this site's repository/)).toBeInTheDocument();
    // It is in every comparison.
    expect(figuresIn('Dataset size')[0].data[0].y).toEqual(['Big', 'Alpha']);
    expect(figuresIn('How long the tail of codes is')[0].data.map(trace => trace.name)).toEqual([
      'Alpha',
      'Big',
    ]);

    mockUsePluginData.mockReturnValue({
      ...data,
      datasets: [big, here('Alpha'), here('Beta'), here('Gamma')],
    });
    rerender(<DatasetStatistics />);
    expect(
      within(sectionOf('Datasets and their stats files')).getAllByText("in this site's repository")
    ).toHaveLength(3);
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

  it('draws no chart, frame or toggle where no dataset can be drawn', () => {
    mockUsePluginData.mockReturnValue({ updatedAt: null, datasets: [future], reposWithoutStats: [] });
    render(<DatasetStatistics />);
    expect(screen.queryAllByTestId('plot')).toHaveLength(0);
    expect(within(sectionOf('Dataset size')).getByText('Future')).toBeInTheDocument();
    expect(within(sectionOf('Dataset size')).getByText(/No dataset can be drawn/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Highlight')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('group', { name: /axis$|Bubble size/ })).toHaveLength(0);
    // The per-subject measure stays, since another measure may have data.
    expect(screen.getByRole('group', { name: 'Per-subject measure' })).toBeInTheDocument();
    expect(within(sectionOf('Health check')).getAllByRole('row')).toHaveLength(1);
  });
});
