import { describe, expect, it } from '@jest/globals';
import {
  baseLayout,
  codeCoverageChart,
  codeCoveragePoints,
  CONTEXT_GREY,
  coverageChart,
  datasetName,
  defaultDirection,
  depthBreadthChart,
  formatCompact,
  formatCount,
  formatDate,
  formatPercent,
  formatPercentDown,
  formatRatio,
  githubRepoUrl,
  HEALTH_CHECKS,
  healthCheck,
  logTicks,
  ontologyChart,
  orderDatasets,
  paceChart,
  partition,
  perSubjectChart,
  placeLabels,
  ratio,
  schemaDescription,
  SERIES_COLORS,
  SIZE_SORT_OPTIONS,
  sizeChart,
  sortBySize,
  sortDirectionOptions,
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
  schemaVersion: 2,
  stats: null,
  problem: 'Its stats schema version is 2, which this page cannot read yet (it reads version 1).',
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

  it('uses a log axis only for positive values', () => {
    expect(valueAxis([10, 1000], 'Count')).toMatchObject({
      type: 'log',
      title: { text: 'Count (log scale)' },
    });
    expect(valueAxis([0, 1000], 'Count')).toEqual({ title: { text: 'Count' }, rangemode: 'tozero' });
    expect(valueAxis([], 'Count')).toEqual({ title: { text: 'Count' }, rangemode: 'tozero' });
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
    expect(schemaDescription(big)).toBe('1 (tool 0.0.3)');
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
    expect(layout.yaxis).toMatchObject({ autorange: true, automargin: true });
    expect(baseLayout(0).height).toBe(34 + 8 + 40);
  });
});

describe('size ordering', () => {
  const withCodes = (label: string, subjects: number, uniqueCodes: number) =>
    statsEntry(label, {
      stats: etlStats(subjects, { counts: { ...etlStats(subjects).counts, uniqueCodes } }),
    });
  const alpha = withCodes('Alpha', 300, 900);
  const beta = withCodes('Beta', 300, 20);
  const gamma = withCodes('Gamma', 5000, 400);
  const noCodes = statsEntry('No codes', {
    stats: etlStats(9000, { counts: { ...etlStats(9000).counts, uniqueCodes: null } }),
  });
  const labels = (items: EtlStatsEntry[]) => items.map(item => item.label);

  it('sorts by a count either way, breaking ties by name and putting missing counts last', () => {
    expect(
      labels(sortBySize([beta, noCodes, alpha, gamma], { key: 'measurements', direction: 'desc' }))
    ).toEqual(['No codes', 'Gamma', 'Alpha', 'Beta']);
    expect(
      labels(sortBySize([beta, noCodes, alpha, gamma], { key: 'uniqueCodes', direction: 'desc' }))
    ).toEqual(['Alpha', 'Gamma', 'Beta', 'No codes']);
    expect(
      labels(sortBySize([beta, noCodes, alpha, gamma], { key: 'uniqueCodes', direction: 'asc' }))
    ).toEqual(['Beta', 'Gamma', 'Alpha', 'No codes']);
    // Two datasets missing the count stay in name order at the end.
    const alsoNoCodes = statsEntry('Also no codes', {
      stats: etlStats(10, { counts: { ...etlStats(10).counts, uniqueCodes: null } }),
    });
    expect(
      labels(sortBySize([noCodes, beta, alsoNoCodes], { key: 'uniqueCodes', direction: 'asc' }))
    ).toEqual(['Beta', 'Also no codes', 'No codes']);
  });

  it('puts datasets whose file could not be read last, whatever the input order', () => {
    for (const items of [
      [unreadable, beta, alpha],
      [alpha, beta, unreadable],
    ]) {
      expect(labels(sortBySize(items, { key: 'subjects', direction: 'asc' }))).toEqual([
        'Alpha',
        'Beta',
        'Future',
      ]);
    }
  });

  it('sorts by name A–Z or Z–A', () => {
    expect(labels(sortBySize([gamma, alpha, beta], { key: 'name', direction: 'asc' }))).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
    expect(labels(sortBySize([gamma, alpha, beta], { key: 'name', direction: 'desc' }))).toEqual([
      'Gamma',
      'Beta',
      'Alpha',
    ]);
  });

  it('labels the directions for the sort key and starts counts largest first, names A–Z', () => {
    expect(sortDirectionOptions('events').map(o => o.label)).toEqual(['Largest first', 'Smallest first']);
    expect(sortDirectionOptions('name').map(o => o.label)).toEqual(['A–Z', 'Z–A']);
    expect(defaultDirection('subjects')).toBe('desc');
    expect(defaultDirection('name')).toBe('asc');
    expect(SIZE_SORT_OPTIONS.map(o => o.key)).toEqual([
      'measurements',
      'events',
      'uniqueCodes',
      'subjects',
      'name',
    ]);
  });
});

describe('sizeChart', () => {
  it('draws events, measurements and unique codes as grouped bars on one log axis, in the chosen order', () => {
    const model = sizeChart([small, big, unreadable], { key: 'measurements', direction: 'desc' });
    const traces = (model.figure?.data ?? []).map(attrs);
    expect(traces.map(t => t.name)).toEqual(['Events', 'Measurements', 'Unique codes']);
    expect(traces.map(t => t.y)).toEqual([
      ['Big', 'Small'],
      ['Big', 'Small'],
      ['Big', 'Small'],
    ]);
    expect(traces.map(t => t.x)).toEqual([
      [50000, 1000],
      [500000, 10000],
      [50, 50],
    ]);
    expect(traces[0].text).toEqual(['50K', '1K']);
    expect(traces[1].customdata).toEqual(['500,000', '10,000']);
    expect(traces.map(t => (t.marker as { color: string }).color)).toEqual([
      SERIES_COLORS[0],
      SERIES_COLORS[1],
      SERIES_COLORS[2],
    ]);
    expect(model.figure?.layout).toMatchObject({ barmode: 'group', showlegend: true });
    expect(model.figure?.layout.xaxis).toMatchObject({ type: 'log', title: { text: 'Count (log scale)' } });
    expect(model.skipped).toEqual([{ label: 'Future', reason: unreadable.problem }]);
    expect(model.table.columns).toEqual(['Dataset', 'Subjects', 'Events', 'Measurements', 'Unique codes']);
    expect(model.table.rows).toEqual([
      ['Big', '5,000', '50,000', '500,000', '50'],
      ['Small', '100', '1,000', '10,000', '50'],
    ]);

    // The table follows the chart's order.
    const ascending = sizeChart([small, big], { key: 'events', direction: 'asc' });
    expect(attrs(ascending.figure?.data[0]).y).toEqual(['Small', 'Big']);
    expect(ascending.table.rows.map(([label]) => label)).toEqual(['Small', 'Big']);
  });

  it('keeps a dataset with some counts, noting the missing bars, and leaves out one with none', () => {
    const noEvents = statsEntry('No events', {
      stats: etlStats(300, { counts: { ...etlStats(300).counts, events: null, uniqueCodes: null } }),
    });
    const noCounts = statsEntry('No counts', {
      stats: etlStats(300, {
        counts: { ...etlStats(300).counts, events: null, measurements: null, uniqueCodes: null },
      }),
    });
    const model = sizeChart([noEvents, noCounts, small], { key: 'events', direction: 'desc' });
    const [events, measurements] = (model.figure?.data ?? []).map(attrs);
    expect(events.y).toEqual(['Small', 'No events']);
    expect(events.x).toEqual([1000, null]);
    expect(events.text).toEqual(['1K', '']);
    expect(events.customdata).toEqual(['1,000', '—']);
    expect(measurements.x).toEqual([10000, 30000]);
    expect(model.skipped).toEqual([
      { label: 'No counts', reason: 'Its stats file has no event, measurement or unique-code counts.' },
      {
        label: 'No events',
        reason: 'Its stats file has no events or unique codes count, so that bar is missing.',
      },
    ]);
    expect(model.table.rows).toEqual([
      ['Small', '100', '1,000', '10,000', '50'],
      ['No counts', '300', '—', '—', '—'],
      ['No events', '300', '—', '30,000', '—'],
    ]);
  });

  it('has no figure when nothing can be drawn', () => {
    expect(sizeChart([unreadable], { key: 'subjects', direction: 'desc' })).toEqual({
      figure: null,
      skipped: [{ label: 'Future', reason: unreadable.problem }],
      table: { columns: ['Dataset', 'Subjects', 'Events', 'Measurements', 'Unique codes'], rows: [] },
    });
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
    expect(model.table.rows[0]).toEqual(['Big', '100', '30', '60', '90', '120', '150']);
  });

  it('has no figure when every distribution is suppressed', () => {
    const tiny = statsEntry('Tiny', {
      stats: etlStats(5, { perSubject: { ...etlStats(5).perSubject, events: { suppressed: true, n: 5 } } }),
    });
    expect(perSubjectChart([tiny], 'events').figure).toBeNull();
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
          measurements: null,
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

describe('ontologyChart', () => {
  it('draws mapping coverage', () => {
    const rolled = statsEntry('Rolled', {
      stats: etlStats(20, {
        ontology: {
          measurementsMapped: null,
          codesWithParents: 0.5,
          vocabularies: [],
          suppressed: { cells: 2, measurements: 4 },
        },
      }),
    });
    const unmapped = statsEntry('Unmapped', { stats: etlStats(10, { ontology: null }) });
    const blank = statsEntry('Blank', {
      stats: etlStats(5, {
        ontology: { measurementsMapped: null, codesWithParents: null, vocabularies: [], suppressed: null },
      }),
    });
    const model = ontologyChart([rolled, big, unmapped, blank]);
    const [mapped, codes] = (model.figure?.data ?? []).map(attrs);
    expect(mapped).toMatchObject({
      name: 'Measurements mapped',
      y: ['Big', 'Rolled'],
      x: [0.6, null],
      text: ['60%', ''],
    });
    expect(codes).toMatchObject({ x: [0.25, 0.5], text: ['25%', '50%'] });
    expect(model.skipped).toEqual([
      { label: 'Unmapped', reason: 'Its code metadata maps no codes to parent codes in a vocabulary.' },
      { label: 'Blank', reason: 'Its stats file has no mapping-coverage figures.' },
    ]);
    expect(model.table.rows).toEqual([
      ['Big', '60%', '25%'],
      ['Rolled', '—', '50%'],
    ]);
  });

  it('has no figure without data', () => {
    expect(ontologyChart([]).figure).toBeNull();
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
      perSubject: perSubject({ measurements: dist(9000, 1000) }),
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
    const layout = model.figure?.layout as Record<string, Record<string, unknown>>;
    expect(layout.xaxis).toMatchObject({ type: 'log', title: { text: 'Subjects (log scale)' } });
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
      columns: ['Dataset', 'Subjects', 'Median measurements per subject', 'Unique codes'],
      rows: [
        ['Broad', '100,000', '30', '40,000'],
        ['Tiny', '3,000', '30', '100'],
        ['Deep', '100', '1,000', '10,000'],
      ],
    });
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
        entryWith('No distribution', 30, { perSubject: perSubject({ measurements: null }) }),
        entryWith('Suppressed', 20, { perSubject: perSubject({ measurements: SUPPRESSED }) }),
        entryWith('Zero subjects', 0, {}),
        entryWith('Zero median', 10, { perSubject: perSubject({ measurements: dist(1, 0) }) }),
      ],
      wide
    );
    expect(model).toEqual({
      figure: null,
      skipped: [
        { label: 'No codes', reason: 'Its stats file has no unique-code count.' },
        { label: 'No distribution', reason: 'Its stats file has no per-subject measurement distribution.' },
        {
          label: 'Suppressed',
          reason: 'Suppressed: the median is withheld because it rests on fewer than 20 subjects.',
        },
        {
          label: 'Zero median',
          reason: 'It has no subjects or no measurements, which a logarithmic axis cannot show.',
        },
        {
          label: 'Zero subjects',
          reason: 'It has no subjects or no measurements, which a logarithmic axis cannot show.',
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
  const fast = entryWith('Fast', 200, {
    perSubject: perSubject({ measurements: dist(400), spanDays: dist(10) }),
  });
  const slow = entryWith('Slow', 300, {});

  it('ranks measurements per day of record, a ratio of the two means, on a log axis', () => {
    const model = paceChart([slow, fast], 'perDay');
    const bars = attrs(model.figure?.data[0]);
    expect(bars).toMatchObject({ y: ['Fast', 'Slow'], x: [40, 40 / 120], text: ['40', '0.333'] });
    expect(model.figure?.layout.xaxis).toMatchObject({
      type: 'log',
      title: { text: 'Measurements per day (log scale)' },
    });
    expect(model.table).toEqual({
      columns: [
        'Dataset',
        'Mean measurements per subject',
        'Mean record span (days)',
        'Measurements per day of record',
      ],
      rows: [
        ['Fast', '400', '10', '40'],
        ['Slow', '40', '120', '0.333'],
      ],
    });
  });

  it('skips datasets without both means, or with a zero mean span', () => {
    const model = paceChart(
      [
        entryWith('No measurements', 90, { perSubject: perSubject({ measurements: null }) }),
        entryWith('Suppressed', 80, { perSubject: perSubject({ measurements: SUPPRESSED }) }),
        entryWith('No mean', 70, { perSubject: perSubject({ measurements: dist(null) }) }),
        entryWith('No span', 60, { perSubject: perSubject({ spanDays: null }) }),
        entryWith('Suppressed span', 50, { perSubject: perSubject({ spanDays: SUPPRESSED }) }),
        entryWith('One day', 40, { perSubject: perSubject({ spanDays: dist(0) }) }),
      ],
      'perDay'
    );
    expect(model.figure).toBeNull();
    expect(model.skipped).toEqual([
      { label: 'No measurements', reason: 'Its stats file has no per-subject measurement distribution.' },
      {
        label: 'Suppressed',
        reason: 'Suppressed: its per-subject measurement summary rests on fewer than 20 subjects.',
      },
      { label: 'No mean', reason: 'Its stats file has no mean measurement per subject.' },
      { label: 'No span', reason: 'Its stats file has no per-subject record span distribution.' },
      {
        label: 'Suppressed span',
        reason: 'Suppressed: its per-subject record span summary rests on fewer than 20 subjects.',
      },
      { label: 'One day', reason: 'Its mean record span is zero days, so it has no daily rate.' },
    ]);
  });

  it('ranks measurements per event, an exact ratio, on a linear axis', () => {
    const dense = entryWith('Dense', 100, { counts: counts(100, { events: 400 }) });
    const noEvents = entryWith('No events', 50, { counts: counts(50, { events: null }) });
    const model = paceChart([slow, dense, noEvents], 'perEvent');
    expect(attrs(model.figure?.data[0])).toMatchObject({ y: ['Dense', 'Slow'], x: [25, 10] });
    expect(model.figure?.layout.xaxis).toMatchObject({
      title: { text: 'Measurements per event' },
      rangemode: 'tozero',
    });
    expect(model.table).toEqual({
      columns: ['Dataset', 'Measurements', 'Events', 'Measurements per event'],
      rows: [
        ['Dense', '10,000', '400', '25'],
        ['Slow', '30,000', '3,000', '10'],
      ],
    });
    expect(model.skipped).toEqual([
      { label: 'No events', reason: 'Its stats file has no measurement or event count.' },
    ]);
  });
});

describe('codeCoveragePoints', () => {
  it('orders the published points by number of codes, ending at all codes, and drops points past them', () => {
    const points = codeCoveragePoints(
      etlStats(1).concentration as NonNullable<EtlStats['concentration']>,
      50
    );
    expect(points.map(p => [p.codes, p.share])).toEqual([
      [4, 0.5],
      [10, 0.3],
      [20, 0.9],
      [45, 0.99],
      [50, 1],
    ]);
    expect(points.map(p => p.text)).toEqual([
      'It takes the 4 most frequent codes to cover 50% of measurements',
      'The 10 most frequent codes cover 30% of measurements',
      'It takes the 20 most frequent codes to cover 90% of measurements',
      'It takes the 45 most frequent codes to cover 99% of measurements',
      'All 50 codes cover 100% of measurements',
    ]);
  });

  it('leaves out unknown or zero figures, and keeps every point without a code count', () => {
    const points = codeCoveragePoints(
      { top10: null, top100: 0.9, top1000: 1, codesFor50: 0, codesFor90: null, codesFor99: 1000 },
      null
    );
    expect(points.map(p => [p.codes, p.share])).toEqual([
      [100, 0.9],
      [1000, 0.99],
      [1000, 1],
    ]);
  });
});

describe('codeCoverageChart', () => {
  it('highlights the largest dataset by default, with the others in grey and one legend entry for them', () => {
    const other = statsEntry('Other', { stats: etlStats(10) });
    const model = codeCoverageChart([small, other, big], null);
    expect(model.options).toEqual(['Big', 'Small', 'Other']);
    expect(model.highlighted).toBe('Big');
    const traces = (model.figure?.data ?? []).map(attrs);
    expect(traces.map(t => t.name)).toEqual(['Other datasets', 'Other datasets', 'Big']);
    expect(traces.map(t => t.showlegend)).toEqual([true, false, undefined]);
    expect(traces.map(t => (t.line as { color: string }).color)).toEqual([
      CONTEXT_GREY,
      CONTEXT_GREY,
      SERIES_COLORS[0],
    ]);
    expect(traces[2]).toMatchObject({
      mode: 'lines+markers',
      x: [4, 10, 20, 45, 50],
      y: [0.5, 0.3, 0.9, 0.99, 1],
      text: ['Big', 'Big', 'Big', 'Big', 'Big'],
    });
    expect(model.figure?.layout.xaxis).toMatchObject({ type: 'log', ticktext: ['1', '10', '100'] });
    expect(model.figure?.layout.yaxis).toMatchObject({ range: [0, 1.04], tickformat: '.0%' });
    expect(model.table.rows[0]).toEqual(['Big', '30%', '80%', '99%', '4', '20', '45', '50']);
  });

  it('highlights the chosen dataset, or falls back to the first if it is not drawn', () => {
    expect(codeCoverageChart([big, small], 'Small').figure?.data.map(t => attrs(t).name)).toEqual([
      'Other datasets',
      'Small',
    ]);
    expect(codeCoverageChart([big, small], 'Gone').highlighted).toBe('Big');
  });

  it('notes a curve without a code count, and skips datasets without concentration figures', () => {
    const noCount = entryWith('No count', 50, { counts: counts(50, { uniqueCodes: null }) });
    const none = entryWith('None', 40, { concentration: null });
    const empty = entryWith('Empty', 30, {
      concentration: {
        top10: null,
        top100: null,
        top1000: null,
        codesFor50: null,
        codesFor90: null,
        codesFor99: null,
      },
    });
    const model = codeCoverageChart([noCount, none, empty], null);
    expect(attrs(model.figure?.data[0]).x).toEqual([4, 10, 20, 45, 100, 1000]);
    expect(model.table.rows).toEqual([['No count', '30%', '80%', '99%', '4', '20', '45', '—']]);
    expect(model.skipped).toEqual([
      { label: 'None', reason: 'Its stats file has no code-concentration figures.' },
      { label: 'Empty', reason: 'Its stats file has no code-concentration figures.' },
      {
        label: 'No count',
        reason: 'Its stats file has no unique-code count, so its curve stops short of 100%.',
      },
    ]);
    const shares = codeCoverageChart([empty], null);
    expect(shares).toMatchObject({ figure: null, options: [], highlighted: null });
    // A missing share shows as a dash in the table.
    const partial = entryWith('Partial', 20, {
      concentration: {
        ...(etlStats(1).concentration as NonNullable<EtlStats['concentration']>),
        top10: null,
      },
    });
    expect(codeCoverageChart([partial], null).table.rows[0][1]).toBe('—');
  });
});

describe('vocabularyChart', () => {
  const ontology = (
    vocabularies: { name: string; measurements: number | null; recognized: boolean | null }[],
    suppressed: { cells: number | null; measurements: number | null } | null = null
  ): EtlStats['ontology'] => ({ measurementsMapped: 0.5, codesWithParents: 0.5, vocabularies, suppressed });

  it('shades each vocabulary share on a log scale, most widely used vocabularies first', () => {
    // Big has 500,000 measurements; Small 10,000; Other 1,000.
    const bigVocab = entryWith('Big', 5000, {
      ontology: ontology(
        [
          { name: 'ICD10CM', measurements: 1000, recognized: true },
          { name: 'LOCAL', measurements: 10, recognized: false },
          { name: 'LOINC', measurements: 250_000, recognized: true },
          { name: 'MAYBE', measurements: null, recognized: null },
        ],
        { cells: 2, measurements: 40 }
      ),
    });
    const smallVocab = entryWith('Small', 100, {
      ontology: ontology([{ name: 'ICD10CM', measurements: 500, recognized: null }], {
        cells: 1,
        measurements: 3,
      }),
    });
    const otherVocab = entryWith('Other', 10, {
      ontology: ontology(
        [
          { name: 'ICD10CM', measurements: 100, recognized: true },
          { name: 'LOINC', measurements: 1000, recognized: true },
        ],
        { cells: null, measurements: 9 }
      ),
    });
    const model = vocabularyChart([smallVocab, otherVocab, bigVocab]);
    const [grid, heatmap] = (model.figure?.data ?? []).map(attrs);
    // A faint grid under every cell, without hover.
    expect(grid).toMatchObject({
      hoverinfo: 'skip',
      z: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    });
    expect(heatmap.x).toEqual(['ICD10CM', 'LOINC', 'LOCAL', 'MAYBE']);
    expect(heatmap.y).toEqual(['Big', 'Small', 'Other']);
    expect(model.figure?.layout.xaxis).toMatchObject({ ticktext: ['ICD10CM*', 'LOINC*', 'LOCAL', 'MAYBE'] });
    // log10 of the share, floored at 0.01%; a vocabulary a dataset doesn't use has no cell.
    expect(heatmap.z).toEqual([
      [Math.log10(0.002), Math.log10(0.5), -4, null],
      [Math.log10(0.05), null, null, null],
      [Math.log10(0.1), 0, null, null],
    ]);
    expect(heatmap.text).toEqual([
      ['0.2%', '50%', '<0.1%', 'n/a'],
      ['5.0%', '', '', ''],
      ['10%', '100%', '', ''],
    ]);
    expect((heatmap.customdata as string[][])[0]).toEqual([
      'ICD10CM (a standard OMOP vocabulary)',
      'LOINC (a standard OMOP vocabulary)',
      'LOCAL',
      'MAYBE',
    ]);
    expect(model.figure?.layout.margin).toEqual({ l: 8, r: 8, t: 57, b: 8 });
    expect(model.minWidth).toBe(5 * 7 + 24 + 4 * 44);
    expect(model.anyRecognized).toBe(true);
    expect(model.skipped).toEqual([
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

  it('skips datasets without vocabularies or a measurement count, saying why', () => {
    const local = entryWith('Local', 900, {
      ontology: ontology([{ name: 'LOCAL', measurements: 5, recognized: false }]),
    });
    const model = vocabularyChart([
      local,
      entryWith('Unmapped', 800, { ontology: null }),
      entryWith('Uncounted', 700, { counts: counts(700, { measurements: null }) }),
      entryWith('Empty data', 600, { counts: counts(600, { measurements: 0 }) }),
      entryWith('Nameless', 500, { ontology: ontology([]) }),
      entryWith('All suppressed', 400, { ontology: ontology([], { cells: 3, measurements: 7 }) }),
      entryWith('Uncounted rollup', 300, { ontology: ontology([], { cells: null, measurements: null }) }),
    ]);
    expect(model.anyRecognized).toBe(false);
    expect(attrs(model.figure?.data[0]).y).toEqual(['Local']);
    expect(model.skipped).toEqual([
      { label: 'Unmapped', reason: 'Its code metadata maps no codes to parent codes in a vocabulary.' },
      { label: 'Uncounted', reason: 'Its stats file has no measurement count to take shares of.' },
      { label: 'Empty data', reason: 'Its stats file has no measurement count to take shares of.' },
      { label: 'Nameless', reason: 'Its code metadata names no vocabulary.' },
      {
        label: 'All suppressed',
        reason: 'Suppressed: all 3 vocabularies are reached by fewer than 20 subjects each.',
      },
      {
        label: 'Uncounted rollup',
        reason: 'Suppressed: all its vocabularies are reached by fewer than 20 subjects each.',
      },
    ]);
    expect(vocabularyChart([])).toEqual({ figure: null, skipped: [], minWidth: 0, anyRecognized: false });
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
      medsVersion: { status: 'info', text: '0.4.0' },
      etl: { status: 'info', text: 'etl 0.1' },
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
    expect(row.missingCodes).toEqual({ status: 'warn', text: '2 codes' });
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
      missingCodes: { status: 'warn', text: '1 code' },
      descriptions: { status: 'pass', text: '90.0%' },
      unusedCodes: { status: 'info', text: '3 codes' },
    });
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
      medsVersion: { status: 'unknown', text: 'Not stated' },
      etl: { status: 'unknown', text: 'Not stated' },
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
      medsVersion: { status: 'unknown', text: 'Not stated' },
      etl: { status: 'info', text: 'etl' },
    });
    expect(rows['No codes'].descriptions).toEqual(notReported);
    expect(healthCheck([unreadable])).toEqual({
      rows: [],
      skipped: [{ label: 'Future', reason: unreadable.problem }],
    });
  });

  it('explains every check, including the description threshold', () => {
    expect(HEALTH_CHECKS.map(check => check.key)).toEqual([
      'ids',
      'missingCodes',
      'numeric',
      'descriptions',
      'unusedCodes',
      'medsVersion',
      'etl',
    ]);
    expect(HEALTH_CHECKS.find(check => check.key === 'descriptions')?.help).toMatch(/passes at 90% or more/);
  });
});
