import { describe, expect, it } from '@jest/globals';
import {
  AXIS_SCALES,
  baseLayout,
  canBeLog,
  CATEGORICAL_COLORS,
  codeTailChart,
  codeTailPoints,
  coverageChart,
  datasetName,
  BREADTH_MEASURES,
  depthBreadthChart,
  formatCompact,
  formatCount,
  formatDate,
  formatPercent,
  formatPercentDown,
  formatPercentNonZero,
  formatPercentSignificant,
  formatShareBounds,
  groupShare,
  formatRatio,
  githubRepoUrl,
  HEALTH_CHECKS,
  healthCheck,
  ICD_GROUP,
  isIcdVocabulary,
  LOG_AXIS_TICKS,
  MISSING_CODES_VIEWS,
  linearTicks,
  logTicks,
  orderDatasets,
  paceChart,
  partition,
  perSubjectChart,
  placeLabels,
  ratio,
  schemaDescription,
  SERIES_COLORS,
  seriesStyle,
  sizeChart,
  sortByEvents,
  statsFileUrl,
  valueAxis,
  vocabularyChart,
} from './charts';
import { etlStats, statsEntry } from './testFixtures';
import type { Distribution, EtlStats, EtlStatsEntry } from './types';

/** A trace's attributes, for asserting on what Plotly is given. */
const attrs = (trace: unknown) => trace as Record<string, unknown>;

const big = statsEntry('Big', { stats: etlStats(5000) });
const small = statsEntry('Small', { stats: etlStats(100) });
const unreadable = statsEntry('Future', {
  schemaVersion: 3,
  stats: null,
  problem: 'Its stats schema version is 3, which this page cannot read yet (it reads versions 1 and 2).',
});

describe('formatting', () => {
  it('formats numbers', () => {
    expect(formatCompact(364627)).toBe('364.6K');
    expect(formatCompact(881_400_075)).toBe('881.4M');
    expect(formatCount(364627)).toBe('364,627');
    expect(formatCount(2.25)).toBe('2.3');
  });

  it('formats shares with sensible precision', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.0001)).toBe('<0.1%');
    expect(formatPercent(0.061)).toBe('6.1%');
    expect(formatPercent(0.0997)).toBe('10%');
    expect(formatPercent(0.594)).toBe('59%');
    expect(formatPercent(1)).toBe('100%');
    // Rounded down, so a share short of 100% never reads 100%.
    expect(formatPercentDown(0.99987)).toBe('99.9%');
    expect(formatPercentDown(0.5537)).toBe('55.3%');
    expect(formatPercentDown(1)).toBe('100%');
    // Rounded down too, but a share above zero never reads 0.0%.
    expect(formatPercentNonZero(0.0004)).toBe('<0.1%');
    expect(formatPercentNonZero(0.0457)).toBe('4.5%');
    expect(formatPercentNonZero(0)).toBe('0.0%');
    // Two significant digits, however small, for log axes.
    expect(formatPercentSignificant(1)).toBe('100%');
    expect(formatPercentSignificant(0.061)).toBe('6.1%');
    expect(formatPercentSignificant(0.0013)).toBe('0.13%');
    expect(formatPercentSignificant(0.0000423)).toBe('0.0042%');
    expect(formatPercentSignificant(0)).toBe('0%');
  });

  it('formats ratios to three significant digits', () => {
    expect(formatRatio(0.013712)).toBe('0.0137');
    expect(formatRatio(16.5321)).toBe('16.5');
    expect(formatRatio(2)).toBe('2');
  });

  it('formats dates', () => {
    expect(formatDate('2026-11-04T22:16:51.111265')).toBe('2026-11-04');
    expect(formatDate('yesterday')).toBe('yesterday');
    expect(formatDate(null)).toBe('—');
  });

  it('builds log-axis ticks at powers of ten, optionally with intermediate ticks', () => {
    expect(logTicks(120, 45_000)).toEqual({
      tickvals: [100, 1000, 10000, 100000],
      ticktext: ['100', '1K', '10K', '100K'],
    });
    expect(logTicks(0.02, 4, [1, 3])).toEqual({
      tickvals: [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30],
      ticktext: ['0.01', '0.03', '0.1', '0.3', '1', '3', '10', '30'],
    });
  });

  it('uses a log axis only for positive values, with fainter gridlines at 2 to 9 times each power of ten', () => {
    expect(valueAxis([10, 1000], 'Count')).toEqual({
      type: 'log',
      title: { text: 'Count (log scale)' },
      tickvals: [10, 100, 1000],
      ticktext: ['10', '100', '1K'],
      ticks: 'outside',
      ticklen: 6,
      tickcolor: expect.any(String),
      showgrid: true,
      gridcolor: '#e1e0d9',
      minor: {
        ticks: 'outside',
        dtick: 'D1',
        ticklen: 3,
        tickcolor: expect.any(String),
        showgrid: true,
        gridcolor: '#efeee9',
      },
    });
    expect(valueAxis([0, 1000], 'Count')).toEqual({
      title: { text: 'Count' },
      rangemode: 'tozero',
      ...linearTicks(1000),
    });
    expect(valueAxis([], 'Count')).toEqual({
      title: { text: 'Count' },
      rangemode: 'tozero',
      tickvals: [0],
      ticktext: ['0'],
    });
    expect(canBeLog([10, 1000])).toBe(true);
    expect(canBeLog([0, 1000])).toBe(false);
    expect(canBeLog([])).toBe(false);
  });

  it('builds linear-axis ticks from zero, at 1, 2, 5 or 10 times a power of ten, labelled like log ticks', () => {
    expect(linearTicks(1000)).toEqual({
      tickvals: [0, 200, 400, 600, 800, 1000, 1200],
      ticktext: ['0', '200', '400', '600', '800', '1K', '1.2K'],
    });
    expect(linearTicks(1_100_000_000).ticktext).toEqual(['0', '500M', '1B', '1.5B']);
    expect(linearTicks(5).tickvals).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(linearTicks(40).tickvals).toEqual([0, 10, 20, 30, 40, 50]);
    expect(linearTicks(0.7)).toEqual({
      tickvals: [0, 0.2, 0.4, 0.6, 0.8],
      ticktext: ['0', '0.2', '0.4', '0.6', '0.8'],
    });
    expect(linearTicks(0)).toEqual({ tickvals: [0], ticktext: ['0'] });
  });

  it('uses a linear axis from zero when asked', () => {
    expect(valueAxis([10, 1000], 'Count', 'linear')).toEqual({
      title: { text: 'Count' },
      rangemode: 'tozero',
      ...linearTicks(1000),
    });
    expect(valueAxis([10, 1000], 'Count', 'log')).toMatchObject({ type: 'log' });
    expect(AXIS_SCALES.map(scale => [scale.key, scale.label])).toEqual([
      ['log', 'Log'],
      ['linear', 'Linear'],
    ]);
  });

  it('computes ratios only when both parts are known', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(null, 4)).toBeNull();
    expect(ratio(1, null)).toBeNull();
    expect(ratio(1, 0)).toBeNull();
  });

  it('describes provenance', () => {
    expect(githubRepoUrl('org/Repo')).toBe('https://github.com/org/Repo');
    expect(statsFileUrl(big)).toBe('https://github.com/org/Big/blob/HEAD/stats/full_summary_stats.json');
    expect(datasetName(big)).toBe('Big 1.0');
    expect(datasetName(statsEntry('Plain'))).toBe('Plain 1.0');
    expect(datasetName(statsEntry('X', { dataset: null }))).toBe('—');
    // This site's configuration can set either part instead, or hide it.
    expect(datasetName(statsEntry('X', { datasetOverride: { name: 'Shown', version: '2' } }))).toBe(
      'Shown 2'
    );
    expect(datasetName(statsEntry('X', { datasetOverride: { version: null } }))).toBe('X');
    expect(datasetName(statsEntry('X', { dataset: null, datasetOverride: { name: 'Shown' } }))).toBe('Shown');
    expect(schemaDescription(big)).toBe('1 (tool\u00a00.0.3)');
    expect(schemaDescription(statsEntry('X', { toolVersion: null }))).toBe('1');
    expect(schemaDescription(statsEntry('X', { schemaVersion: null }))).toBe('—');
  });
});

describe('shared helpers', () => {
  it('orders datasets by subjects, largest first, with unreadable ones last', () => {
    const tie = statsEntry('Also small', { stats: etlStats(100) });
    expect(orderDatasets([unreadable, small, big, tie]).map(e => e.label)).toEqual([
      'Big',
      'Also small',
      'Small',
      'Future',
    ]);
  });

  it('skips unreadable files with their problem, or a generic reason', () => {
    const noProblem = statsEntry('Broken', { stats: null, problem: null });
    const { drawn, skipped } = partition([big, unreadable, noProblem], stats => stats.counts.subjects);
    expect(drawn.map(d => d.value)).toEqual([5000]);
    expect(skipped).toEqual([
      { label: 'Future', reason: unreadable.problem },
      { label: 'Broken', reason: 'Its stats file could not be read.' },
    ]);
  });

  it('sizes a horizontal chart by its rows and lets callers override axes', () => {
    const layout = baseLayout(3, { yaxis: { autorange: true } });
    expect(layout.height).toBe(3 * 34 + 8 + 40);
    // No drag mode, so touch gestures scroll the page rather than being caught by the chart.
    expect(layout.dragmode).toBe(false);
    expect(layout.yaxis).toMatchObject({ autorange: true, automargin: true });
    expect(baseLayout(0).height).toBe(34 + 8 + 40);
  });
});

describe('sortByEvents', () => {
  const withEvents = (label: string, events: number | null) =>
    statsEntry(label, { stats: etlStats(10, { counts: { ...etlStats(10).counts, events } }) });
  const labels = (items: EtlStatsEntry[]) => items.map(item => item.label);

  it('puts the most events first, ties in name order, and missing counts and unreadable files last', () => {
    expect(
      labels(
        sortByEvents([
          withEvents('Beta', 300),
          unreadable,
          withEvents('None', null),
          withEvents('Gamma', 5000),
          withEvents('Alpha', 300),
        ])
      )
    ).toEqual(['Gamma', 'Alpha', 'Beta', 'Future', 'None']);
  });
});

describe('sizeChart', () => {
  it('draws events and unique codes as grouped bars on one log axis, most events first', () => {
    const model = sizeChart([small, big, unreadable]);
    const traces = (model.figure?.data ?? []).map(attrs);
    expect(traces.map(t => t.name)).toEqual(['Events', 'Unique codes']);
    expect(traces.map(t => t.y)).toEqual([
      ['Big', 'Small'],
      ['Big', 'Small'],
    ]);
    // Events are rows: the fixture has 100 per subject.
    expect(traces.map(t => t.x)).toEqual([
      [500000, 10000],
      [50, 50],
    ]);
    expect(traces[0].text).toEqual(['500K', '10K']);
    expect(traces[0].customdata).toEqual(['500,000', '10,000']);
    expect(traces.map(t => (t.marker as { color: string }).color)).toEqual([
      SERIES_COLORS[0],
      SERIES_COLORS[1],
    ]);
    expect(model.figure?.layout).toMatchObject({ barmode: 'group', showlegend: true });
    expect(model.figure?.layout.xaxis).toMatchObject({
      type: 'log',
      title: { text: 'Count (log scale)' },
      ...LOG_AXIS_TICKS,
    });
    expect(model.logAxes).toEqual(['x']);
    expect(model.skipped).toEqual([{ label: 'Future', reason: unreadable.problem }]);
    expect(model.table.columns).toEqual(['Dataset', 'Subjects', 'Events', 'Unique codes']);
    expect(model.table.rows).toEqual([
      ['Big', '5,000', '500,000', '50'],
      ['Small', '100', '10,000', '50'],
    ]);
  });

  it('draws a linear axis from zero when asked, keeping the toggle', () => {
    const model = sizeChart([small, big], 'linear');
    expect(model.figure?.layout.xaxis).toEqual(
      expect.objectContaining({ title: { text: 'Count' }, rangemode: 'tozero' })
    );
    expect(model.figure?.layout.xaxis).not.toHaveProperty('type');
    expect(model.figure?.layout.xaxis).not.toHaveProperty('minor');
    expect(model.logAxes).toEqual(['x']);
  });

  it('keeps a dataset with some counts, noting the missing bar, and leaves out one with none', () => {
    const noCodes = statsEntry('No codes', {
      stats: etlStats(300, { counts: { ...etlStats(300).counts, uniqueCodes: null } }),
    });
    const noCounts = statsEntry('No counts', {
      stats: etlStats(300, { counts: { ...etlStats(300).counts, events: null, uniqueCodes: null } }),
    });
    const noEvents = statsEntry('No events', {
      stats: etlStats(200, { counts: { ...etlStats(200).counts, events: null } }),
    });
    const model = sizeChart([noCodes, noCounts, noEvents, small]);
    const [events, codes] = (model.figure?.data ?? []).map(attrs);
    expect(events.y).toEqual(['No codes', 'Small', 'No events']);
    expect(events.x).toEqual([30000, 10000, null]);
    expect(events.text).toEqual(['30K', '10K', '']);
    expect(events.customdata).toEqual(['30,000', '10,000', '—']);
    expect(codes.x).toEqual([null, 50, 50]);
    expect(model.skipped).toEqual([
      { label: 'No counts', reason: 'Its stats file has no event or unique-code counts.' },
      { label: 'No codes', reason: 'Its stats file has no unique codes count, so that bar is missing.' },
      { label: 'No events', reason: 'Its stats file has no events count, so that bar is missing.' },
    ]);
    // The table follows the chart's order, with datasets missing the event count last.
    expect(model.table.rows).toEqual([
      ['No codes', '300', '30,000', '—'],
      ['Small', '100', '10,000', '50'],
      ['No counts', '300', '—', '—'],
      ['No events', '200', '—', '50'],
    ]);
  });

  it('has no figure when nothing can be drawn, and no log axis for a count of zero', () => {
    expect(sizeChart([unreadable])).toEqual({
      figure: null,
      skipped: [{ label: 'Future', reason: unreadable.problem }],
      table: { columns: ['Dataset', 'Subjects', 'Events', 'Unique codes'], rows: [] },
      logAxes: [],
    });
    const empty = statsEntry('Empty', {
      stats: etlStats(0, { counts: { ...etlStats(0).counts, uniqueCodes: 0 } }),
    });
    const model = sizeChart([empty, big]);
    expect(model.logAxes).toEqual([]);
    expect(model.figure?.layout.xaxis).toMatchObject({ title: { text: 'Count' }, rangemode: 'tozero' });
  });
});

describe('perSubjectChart', () => {
  it('draws boxes from the published quantiles, and skips suppressed or missing distributions', () => {
    const suppressed = statsEntry('Tiny', {
      stats: etlStats(30, {
        perSubject: { ...etlStats(30).perSubject, spanDays: { suppressed: true, n: 30 } },
      }),
    });
    const floorless = statsEntry('Floorless', {
      minCellSize: null,
      stats: etlStats(20, {
        perSubject: { ...etlStats(20).perSubject, spanDays: { suppressed: true, n: 20 } },
      }),
    });
    const missing = statsEntry('Missing', {
      stats: etlStats(10, { perSubject: { ...etlStats(10).perSubject, spanDays: null } }),
    });
    const model = perSubjectChart([small, suppressed, big, floorless, missing], 'spanDays');
    const [box, hover] = model.figure?.data ?? [];
    expect(attrs(box)).toMatchObject({
      type: 'box',
      y: ['Big', 'Small'],
      lowerfence: [30, 30],
      q1: [60, 60],
      median: [90, 90],
      q3: [120, 120],
      upperfence: [150, 150],
    });
    expect(attrs(hover).customdata).toEqual([
      ['30', '60', '90', '120', '150', '100'],
      ['30', '60', '90', '120', '150', '100'],
    ]);
    expect(model.figure?.layout.xaxis).toMatchObject({
      title: { text: 'Days from first to last event per subject (log scale)' },
    });
    expect(model.skipped).toEqual([
      {
        label: 'Tiny',
        reason: 'Suppressed: the quantiles are withheld because they rest on fewer than 20 subjects.',
      },
      {
        label: 'Floorless',
        reason: 'Suppressed: the quantiles are withheld because they rest on too few subjects.',
      },
      { label: 'Missing', reason: 'Its stats file has no per-subject record span distribution.' },
    ]);
    expect(attrs(hover).hovertemplate).toContain('<br>Subjects: %{customdata[5]}');
    expect(model.table.columns[1]).toBe('Subjects');
    expect(model.table.rows[0]).toEqual(['Big', '100', '30', '60', '90', '120', '150']);
  });

  it('leaves out a whisker whose percentile the file leaves out, and says so', () => {
    const base = etlStats(20).perSubject.events as Exclude<Distribution, { suppressed: true }>;
    // meds_summary_stats 0.0.4 leaves out the 5th and 95th percentiles of fewer than 21 values.
    const twenty = statsEntry('Twenty', {
      stats: etlStats(20, { perSubject: perSubject({ events: { ...base, n: 20, p5: null, p95: null } }) }),
    });
    const oneSided = statsEntry('One-sided', {
      stats: etlStats(10, { perSubject: perSubject({ events: { ...base, p95: null } }) }),
    });
    const model = perSubjectChart([big, twenty, oneSided], 'events');
    const [box, hover] = (model.figure?.data ?? []).map(attrs);
    // A missing whisker ends at its box.
    expect(box).toMatchObject({
      y: ['Big', 'Twenty', 'One-sided'],
      lowerfence: [10, 20, 10],
      q1: [20, 20, 20],
      q3: [40, 40, 40],
      upperfence: [50, 40, 40],
    });
    expect(attrs(hover).customdata).toEqual([
      ['10', '20', '30', '40', '50', '100'],
      ['withheld', '20', '30', '40', 'withheld', '20'],
      ['10', '20', '30', '40', 'withheld', '100'],
    ]);
    expect(model.table.rows[1]).toEqual(['Twenty', '20', 'withheld', '20', '30', '40', 'withheld']);
    expect(model.notes).toEqual([
      'Without a whisker where the stats file leaves out the 5th or 95th percentile, as meds_summary_stats does ' +
        'from version 0.0.4 on where they would depend on the smallest or largest value: Twenty, One-sided.',
    ]);
    expect(model.skipped).toEqual([]);
    expect(perSubjectChart([big], 'events').notes).toEqual([]);
  });

  it('skips a distribution whose file leaves out its quartiles or median', () => {
    const withheld = statsEntry('Withheld', {
      stats: etlStats(4, {
        perSubject: perSubject({ uniqueCodes: { suppressed: true, n: 4, extremes: true } }),
      }),
    });
    const model = perSubjectChart([big, withheld], 'uniqueCodes');
    expect(attrs(model.figure?.data[0]).y).toEqual(['Big']);
    expect(model.skipped).toEqual([
      {
        label: 'Withheld',
        reason:
          'Withheld: its stats file leaves out the quartiles or median of the distinct codes per subject, as ' +
          'meds_summary_stats does from version 0.0.4 on where they would depend on the smallest or largest value.',
      },
    ]);
    expect(perSubjectChart([withheld], 'spanDays').skipped).toEqual([]);
  });

  it('has no figure when every distribution is suppressed', () => {
    const tiny = statsEntry('Tiny', {
      stats: etlStats(5, { perSubject: { ...etlStats(5).perSubject, events: { suppressed: true, n: 5 } } }),
    });
    expect(perSubjectChart([tiny], 'events')).toMatchObject({ figure: null, logAxes: [] });
  });

  it("draws each subject's events, on a log axis or, when asked, a linear one", () => {
    const log = perSubjectChart([big], 'events');
    expect(attrs(log.figure?.data[0]).median).toEqual([30]);
    expect(log.figure?.layout.xaxis).toMatchObject({
      type: 'log',
      title: { text: 'Events per subject (log scale)' },
      minor: { dtick: 'D1' },
    });
    expect(log.logAxes).toEqual(['x']);
    const linear = perSubjectChart([big], 'events', 'linear');
    expect(linear.figure?.layout.xaxis).toMatchObject({
      title: { text: 'Events per subject' },
      rangemode: 'tozero',
    });
    expect(linear.logAxes).toEqual(['x']);
  });

  it('has no log axis, and so no toggle, for a 5th percentile of zero', () => {
    const sameDay = statsEntry('Same day', {
      stats: etlStats(100, {
        perSubject: perSubject({
          spanDays: { suppressed: false, n: 100, mean: null, p5: 0, p25: 2, p50: 30, p75: 40, p95: 50 },
        }),
      }),
    });
    const model = perSubjectChart([sameDay], 'spanDays');
    expect(model.logAxes).toEqual([]);
    expect(model.figure?.layout.xaxis).toMatchObject({ rangemode: 'tozero' });
    expect(model.figure?.layout.xaxis).not.toHaveProperty('type');
  });
});

describe('coverageChart', () => {
  it('shades each share, printing "n/a" where a count is missing', () => {
    const partial = statsEntry('Partial', {
      stats: etlStats(10, {
        counts: { ...etlStats(10).counts, subjectsWithDeath: null, numericValues: 0 },
      }),
    });
    const empty = statsEntry('Empty', {
      stats: etlStats(5, {
        counts: {
          subjects: null,
          events: null,
          uniqueCodes: null,
          subjectsWithBirth: null,
          subjectsWithDeath: null,
          subjectsWithStatic: null,
          numericValues: null,
        },
      }),
    });
    const model = coverageChart([partial, big, empty]);
    const heatmap = attrs(model.figure?.data[0]);
    expect(heatmap.x).toEqual(['Birth', 'Death', 'Static', 'Numeric']);
    expect(heatmap.y).toEqual(['Big', 'Partial']);
    expect(heatmap.z).toEqual([
      [1, 0.1, 0.5, 0.25],
      [1, null, 0.5, 0],
    ]);
    expect(heatmap.text).toEqual([
      ['100%', '10%', '50%', '25%'],
      ['100%', 'n/a', '50%', '0%'],
    ]);
    expect(model.skipped).toEqual([{ label: 'Empty', reason: 'Its stats file has none of these counts.' }]);
    expect(model.table.rows[1]).toEqual(['Partial', '100%', '—', '50%', '0%']);
  });

  it('has no figure without data', () => {
    expect(coverageChart([]).figure).toBeNull();
  });
});

// ─── Builders for the newer charts ──────────────────────────────

/** A published per-subject distribution with the given mean and median. */
const dist = (mean: number | null, p50 = 30): Distribution => ({
  suppressed: false,
  n: 100,
  mean,
  p5: 1,
  p25: 2,
  p50,
  p75: 40,
  p95: 50,
});
const SUPPRESSED: Distribution = { suppressed: true, n: 5 };
const perSubject = (overrides: Partial<EtlStats['perSubject']>): EtlStats['perSubject'] => ({
  ...etlStats(1).perSubject,
  ...overrides,
});
const counts = (subjects: number, overrides: Partial<EtlStats['counts']>): EtlStats['counts'] => ({
  ...etlStats(subjects).counts,
  ...overrides,
});
const entryWith = (label: string, subjects: number, overrides: Partial<EtlStats>, entry = {}) =>
  statsEntry(label, { ...entry, stats: etlStats(subjects, overrides) });

describe('placeLabels', () => {
  const point = { x: 100, y: 100, r: 10, width: 40, height: 16 };

  it('puts a label right of its marker, or left of it at the right edge', () => {
    expect(placeLabels([point], { width: 400, height: 400 })).toEqual([
      { ux: 1, uy: 0, edgeX: 12, edgeY: 0, dx: 32, dy: 0, leader: false },
    ]);
    expect(placeLabels([{ ...point, x: 390 }], { width: 400, height: 400 })).toEqual([
      { ux: -1, uy: 0, edgeX: -12, edgeY: 0, dx: -32, dy: 0, leader: false },
    ]);
  });

  it('keeps labels clear of each other and of other markers', () => {
    // A second point just right of the first: the first label can't go right, and the second label can't go
    // where the first one went.
    const [first, second] = placeLabels([point, { ...point, x: 140 }], { width: 400, height: 400 }) as {
      dx: number;
      dy: number;
    }[];
    expect(first).toMatchObject({ dx: -32, dy: 0 });
    expect(second).toMatchObject({ dx: 32, dy: 0 });
  });

  it('pushes a label out with a leader line when every nearby spot is taken, or leaves it off', () => {
    // A small point inside a large marker: its label must clear the large marker.
    const [small] = placeLabels(
      [
        { x: 200, y: 200, r: 4, width: 30, height: 16 },
        { x: 200, y: 200, r: 40, width: 30, height: 16 },
      ],
      { width: 400, height: 400 }
    );
    expect(small).toMatchObject({ leader: true });
    expect(placeLabels([{ ...point, width: 500 }], { width: 400, height: 400 })).toEqual([null]);
  });
});

describe('depthBreadthChart', () => {
  const withCodes = (
    label: string,
    subjects: number,
    uniqueCodes: number,
    overrides: Partial<EtlStats> = {}
  ) => entryWith(label, subjects, { counts: counts(subjects, { uniqueCodes }), ...overrides });
  const wide = { narrow: false };

  it('draws a bubble per dataset, its area proportional to unique codes, on two log axes', () => {
    const broad = withCodes('Broad', 100_000, 40_000);
    const deep = withCodes('Deep', 100, 10_000, {
      perSubject: perSubject({ events: dist(9000, 1000) }),
    });
    const tiny = withCodes('Tiny', 3000, 100);
    const model = depthBreadthChart([deep, tiny, broad, unreadable], wide);
    const bubbles = attrs(model.figure?.data[0]);
    // Largest bubble first, so small ones are drawn on top.
    expect(bubbles.text).toEqual(['Broad', 'Deep', 'Tiny']);
    expect(bubbles.x).toEqual([100_000, 100, 3000]);
    expect(bubbles.y).toEqual([30, 1000, 30]);
    // 56px for the most codes, half the diameter (a quarter of the area) for a quarter of the codes, and the
    // smallest size for the rest.
    expect((bubbles.marker as { size: number[] }).size).toEqual([56, 28, 8]);
    expect(bubbles.customdata).toEqual([
      ['100,000', '30', '40,000'],
      ['100', '1,000', '10,000'],
      ['3,000', '30', '100'],
    ]);
    expect(model.sizeKey).toEqual([{ label: '10K codes', diameter: 28 }]);
    expect(model.sizeNote).toBe(
      'Bubble area is proportional to the number of unique codes. Datasets with fewer than about 817 codes are ' +
        'drawn at the smallest size, so they stay visible.'
    );
    // The hover names what each measure sets: the position across or up, or the bubble's size.
    expect(bubbles.hovertemplate).toBe(
      '%{text}<br>Subjects (across): %{customdata[0]}<br>Median events per subject (up): %{customdata[1]}' +
        '<br>Unique codes (bubble size): %{customdata[2]}<extra></extra>'
    );
    expect(model.logAxes).toEqual(['x', 'y']);
    const layout = model.figure?.layout as Record<string, Record<string, unknown>>;
    expect(layout.xaxis).toMatchObject({
      type: 'log',
      title: { text: 'Subjects (log scale)' },
      ...LOG_AXIS_TICKS,
    });
    expect(layout.yaxis).toMatchObject({
      type: 'log',
      autorange: false,
      title: { text: 'Median events per subject (log scale)' },
      minor: { dtick: 'D1' },
    });
    // Three decades of subjects get ticks at powers of ten; the medians, under two and a half, also at 3s.
    expect(layout.xaxis.ticktext).toEqual(['10', '100', '1K', '10K', '100K', '1M']);
    expect(layout.yaxis.ticktext).toEqual(['10', '30', '100', '300', '1K', '3K', '10K', '30K']);
    expect((layout.annotations as unknown as { text: string }[]).map(a => a.text)).toEqual([
      'Broad',
      'Tiny',
      'Deep',
    ]);
    expect(model.unlabelled).toEqual([]);
    expect(model.skipped).toEqual([{ label: 'Future', reason: unreadable.problem }]);
    expect(model.table).toEqual({
      columns: ['Dataset', 'Subjects', 'Median events per subject', 'Unique codes'],
      rows: [
        ['Broad', '100,000', '30', '40,000'],
        ['Tiny', '3,000', '30', '100'],
        ['Deep', '100', '1,000', '10,000'],
      ],
    });
  });

  it('sizes bubbles by subjects when asked, and says so in the key, the note and the hover', () => {
    const many = withCodes('Many', 100_000, 100);
    const quarter = withCodes('Quarter', 25_000, 40_000);
    const few = withCodes('Few', 1000, 10_000);
    const model = depthBreadthChart([many, quarter, few], { ...wide, size: 'subjects' });
    const bubbles = attrs(model.figure?.data[0]);
    expect(bubbles.text).toEqual(['Many', 'Quarter', 'Few']);
    expect((bubbles.marker as { size: number[] }).size).toEqual([56, 28, 8]);
    // Subjects set both the position across and the size, and every text says so.
    expect(bubbles.hovertemplate).toContain('Subjects (across, bubble size): %{customdata[0]}');
    expect(bubbles.hovertemplate).toContain('<br>Unique codes: %{customdata[2]}');
    expect(model.sizeKey).toEqual([
      { label: '100K subjects', diameter: 56 },
      { label: '10K subjects', diameter: 56 * Math.sqrt(0.1) },
    ]);
    expect(model.sizeNote).toBe(
      'Bubble area is proportional to the number of subjects, which the horizontal axis also shows. Datasets ' +
        'with fewer than about 2K subjects are drawn at the smallest size, so they stay visible.'
    );
    // The positions don't change with the size.
    expect(bubbles.x).toEqual([100_000, 25_000, 1000]);
    expect(BREADTH_MEASURES.map(option => option.key)).toEqual(['subjects', 'uniqueCodes']);
  });

  it('puts unique codes across when asked, sized by unique codes or subjects', () => {
    const many = withCodes('Many', 100_000, 100);
    const quarter = withCodes('Quarter', 25_000, 40_000);
    const model = depthBreadthChart([many, quarter], { ...wide, breadth: 'uniqueCodes', size: 'subjects' });
    const bubbles = attrs(model.figure?.data[0]);
    expect(bubbles.x).toEqual([100, 40_000]);
    expect(bubbles.hovertemplate).toContain('Subjects (bubble size): %{customdata[0]}');
    expect(bubbles.hovertemplate).toContain('<br>Unique codes (across): %{customdata[2]}');
    expect(model.sizeNote).toBe('Bubble area is proportional to the number of subjects.');
    const layout = model.figure?.layout as Record<string, Record<string, unknown>>;
    expect(layout.xaxis).toMatchObject({ type: 'log', title: { text: 'Unique codes (log scale)' } });
    // Labels sit at the codes, in powers of ten on the log axis.
    const annotations = layout.annotations as unknown as { text: string; x: number }[];
    expect(annotations.find(a => a.text === 'Quarter')?.x).toBeCloseTo(Math.log10(40_000));
    // The default size is unique codes, then on both.
    const both = depthBreadthChart([many, quarter], { ...wide, breadth: 'uniqueCodes' });
    expect(attrs(both.figure?.data[0]).hovertemplate).toContain('Unique codes (across, bubble size)');
    expect(both.sizeNote).toMatch(
      /^Bubble area is proportional to the number of unique codes, which the hor/
    );
    // A dataset with no codes can't go on a log axis of codes, but can on a linear one.
    const none = withCodes('None', 500, 0);
    expect(depthBreadthChart([many, none], { ...wide, breadth: 'uniqueCodes' }).skipped).toEqual([
      {
        label: 'None',
        reason: 'Its unique-code count or median is zero, which a logarithmic axis cannot show.',
      },
    ]);
    expect(
      depthBreadthChart([many, none], { ...wide, breadth: 'uniqueCodes', scales: { x: 'linear' } }).skipped
    ).toEqual([]);
  });

  it('draws linear axes when asked, placing labels on them, and keeps datasets a log axis cannot show', () => {
    const broad = withCodes('Broad', 100_000, 40_000);
    const deep = withCodes('Deep', 100, 10_000, { perSubject: perSubject({ events: dist(9000, 1000) }) });
    const zero = entryWith('Zero median', 10, { perSubject: perSubject({ events: dist(1, 0) }) });
    const model = depthBreadthChart([broad, deep, zero], { ...wide, scales: { x: 'linear', y: 'linear' } });
    expect(model.skipped).toEqual([]);
    expect(model.logAxes).toEqual(['x', 'y']);
    const layout = model.figure?.layout as Record<string, Record<string, unknown>>;
    expect(layout.xaxis).toMatchObject({ type: 'linear', title: { text: 'Subjects' } });
    expect(layout.xaxis).not.toHaveProperty('minor');
    expect(layout.yaxis).toMatchObject({ type: 'linear', title: { text: 'Median events per subject' } });
    // From zero to the largest value, with room for the largest bubble on both sides.
    const [xLo, xHi] = layout.xaxis.range as number[];
    expect(xLo).toBeLessThan(0);
    expect(xHi).toBeGreaterThan(100_000);
    const [yLo, yHi] = layout.yaxis.range as number[];
    expect(yLo).toBeLessThan(0);
    expect(yHi).toBeGreaterThan(1000);
    // Labels sit at the values themselves, not their logarithms.
    const annotations = layout.annotations as unknown as { text: string; x: number; y: number }[];
    expect(annotations.find(a => a.text === 'Broad')).toMatchObject({ x: 100_000, y: 30 });
    // A mixed chart: logarithmic across, linear up.
    const mixed = depthBreadthChart([broad, deep, zero], { ...wide, scales: { y: 'linear' } });
    expect(mixed.skipped).toEqual([]);
    expect(mixed.figure?.layout.xaxis).toMatchObject({ type: 'log' });
    expect(mixed.figure?.layout.yaxis).toMatchObject({ type: 'linear' });
  });

  it('uses smaller bubbles on a narrow screen, and widens an axis that spans less than a decade', () => {
    const model = depthBreadthChart([withCodes('A', 1000, 100), withCodes('B', 2000, 50)], { narrow: true });
    expect((attrs(model.figure?.data[0]).marker as { size: number[] }).size[0]).toBe(40);
    expect(model.sizeNote).toBe('Bubble area is proportional to the number of unique codes.');
    const [lo, hi] = (model.figure?.layout.xaxis as { range: number[] }).range;
    expect(hi - lo).toBeGreaterThan(1);
  });

  it('labels crowded bubbles with leader lines, and leaves off labels that cannot fit', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => withCodes(`Dataset ${i}`, 1000, 100));
    const model = depthBreadthChart(crowd, { narrow: true });
    const annotations = model.figure?.layout.annotations as { showarrow: boolean; ax?: number }[];
    expect(annotations.some(a => a.showarrow)).toBe(true);
    expect(model.unlabelled.length).toBeGreaterThan(0);
    expect(annotations.length + model.unlabelled.length).toBe(40);
  });

  it('skips datasets missing any of the three numbers, or with values a log axis cannot show', () => {
    const model = depthBreadthChart(
      [
        entryWith('No subjects', 50, { counts: counts(50, { subjects: null }) }),
        entryWith('No codes', 40, { counts: counts(40, { uniqueCodes: null }) }),
        entryWith('No distribution', 30, { perSubject: perSubject({ events: null }) }),
        entryWith('Suppressed', 20, { perSubject: perSubject({ events: SUPPRESSED }) }),
        entryWith('Withheld', 15, { perSubject: perSubject({ events: { ...SUPPRESSED, extremes: true } }) }),
        entryWith('Zero subjects', 0, {}),
        entryWith('Zero median', 10, { perSubject: perSubject({ events: dist(1, 0) }) }),
      ],
      wide
    );
    expect(model).toEqual({
      figure: null,
      logAxes: [],
      skipped: [
        { label: 'No codes', reason: 'Its stats file has no unique-code count.' },
        { label: 'No distribution', reason: 'Its stats file has no per-subject event distribution.' },
        {
          label: 'Suppressed',
          reason: 'Suppressed: the median is withheld because it rests on fewer than 20 subjects.',
        },
        {
          label: 'Withheld',
          reason:
            'Withheld: its stats file leaves out the quartiles or median of the events per subject, as ' +
            'meds_summary_stats does from version 0.0.4 on where they would depend on the smallest or largest value.',
        },
        {
          label: 'Zero median',
          reason: 'Its subject count or median is zero, which a logarithmic axis cannot show.',
        },
        {
          label: 'Zero subjects',
          reason: 'Its subject count or median is zero, which a logarithmic axis cannot show.',
        },
        { label: 'No subjects', reason: 'Its stats file has no subject count.' },
      ],
      table: expect.objectContaining({ rows: [] }),
      sizeKey: [],
      sizeNote: '',
      unlabelled: [],
    });
  });
});

describe('paceChart', () => {
  const slow = entryWith('Slow', 300, {});
  /** A published distribution of each subject's events per day. */
  const rate = (p50: number): Distribution => ({
    suppressed: false,
    n: 200,
    mean: null,
    p5: 0.05,
    p25: 0.2,
    p50,
    p75: 4,
    p95: 12.25,
  });
  const NO_RATE =
    'Its stats file has no per-subject events per day (per_subject.measurements_per_day), which ' +
    'meds_summary_stats writes from version 0.0.4 on.';

  it("draws each subject's events per day as boxes from the quantiles, ranked by median, on a log axis", () => {
    const fast = entryWith('Fast', 200, { perSubject: perSubject({ eventsPerDay: rate(1.5) }) });
    const steady = entryWith('Steady', 300, { perSubject: perSubject({ eventsPerDay: rate(0.0137) }) });
    // Stats collected before the page read the field don't have it at all.
    const older = entryWith('Older', 400, {});
    const model = paceChart([steady, older, fast, unreadable]);
    const [box, hover] = (model.figure?.data ?? []).map(attrs);
    expect(box).toMatchObject({
      type: 'box',
      y: ['Fast', 'Steady'],
      median: [1.5, 0.0137],
      upperfence: [12.25, 12.25],
    });
    // Very short records skew the mean, so it is never drawn: only the published percentiles.
    expect(box).not.toHaveProperty('mean');
    expect(box).not.toHaveProperty('boxmean');
    // `n` counts only the subjects with a rate.
    expect(hover.hovertemplate).toContain('Subjects with a rate: %{customdata[5]}');
    expect(model.table.columns[1]).toBe('Subjects with a rate');
    // Rates are given to three significant digits.
    expect(hover.customdata).toEqual([
      ['0.05', '0.2', '1.5', '4', '12.3', '200'],
      ['0.05', '0.2', '0.0137', '4', '12.3', '200'],
    ]);
    expect(model.figure?.layout.xaxis).toMatchObject({
      type: 'log',
      title: { text: 'Events per day (log scale)' },
      minor: { dtick: 'D1' },
    });
    expect(model.logAxes).toEqual(['x']);
    expect(model.table.rows).toEqual([
      ['Fast', '200', '0.05', '0.2', '1.5', '4', '12.3'],
      ['Steady', '200', '0.05', '0.2', '0.0137', '4', '12.3'],
    ]);
    expect(model.skipped).toEqual([
      { label: 'Older', reason: NO_RATE },
      { label: 'Future', reason: unreadable.problem },
    ]);
    // On a linear axis, the same boxes from zero.
    expect(paceChart([fast], 'linear').figure?.layout.xaxis).toEqual(
      expect.objectContaining({ title: { text: 'Events per day' }, rangemode: 'tozero' })
    );
  });

  it('has no figure until a file publishes it with quantiles', () => {
    const model = paceChart([
      slow,
      entryWith('Null', 200, { perSubject: perSubject({ eventsPerDay: null }) }),
      entryWith('Suppressed', 100, { perSubject: perSubject({ eventsPerDay: SUPPRESSED }) }),
    ]);
    expect(model.figure).toBeNull();
    expect(model.logAxes).toEqual([]);
    // The files without the rate share one note; a suppressed rate is never taken for a missing one.
    expect(model.skipped).toEqual([
      {
        label: 'Slow, Null',
        reason:
          'Their stats files have no per-subject events per day (per_subject.measurements_per_day), which ' +
          'meds_summary_stats writes from version 0.0.4 on.',
      },
      {
        label: 'Suppressed',
        reason: 'Suppressed: too few subjects have a rate, so its quantiles are withheld.',
      },
    ]);
    // A rate without its quartiles or median is withheld, not missing.
    expect(
      paceChart([
        entryWith('Few', 4, { perSubject: perSubject({ eventsPerDay: { ...SUPPRESSED, extremes: true } }) }),
      ]).skipped
    ).toEqual([
      {
        label: 'Few',
        reason:
          'Withheld: its stats file leaves out the quartiles or median of the events per day, as ' +
          'meds_summary_stats does from version 0.0.4 on where they would depend on the smallest or largest value.',
      },
    ]);
  });
});

describe('codeTailPoints', () => {
  const concentration = {
    top10: 0.6,
    top100: 0.95,
    top1000: 0.999,
    codesFor50: 4,
    codesFor90: 40,
    codesFor99: 300,
  };
  const pairs = (points: { codes: number; remaining: number }[]) => points.map(p => [p.codes, p.remaining]);

  it('gives the share left outside the top N codes for each published figure, by number of codes', () => {
    const points = codeTailPoints(concentration, 2000);
    // One minus each covered share, without floating-point noise (1 - 0.95 is not exactly 0.05).
    expect(pairs(points)).toEqual([
      [4, 0.5],
      [10, 0.4],
      [40, 0.1],
      [100, 0.05],
      [300, 0.01],
      [1000, 0.001],
    ]);
    expect(points.map(p => p.text)).toEqual([
      'It takes the 4 most frequent codes to cover 50% of events, leaving 50% outside them',
      '40% of events fall outside the 10 most frequent codes',
      'It takes the 40 most frequent codes to cover 90% of events, leaving 10% outside them',
      '5% of events fall outside the 100 most frequent codes',
      'It takes the 300 most frequent codes to cover 99% of events, leaving 1% outside them',
      '0.1% of events fall outside the 1,000 most frequent codes',
    ]);
    // Points past the dataset's number of codes are dropped.
    expect(pairs(codeTailPoints(concentration, 200)).map(([codes]) => codes)).toEqual([4, 10, 40, 100]);
  });

  it('drops unknown or zero figures and points that leave nothing outside, and keeps points without a code count', () => {
    const points = codeTailPoints(
      { top10: null, top100: 1, top1000: 0.995, codesFor50: 0, codesFor90: null, codesFor99: 1000 },
      null
    );
    // At the same number of codes, the larger share left outside comes first.
    expect(pairs(points)).toEqual([
      [1000, 0.01],
      [1000, 0.005],
    ]);
  });

  it('keeps points that leave nothing outside for a linear axis, but never one beyond the number of codes', () => {
    const covering = { ...concentration, top100: 1, top1000: 1 };
    expect(pairs(codeTailPoints(covering, 500, true))).toEqual([
      [4, 0.5],
      [10, 0.4],
      [40, 0.1],
      [100, 0],
      [300, 0.01],
    ]);
    expect(codeTailPoints(covering, 500, true)[3].text).toBe(
      '0% of events fall outside the 100 most frequent codes'
    );
    expect(pairs(codeTailPoints(covering, 500)).map(([codes]) => codes)).toEqual([4, 10, 40, 300]);
    // A share above 100% is not a share.
    expect(codeTailPoints({ ...concentration, top10: 1.2 }, 2000, true).map(p => p.codes)).not.toContain(10);
  });
});

describe('seriesStyle', () => {
  it('uses the eight palette colours, then repeats them with a dashed line and square markers, then dotted', () => {
    expect(CATEGORICAL_COLORS.slice(0, 4)).toEqual([...SERIES_COLORS]);
    expect(seriesStyle(0)).toEqual({ color: CATEGORICAL_COLORS[0], dash: 'solid', symbol: 'circle' });
    expect(seriesStyle(7)).toEqual({ color: CATEGORICAL_COLORS[7], dash: 'solid', symbol: 'circle' });
    expect(seriesStyle(8)).toEqual({ color: CATEGORICAL_COLORS[0], dash: 'dash', symbol: 'square' });
    expect(seriesStyle(17)).toEqual({ color: CATEGORICAL_COLORS[1], dash: 'dot', symbol: 'diamond' });
    // Past 24 series the third tier repeats rather than inventing a style.
    expect(seriesStyle(30)).toEqual({ color: CATEGORICAL_COLORS[6], dash: 'dot', symbol: 'diamond' });
  });
});

describe('codeTailChart', () => {
  const style = (t: Record<string, unknown>) => ({
    color: (t.line as { color: string }).color,
    dash: (t.line as { dash: string }).dash,
    symbol: (t.marker as { symbol: string }).symbol,
  });

  it('draws every dataset in its own colour and style, in alphabetical identity order, on log–log axes', () => {
    const other = statsEntry('Other', { stats: etlStats(10) });
    const model = codeTailChart([small, other, big], null);
    expect(model.options).toEqual(['Big', 'Small', 'Other']);
    expect(model.highlighted).toBeNull();
    const traces = (model.figure?.data ?? []).map(attrs);
    expect(traces.map(t => t.name)).toEqual(['Big', 'Other', 'Small']);
    expect(traces.map(t => t.legendrank)).toEqual([1, 2, 3]);
    expect(traces.map(style)).toEqual([seriesStyle(0), seriesStyle(1), seriesStyle(2)]);
    expect(traces.map(t => t.opacity)).toEqual([1, 1, 1]);
    expect(traces.map(t => (t.line as { width: number }).width)).toEqual([2, 2, 2]);
    // The fixture's 50 codes: its top 100 and top 1,000 cover them all, so leave nothing outside.
    expect(traces[0]).toMatchObject({
      mode: 'lines+markers',
      x: [4, 10, 20, 45],
      y: [0.5, 0.7, 0.1, 0.01],
      text: ['Big', 'Big', 'Big', 'Big'],
    });
    expect(model.figure?.layout).toMatchObject({ showlegend: true });
    expect(model.logAxes).toEqual(['x', 'y']);
    expect(model.figure?.layout.xaxis).toMatchObject({
      type: 'log',
      ticktext: ['1', '10', '100'],
      title: { text: 'Number of most frequent codes, N (log scale)' },
      ...LOG_AXIS_TICKS,
    });
    // Down to just below the smallest share left outside, up to 100%.
    expect(model.figure?.layout.yaxis).toMatchObject({
      type: 'log',
      autorange: false,
      range: [-2.15, 0.05],
      tickvals: [0.01, 0.1, 1],
      ticktext: ['1%', '10%', '100%'],
      title: { text: 'Share outside the top N (log scale)' },
      ...LOG_AXIS_TICKS,
    });
    expect(model.table.columns).toEqual([
      'Dataset',
      'Outside the top 10 codes',
      'Outside the top 100',
      'Outside the top 1,000',
      'Codes to cover 50%',
      'Codes to cover 90%',
      'Codes to cover 99%',
      'Unique codes',
    ]);
    expect(model.table.rows[0]).toEqual(['Big', '70%', '20%', '1%', '4', '20', '45', '50']);
    expect(model.figure?.layout.height).toBe(460);
    // On a phone the legend takes a line per dataset, so the figure is taller.
    expect(codeTailChart([small, other, big], null, [], { narrow: true }).figure?.layout.height).toBe(700);
  });

  it('draws either axis linear when asked, a linear vertical axis with the points that leave nothing outside', () => {
    const model = codeTailChart([big], null, [], { scales: { x: 'linear', y: 'linear' } });
    // The fixture's points that leave nothing outside (top 100 and top 1,000) lie beyond its 50 codes: none is added.
    const [curve] = (model.figure?.data ?? []).map(attrs);
    expect(curve).toMatchObject({ x: [4, 10, 20, 45], y: [0.5, 0.7, 0.1, 0.01] });
    expect(model.figure?.layout.xaxis).toEqual({
      ...baseLayout(0).xaxis,
      type: 'linear',
      rangemode: 'tozero',
      tickvals: [0, 10, 20, 30, 40, 50],
      ticktext: ['0', '10', '20', '30', '40', '50'],
      title: { text: 'Number of most frequent codes, N' },
    });
    expect(model.figure?.layout.yaxis).toMatchObject({
      type: 'linear',
      autorange: false,
      range: [-0.03, 1.03],
      tickvals: [0, 0.25, 0.5, 0.75, 1],
      ticktext: ['0%', '25%', '50%', '75%', '100%'],
      title: { text: 'Share outside the top N' },
    });
    expect(model.figure?.layout.yaxis).not.toHaveProperty('minor');
    expect(model.logAxes).toEqual(['x', 'y']);

    // A dataset whose top 10 codes are all its codes: no point on a log axis, a point at 0% on a linear one.
    const unknown = {
      top10: null,
      top100: null,
      top1000: null,
      codesFor50: null,
      codesFor90: null,
      codesFor99: null,
    };
    const covered = entryWith('Covered', 20, {
      counts: counts(20, { uniqueCodes: 10 }),
      concentration: { ...unknown, top10: 1 },
    });
    expect(codeTailChart([covered], null).figure).toBeNull();
    const linear = codeTailChart([covered], null, [], { scales: { y: 'linear' } });
    expect(attrs(linear.figure?.data[0])).toMatchObject({ x: [10], y: [0] });
    expect(linear.figure?.layout.xaxis).toMatchObject({ type: 'log' });
    expect(linear.skipped).toEqual([]);
  });

  it("keeps each dataset's style when others are filtered out", () => {
    // "Alpha" is filtered out of this view but still holds the first style, so "Big" keeps the second.
    const traces = (codeTailChart([small, big], null, ['Alpha', 'Big', 'Small']).figure?.data ?? []).map(
      attrs
    );
    expect(traces.map(t => t.name)).toEqual(['Big', 'Small']);
    expect(traces.map(style)).toEqual([seriesStyle(1), seriesStyle(2)]);
  });

  it('highlights the chosen dataset on top, fading the others, and ignores a dataset that is not drawn', () => {
    const model = codeTailChart([big, small], 'Big');
    expect(model.highlighted).toBe('Big');
    const traces = (model.figure?.data ?? []).map(attrs);
    // Drawn last so it sits on top, while the legend keeps its alphabetical order.
    expect(traces.map(t => t.name)).toEqual(['Small', 'Big']);
    expect(traces.map(t => t.legendrank)).toEqual([2, 1]);
    expect(traces.map(t => t.opacity)).toEqual([0.25, 1]);
    expect(traces.map(t => (t.line as { width: number }).width)).toEqual([2, 3.5]);
    expect(traces.map(t => (t.marker as { size: number }).size)).toEqual([8, 10]);
    expect(codeTailChart([big, small], 'Gone').highlighted).toBeNull();
  });

  it('skips datasets without concentration figures, or whose figures leave nothing outside', () => {
    const noCount = entryWith('No count', 50, { counts: counts(50, { uniqueCodes: null }) });
    const none = entryWith('None', 40, { concentration: null });
    const unknown = {
      top10: null,
      top100: null,
      top1000: null,
      codesFor50: null,
      codesFor90: null,
      codesFor99: null,
    };
    const empty = entryWith('Empty', 30, { concentration: unknown });
    const covered = entryWith('Covered', 20, { concentration: { ...unknown, top10: 1 } });
    const model = codeTailChart([noCount, none, empty, covered], null);
    // Without a code count, no point can be ruled out as past the dataset's codes.
    expect(attrs(model.figure?.data[0])).toMatchObject({
      x: [4, 10, 20, 45, 100, 1000],
      y: [0.5, 0.7, 0.1, 0.01, 0.2, 0.01],
    });
    expect(model.table.rows).toEqual([['No count', '70%', '20%', '1%', '4', '20', '45', '—']]);
    expect(model.skipped).toEqual([
      { label: 'None', reason: 'Its stats file has no code-concentration figures.' },
      { label: 'Empty', reason: 'Its stats file has no code-concentration figures.' },
      {
        label: 'Covered',
        reason: 'Its most frequent codes leave no events outside them, which a logarithmic axis cannot show.',
      },
    ]);
    expect(codeTailChart([empty], null)).toMatchObject({
      figure: null,
      logAxes: [],
      options: [],
      highlighted: null,
    });
    // Figures that all lie beyond the dataset's number of codes give no point on either scale.
    const beyond = entryWith('Beyond', 20, {
      counts: counts(20, { uniqueCodes: 5 }),
      concentration: { ...unknown, top10: 0.9, top100: 1 },
    });
    expect(codeTailChart([beyond], null, [], { scales: { y: 'linear' } }).skipped).toEqual([
      { label: 'Beyond', reason: 'None of its code-concentration figures lies within its number of codes.' },
    ]);
    // A missing share shows as a dash in the table.
    const partial = entryWith('Partial', 20, {
      concentration: {
        ...(etlStats(1).concentration as NonNullable<EtlStats['concentration']>),
        top10: null,
      },
    });
    expect(codeTailChart([partial], null).table.rows[0][1]).toBe('—');
  });
});

describe('vocabularyChart', () => {
  const ontology = (
    vocabularies: { name: string; events: number | null; recognized: boolean | null }[],
    suppressed: { cells: number | null; events: number | null } | null = null
  ): EtlStats['ontology'] => ({ eventsMapped: 0.5, codesWithParents: 0.5, vocabularies, suppressed });
  const LEAD = ['Any vocabulary', 'Codes with a parent'];
  const layoutOf = (model: { figure: { layout: unknown } | null }) =>
    model.figure?.layout as Record<string, unknown> & { margin: { r: number } };

  it('shows every dataset: mapping shares first, then each vocabulary, shaded on a log scale', () => {
    // Big has 500,000 events; Small 10,000; Other 1,000.
    const bigVocab = entryWith('Big', 5000, {
      ontology: ontology(
        [
          { name: 'ICD10CM', events: 1000, recognized: true },
          { name: 'LOCAL', events: 10, recognized: false },
          { name: 'LOINC', events: 250_000, recognized: true },
          { name: 'MAYBE', events: null, recognized: null },
        ],
        { cells: 2, events: 40 }
      ),
    });
    const smallVocab = entryWith('Small', 100, {
      ontology: ontology([{ name: 'ICD10CM', events: 500, recognized: null }], {
        cells: 1,
        events: 3,
      }),
    });
    const otherVocab = entryWith('Other', 10, {
      ontology: ontology(
        [
          { name: 'ICD10CM', events: 100, recognized: true },
          { name: 'LOINC', events: 1000, recognized: true },
        ],
        { cells: null, events: 9 }
      ),
    });
    const unmapped = entryWith('Unmapped', 50, { ontology: null });
    const model = vocabularyChart([smallVocab, otherVocab, unmapped, bigVocab, unreadable]);
    const [grid, heatmap] = (model.figure?.data ?? []).map(attrs);
    // The mapping columns, an empty column as a gap, then the vocabularies, most widely used first.
    // ICD10CM is in the ICD column.
    const x = [...LEAD, ' ', 'ICD', 'LOINC', 'LOCAL', 'MAYBE'];
    expect(heatmap.x).toEqual(x);
    expect(heatmap.y).toEqual(['Big', 'Small', 'Unmapped', 'Other']);
    // A faint grid under every cell but the gap, without hover.
    expect(grid).toMatchObject({ x, hoverinfo: 'skip', z: Array(4).fill([0, 0, null, 0, 0, 0, 0]) });
    expect(model.figure?.layout.xaxis).toMatchObject({
      tickvals: [...LEAD, 'ICD', 'LOINC', 'LOCAL', 'MAYBE'],
      ticktext: ['<b>Any vocabulary</b>', '<b>Codes with a parent</b>', 'ICD', 'LOINC*', 'LOCAL', 'MAYBE'],
    });
    // log10 of the share, floored at 0.01%; a vocabulary a dataset doesn't use has no cell. A dataset without a
    // mapping maps nothing.
    const half = Math.log10(0.5);
    expect(heatmap.z).toEqual([
      [half, half, null, Math.log10(0.002), half, -4, null],
      [half, half, null, Math.log10(0.05), null, null, null],
      [-4, -4, null, null, null, null, null],
      [half, half, null, Math.log10(0.1), 0, null, null],
    ]);
    expect(heatmap.text).toEqual([
      ['50%', '50%', '', '0.2%', '50%', '<0.1%', 'n/a'],
      ['50%', '50%', '', '5.0%', '', '', ''],
      ['0%', '0%', '', '', '', '', ''],
      ['50%', '50%', '', '10%', '100%', '', ''],
    ]);
    expect((heatmap.customdata as string[][])[0]).toEqual([
      'Any vocabulary: 50% of events map to a vocabulary',
      'Codes with a parent: 50% of the distinct codes have a parent code',
      '',
      'ICD (ICD10CM): 0.2% of events',
      'LOINC (a standard OMOP vocabulary): 50% of events',
      'LOCAL: <0.1% of events',
      'MAYBE: n/a of events',
    ]);
    // The dataset without a mapping says so where its vocabulary cells would be.
    expect(model.figure?.layout.annotations).toEqual([
      expect.objectContaining({
        xref: 'paper',
        x: 3 / 7,
        xanchor: 'left',
        yref: 'y',
        y: 'Unmapped',
        text: '<i>No vocabulary mapping</i>',
      }),
    ]);
    // The longest column label, "Codes with a parent", sets the top margin; the vocabulary columns hold the note.
    // The last label, "MAYBE", reaches 0.72 of its 5 characters of 7px past the centre of its 44px column.
    expect(model.figure?.layout.margin).toEqual({ l: 4, r: 8 + Math.ceil(5 * 7 * 0.72) - 22, t: 112, b: 8 });
    expect(model.minWidth).toBe(4 + 7 * 44 + 12);
    // The datasets' names are set beside the heatmap, row by row, not in it.
    expect(model.figure?.layout.yaxis).toMatchObject({ showticklabels: false });
    expect(model.rowLabels).toEqual({
      labels: ['Big', 'Small', 'Unmapped', 'Other'],
      top: 112,
      rowHeight: 34,
      width: 8 * 7 + 8,
    });
    expect(model.anyRecognized).toBe(true);
    expect(model).toMatchObject({ icdVocabularies: ['ICD10CM'], icdRanges: [], icdWithSuppressed: true });
    expect(model.skipped).toEqual([
      { label: 'Future', reason: unreadable.problem },
      {
        label: 'Big',
        reason:
          '2 more vocabularies are suppressed, as each is reached by fewer than 20 subjects, so they have no column.',
      },
      {
        label: 'Small',
        reason:
          '1 more vocabulary is suppressed, as each is reached by fewer than 20 subjects, so they have no column.',
      },
      {
        label: 'Other',
        reason:
          'Some vocabularies are suppressed, as each is reached by fewer than 20 subjects, so they have no column.',
      },
    ]);
  });

  it('marks rows without vocabulary cells, and notes what a file lacks', () => {
    const local = (events: number) => ontology([{ name: 'LOCAL', events, recognized: false }]);
    const model = vocabularyChart([
      entryWith('Local', 900, { ontology: local(5) }),
      entryWith('No metadata', 800, { codeMetadata: null, ontology: null }),
      entryWith('Uncounted', 700, { counts: counts(700, { events: null }), ontology: local(7) }),
      entryWith('Empty data', 600, { counts: counts(600, { events: 0 }), ontology: local(0) }),
      entryWith('Nameless', 500, { ontology: ontology([]) }),
      entryWith('All suppressed', 400, { ontology: ontology([], { cells: 3, events: 7 }) }),
      entryWith('Uncounted rollup', 300, { ontology: ontology([], { cells: null, events: null }) }),
      entryWith('Unstated', 200, {
        ontology: {
          eventsMapped: null,
          codesWithParents: 0.5,
          vocabularies: [],
          suppressed: { cells: 1, events: 1 },
        },
      }),
    ]);
    const heatmap = attrs(model.figure?.data[1]);
    expect(heatmap.y).toEqual([
      'Local',
      'Uncounted',
      'Empty data',
      'Nameless',
      'All suppressed',
      'Uncounted rollup',
      'Unstated',
    ]);
    // Without an event count, a vocabulary's share is unknown; so is a mapping share the file doesn't state.
    expect((heatmap.text as string[][]).map(row => row.join(' | '))).toEqual([
      '50% | 50% |  | <0.1%',
      '50% | 50% |  | n/a',
      '50% | 50% |  | n/a',
      '50% | 50% |  | ',
      '50% | 50% |  | ',
      '50% | 50% |  | ',
      'n/a | 50% |  | ',
    ]);
    expect(
      (model.figure?.layout.annotations as { y: string; text: string }[]).map(a => [a.y, a.text])
    ).toEqual([
      ['Nameless', '<i>No named vocabulary</i>'],
      ['All suppressed', '<i>Vocabularies suppressed</i>'],
      ['Uncounted rollup', '<i>Vocabularies suppressed</i>'],
      ['Unstated', '<i>Vocabularies suppressed</i>'],
    ]);
    // One vocabulary column is too narrow for the longest note, so the plot gets room on its right.
    expect(layoutOf(model).margin.r).toBe(8 + 23 * 7 + 12 - 44);
    expect(model.anyRecognized).toBe(false);
    expect(model.skipped).toEqual([
      { label: 'No metadata', reason: 'Its stats file does not report on its code metadata.' },
      {
        label: 'Uncounted',
        reason: 'Its stats file has no event count, so its vocabulary shares are unknown.',
      },
      {
        label: 'Empty data',
        reason: 'Its stats file has no event count, so its vocabulary shares are unknown.',
      },
      { label: 'Nameless', reason: 'Its code metadata names no vocabulary.' },
      {
        label: 'All suppressed',
        reason: 'Suppressed: all 3 vocabularies are reached by fewer than 20 subjects each.',
      },
      {
        label: 'Uncounted rollup',
        reason: 'Suppressed: all its vocabularies are reached by fewer than 20 subjects each.',
      },
      {
        label: 'Unstated',
        reason: 'Suppressed: its only vocabulary is reached by fewer than 20 subjects.',
      },
    ]);
  });

  it('has no gap without vocabulary columns, and no figure without a readable dataset', () => {
    const model = vocabularyChart([entryWith('Unmapped', 50, { ontology: null })]);
    expect(attrs(model.figure?.data[0])).toMatchObject({ x: LEAD, z: [[0, 0]] });
    // The note starts right of the plot, which makes room for it.
    expect(model.figure?.layout.annotations).toEqual([expect.objectContaining({ x: 1 })]);
    expect(layoutOf(model).margin.r).toBe(8 + 21 * 7 + 12);
    // Without any note, the plot needs room only for its last label, "LOINC*".
    expect(layoutOf(vocabularyChart([big])).margin.r).toBe(8 + Math.ceil(6 * 7 * 0.72) - 22);
    expect(vocabularyChart([])).toEqual({
      figure: null,
      skipped: [],
      minWidth: 0,
      rowLabels: { labels: [], top: 0, rowHeight: 34, width: 0 },
      anyRecognized: false,
      icdVocabularies: [],
      icdRanges: [],
      icdWithSuppressed: false,
    });
  });

  it('groups the ICD vocabularies into one column, exact where the file allows and a range where it bounds', () => {
    // Each dataset has 100,000 events (1,000 subjects).
    const icd = (name: string, events: number | null) => ({ name, events, recognized: true });
    const mapping = (
      vocabularies: { name: string; events: number | null; recognized: boolean | null }[],
      extra: Partial<NonNullable<EtlStats['ontology']>>
    ) => ({ ...(ontology(vocabularies) as NonNullable<EtlStats['ontology']>), ...extra });
    const model = vocabularyChart([
      // No code has parents in two vocabularies: the sum of the ICD shares.
      entryWith('Disjoint', 1000, {
        ontology: mapping([icd('ICD10CM', 200), icd('ICD9CM', 300), icd('LOINC', 5000)], {
          codesInMultipleVocabularies: 0,
        }),
      }),
      // Codes map into both ICD vocabularies; everything mapped is ICD, so the bounds meet at 210 of 99,900.
      entryWith('Overlap', 999, {
        ontology: mapping([icd('ICD10CM', 200), icd('ICD9CM', 180)], {
          codesInMultipleVocabularies: 150,
          mappedEvents: 210,
          noVocabularyEvents: 0,
        }),
      }),
      // Only bounded: at least 1,880 mapped - 90 in other vocabularies = 1,790 of 99,800, at most 1,880.
      entryWith('Bounded', 998, {
        ontology: mapping([icd('ICD10CM', 1600), icd('ICD9CM', 300), icd('PMH', 50), icd('ED', 40)], {
          codesInMultipleVocabularies: 90,
          mappedEvents: 1880,
          noVocabularyEvents: 0,
        }),
      }),
      entryWith('Unknown', 997, { ontology: mapping([icd('ICD10GM', null)], {}) }),
      entryWith('No ICD', 996, { ontology: mapping([icd('LOINC', 100)], {}) }),
    ]);
    const heatmap = attrs(model.figure?.data[1]);
    // ICD is used by the most datasets, so it comes first; it is never marked as one OMOP vocabulary.
    expect((heatmap.x as string[]).slice(3)).toEqual([ICD_GROUP, 'LOINC', 'ED', 'PMH']);
    expect((model.figure?.layout.xaxis as { ticktext: string[] }).ticktext.slice(2)).toEqual([
      'ICD',
      'LOINC*',
      'ED*',
      'PMH*',
    ]);
    const icdColumn = (rows: unknown) => (rows as unknown[][]).map(row => row[3]);
    // A range takes two lines.
    expect(icdColumn(heatmap.text)).toEqual(['0.5%', '0.2%', '1.8–<br>1.9%', 'n/a', '']);
    // Shaded by the lower bound.
    expect(icdColumn(heatmap.z)).toEqual([
      Math.log10(500 / 100_000),
      Math.log10(210 / 99_900),
      Math.log10(1790 / 99_800),
      null,
      null,
    ]);
    expect(icdColumn(heatmap.customdata)).toEqual([
      'ICD (ICD10CM, ICD9CM): 0.5% of events<br>Each on its own: ICD10CM 0.2%, ICD9CM 0.3%',
      'ICD (ICD10CM, ICD9CM): 0.2% of events<br>Each on its own: ICD10CM 0.2%, ICD9CM 0.2%',
      'ICD (ICD10CM, ICD9CM): 1.8–1.9% of events<br>Each on its own: ICD10CM 1.6%, ICD9CM 0.3%' +
        '<br>The stats file only bounds this share',
      'ICD (ICD10GM): n/a of events',
      '',
    ]);
    expect(model).toMatchObject({
      icdVocabularies: ['ICD10CM', 'ICD10GM', 'ICD9CM'],
      icdRanges: ['Bounded'],
      icdWithSuppressed: false,
    });
    expect(model.minWidth).toBe(4 + 7 * 44 + 8);
    // Columns are wide enough for the longest line of a range.
    const tiny = entryWith('Tiny', 1000, {
      ontology: mapping([icd('ICD10CM', 40), icd('ICD9CM', 30), icd('LOINC', 1000)], {
        codesInMultipleVocabularies: 1,
      }),
    });
    const tinyModel = vocabularyChart([tiny]);
    expect(icdColumn(attrs(tinyModel.figure?.data[1]).text)).toEqual(['<0.1%–<br>0.1%']);
    const tinyColumn = Math.ceil(6 * 6.5 + 10);
    expect(tinyModel.minWidth).toBe(4 + 5 * tinyColumn + 8 + Math.ceil(6 * 7 * 0.72) - tinyColumn / 2);
    expect(isIcdVocabulary('icd10')).toBe(true);
    expect(isIcdVocabulary('NDC')).toBe(false);
  });
});

describe('groupShare', () => {
  const vocabulary = (name: string, events: number | null) => ({ name, events, recognized: null });
  const ontologyOf = (
    vocabularies: ReturnType<typeof vocabulary>[],
    extra: Partial<NonNullable<EtlStats['ontology']>> = {}
  ): NonNullable<EtlStats['ontology']> => ({
    eventsMapped: null,
    codesWithParents: null,
    vocabularies,
    suppressed: null,
    ...extra,
  });
  const a = vocabulary('ICD10CM', 145);
  const b = vocabulary('ICD9CM', 21);
  const others = [vocabulary('ED', 10), vocabulary('PMH', 5)];

  it('sums disjoint counts, and bounds overlapping ones by the largest, the sum and what is mapped', () => {
    expect(groupShare(ontologyOf([a, b], { codesInMultipleVocabularies: 0 }), [a, b], 1000)).toEqual({
      low: 0.166,
      high: 0.166,
    });
    // At least 170 - 15 = 155, at most the sum, 166.
    const overlapping = ontologyOf([a, b, ...others], {
      codesInMultipleVocabularies: 3,
      mappedEvents: 170,
      noVocabularyEvents: 0,
      suppressed: { cells: 1, events: 0 },
    });
    expect(groupShare(overlapping, [a, b], 1000)).toEqual({ low: 0.155, high: 0.166 });
    // An unknown count of another vocabulary, or of the suppressed or vocabulary-less events, leaves the largest.
    for (const extra of [
      { noVocabularyEvents: null },
      { noVocabularyEvents: undefined },
      { suppressed: { cells: 1, events: null } },
    ]) {
      expect(groupShare({ ...overlapping, ...extra }, [a, b], 1000)).toEqual({ low: 0.145, high: 0.166 });
    }
    // Without the events mapped to any vocabulary: the largest and the sum.
    expect(groupShare(ontologyOf([a, b]), [a, b], 1000)).toEqual({ low: 0.145, high: 0.166 });
    // A single vocabulary's share is exact.
    expect(groupShare(ontologyOf([a, ...others], { mappedEvents: 160 }), [a], 1000)).toEqual({
      low: 0.145,
      high: 0.145,
    });
  });

  it('never lets the lower bound pass the upper one, and is unknown without the counts', () => {
    // A file whose counts contradict each other: everything mapped is ICD10CM, yet it has fewer events.
    expect(groupShare(ontologyOf([a], { mappedEvents: 1000, noVocabularyEvents: 0 }), [a], 2000)).toEqual({
      low: 0.0725,
      high: 0.0725,
    });
    expect(groupShare(ontologyOf([a]), [a], null)).toBeNull();
    expect(groupShare(ontologyOf([a]), [a], 0)).toBeNull();
    expect(groupShare(ontologyOf([vocabulary('ICD9CM', null)]), [vocabulary('ICD9CM', null)], 10)).toBeNull();
    expect(groupShare(ontologyOf([]), [], 10)).toBeNull();
  });

  it('prints one value where the bounds round alike, and a range otherwise', () => {
    expect(formatShareBounds({ low: 0.016389, high: 0.01659 })).toBe('1.6–1.7%');
    expect(formatShareBounds({ low: 0.0161, high: 0.0164 })).toBe('1.6%');
    expect(formatShareBounds({ low: 0.0002, high: 0.002 })).toBe('<0.1%–0.2%');
  });
});

describe('healthCheck', () => {
  const cells = (entries: EtlStatsEntry[]) =>
    Object.fromEntries(healthCheck(entries).rows.map(row => [row.label, row.cells]));
  const checks = (overrides: Partial<EtlStats['checks']>): EtlStats['checks'] => ({
    ...etlStats(1).checks,
    ...overrides,
  });
  const codeMetadata = (overrides: Partial<NonNullable<EtlStats['codeMetadata']>>) => ({
    ...(etlStats(1).codeMetadata as NonNullable<EtlStats['codeMetadata']>),
    ...overrides,
  });

  it('passes a dataset that meets every invariant, and states its versions', () => {
    expect(cells([big]).Big).toEqual({
      ids: { status: 'pass', text: 'None' },
      missingCodes: { status: 'pass', text: 'None' },
      numeric: { status: 'pass', text: 'None' },
      descriptions: { status: 'pass', text: '100%' },
      unusedCodes: { status: 'info', text: 'None' },
      versions: { status: 'info', text: 'MEDS 0.4.0\netl 0.1' },
    });
  });

  it('flags each broken invariant with what is wrong', () => {
    const broken = entryWith('Broken', 10, {
      checks: { emptyCodes: 1, nullCodes: 2, nullSubjectIds: 3, nanValues: 4, infiniteValues: 1 },
      codeMetadata: codeMetadata({
        codes: 200,
        withDescription: 179,
        dataCodesMissing: 2,
        metadataCodesUnused: 1,
      }),
    });
    const row = cells([broken]).Broken;
    expect(row.ids).toEqual({ status: 'warn', text: '1 empty code, 2 null codes, 3 null subject IDs' });
    expect(row.numeric).toEqual({ status: 'warn', text: '4 NaN, 1 infinite' });
    // A share of the 50 distinct codes in the data.
    expect(row.missingCodes).toEqual({ status: 'warn', text: '4.0%' });
    expect(row.descriptions).toEqual({ status: 'warn', text: '89.5%' });
    expect(row.unusedCodes).toEqual({ status: 'info', text: '1 code' });
    const one = entryWith('One', 10, {
      codeMetadata: codeMetadata({
        codes: 10,
        withDescription: 9,
        dataCodesMissing: 1,
        metadataCodesUnused: 3,
      }),
    });
    expect(cells([one]).One).toMatchObject({
      missingCodes: { status: 'warn', text: '2.0%' },
      descriptions: { status: 'pass', text: '90.0%' },
      unusedCodes: { status: 'info', text: '3 codes' },
    });
  });

  it('shows the missing codes as a number of codes when asked, or when the share is unknown', () => {
    // Fewer subjects each, so the rows keep this order.
    const missing = (subjects: number, dataCodesMissing: number, uniqueCodes: number | null) =>
      entryWith(`${dataCodesMissing} of ${uniqueCodes}`, subjects, {
        counts: counts(subjects, { uniqueCodes }),
        codeMetadata: codeMetadata({ dataCodesMissing }),
      });
    const entries = [
      missing(50, 2, 50),
      missing(40, 1, 1),
      missing(30, 1, 10_000),
      missing(20, 3, null),
      missing(10, 0, 5),
    ];
    const texts = (model: ReturnType<typeof healthCheck>) =>
      model.rows.map(row => row.cells.missingCodes.text);
    expect(texts(healthCheck(entries))).toEqual(['4.0%', '100%', '<0.1%', '3 codes', 'None']);
    expect(texts(healthCheck(entries, { missingCodes: 'count' }))).toEqual([
      '2 codes',
      '1 code',
      '1 code',
      '3 codes',
      'None',
    ]);
    expect(healthCheck(entries).anyMissingCodes).toBe(true);
    expect(healthCheck([big, unreadable]).anyMissingCodes).toBe(false);
    expect(MISSING_CODES_VIEWS.map(view => view.key)).toEqual(['share', 'count']);
  });

  it('says what a file does not report, or that the dataset has no codes.parquet', () => {
    const noFile = entryWith(
      'No file',
      40,
      { codeMetadata: codeMetadata({ present: false, codes: null }) },
      { dataset: null }
    );
    const unreported = entryWith('Unreported', 30, {
      checks: {
        emptyCodes: null,
        nullCodes: null,
        nullSubjectIds: null,
        nanValues: null,
        infiniteValues: null,
      },
      codeMetadata: null,
    });
    const partial = entryWith(
      'Partial',
      20,
      {
        checks: checks({ nullCodes: null, infiniteValues: null }),
        codeMetadata: codeMetadata({
          withDescription: null,
          dataCodesMissing: null,
          metadataCodesUnused: null,
        }),
      },
      { dataset: { name: 'P', version: null, etlName: 'etl', etlVersion: null, medsVersion: null } }
    );
    const noCodes = entryWith('No codes', 10, { codeMetadata: codeMetadata({ codes: null }) });
    const rows = cells([noFile, unreported, partial, noCodes]);
    const notReported = { status: 'unknown', text: 'Not reported' };
    expect(rows['No file']).toMatchObject({
      missingCodes: { status: 'warn', text: 'No codes.parquet' },
      descriptions: { status: 'unknown', text: 'No codes.parquet' },
      unusedCodes: { status: 'unknown', text: 'No codes.parquet' },
      versions: { status: 'unknown', text: 'Not stated' },
    });
    expect(rows.Unreported).toMatchObject({
      ids: notReported,
      numeric: notReported,
      missingCodes: notReported,
      descriptions: notReported,
      unusedCodes: notReported,
    });
    expect(rows.Partial).toMatchObject({
      ids: notReported,
      numeric: notReported,
      missingCodes: notReported,
      descriptions: notReported,
      unusedCodes: notReported,
      versions: { status: 'info', text: 'MEDS version not stated\netl' },
    });
    expect(rows['No codes'].descriptions).toEqual(notReported);
    const medsOnly = entryWith(
      'MEDS only',
      5,
      {},
      {
        dataset: { name: 'M', version: null, etlName: null, etlVersion: null, medsVersion: '0.4.1' },
      }
    );
    expect(cells([medsOnly])['MEDS only'].versions).toEqual({
      status: 'info',
      text: 'MEDS 0.4.1\nETL not stated',
    });
    expect(healthCheck([unreadable])).toEqual({
      rows: [],
      skipped: [{ label: 'Future', reason: unreadable.problem }],
      anyMissingCodes: false,
    });
  });

  it('explains every check, including the description threshold', () => {
    expect(HEALTH_CHECKS.map(check => check.key)).toEqual([
      'ids',
      'missingCodes',
      'numeric',
      'descriptions',
      'unusedCodes',
      'versions',
    ]);
    const descriptions = HEALTH_CHECKS.find(check => check.key === 'descriptions')?.help;
    expect(descriptions).toMatch(/passes at 90% or more/);
    // meds_summary_stats 0.0.4 stopped counting blank descriptions.
    expect(descriptions).toMatch(
      /schema version 2 count only descriptions with text in them; those of version 1 also count empty or whitespace-only ones\./
    );
  });
});
