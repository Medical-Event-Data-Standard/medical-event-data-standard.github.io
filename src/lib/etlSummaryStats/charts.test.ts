import { describe, expect, it } from '@jest/globals';
import {
  baseLayout,
  concentrationChart,
  coverageChart,
  datasetName,
  defaultDirection,
  formatCompact,
  formatCount,
  formatDate,
  formatPercent,
  githubRepoUrl,
  logTicks,
  ontologyChart,
  orderDatasets,
  partition,
  perSubjectChart,
  ratio,
  schemaDescription,
  SERIES_COLORS,
  SIZE_SORT_OPTIONS,
  sizeChart,
  sortBySize,
  sortDirectionOptions,
  statsFileUrl,
  valueAxis,
  yearPanels,
} from './charts';
import { etlStats, statsEntry } from './testFixtures';
import type { EtlStatsEntry } from './types';

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
  });

  it('formats dates', () => {
    expect(formatDate('2026-11-04T22:16:51.111265')).toBe('2026-11-04');
    expect(formatDate('yesterday')).toBe('yesterday');
    expect(formatDate(null)).toBe('—');
  });

  it('builds log-axis ticks at powers of ten', () => {
    expect(logTicks(120, 45_000)).toEqual({
      tickvals: [100, 1000, 10000, 100000],
      ticktext: ['100', '1K', '10K', '100K'],
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

describe('yearPanels', () => {
  const years = (byYear: NonNullable<EtlStatsEntry['stats']>['byYear']) => etlStats(50, { byYear });

  it('draws one column per reported year, notes suppressed years and never fills gaps', () => {
    const gappy = statsEntry('Gappy', {
      stats: years({
        years: [1969, 1972],
        measurements: [10, 30],
        subjects: [21, 25],
        suppressed: { cells: 1, measurements: 3 },
      }),
    });
    const { panels, skipped, table } = yearPanels([gappy, big], 'subjects');
    expect(panels.map(p => p.label)).toEqual(['Big', 'Gappy']);
    expect(attrs(panels[1].figure.data[0])).toMatchObject({ type: 'bar', x: [1969, 1972], y: [21, 25] });
    expect(panels[1].note).toBe('1 more year suppressed (fewer than 20 subjects each).');
    expect(panels[0].note).toBeNull();
    expect(skipped).toEqual([]);
    expect(table.rows).toEqual([
      ['Big', '2', '2100', '2102', '2102 (300)', '0'],
      ['Gappy', '2', '1969', '1972', '1972 (25)', '1'],
    ]);
    expect(table.columns[4]).toBe('Peak year (subjects)');
  });

  it('pluralises the suppressed-years note', () => {
    const entry = statsEntry('Many', {
      stats: years({
        years: [2000],
        measurements: [5],
        subjects: [30],
        suppressed: { cells: 3, measurements: null },
      }),
    });
    expect(yearPanels([entry], 'measurements').panels[0].note).toBe(
      '3 more years suppressed (fewer than 20 subjects each).'
    );
  });

  it('skips datasets whose years are all suppressed, or that have none', () => {
    const allSuppressed = statsEntry('Demo', {
      stats: years({
        years: [],
        measurements: [],
        subjects: [],
        suppressed: { cells: 134, measurements: 9 },
      }),
    });
    const unknownCount = statsEntry('Unknown', {
      minCellSize: null,
      stats: years({
        years: [],
        measurements: [],
        subjects: [],
        suppressed: { cells: null, measurements: null },
      }),
    });
    const empty = statsEntry('Empty', {
      stats: years({ years: [], measurements: [], subjects: [], suppressed: null }),
    });
    const none = statsEntry('None', { stats: years(null) });
    expect(yearPanels([allSuppressed, unknownCount, empty, none], 'measurements')).toEqual({
      panels: [],
      skipped: [
        { label: 'Demo', reason: 'Suppressed: all 134 years had fewer than 20 subjects each.' },
        { label: 'Empty', reason: 'Its stats file has no calendar-year counts.' },
        { label: 'None', reason: 'Its stats file has no calendar-year counts.' },
        { label: 'Unknown', reason: 'Suppressed: all years had too few subjects each.' },
      ],
      table: { columns: expect.any(Array), rows: [] },
    });
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

describe('concentrationChart', () => {
  it('draws three dots per dataset joined by a rule', () => {
    const partial = statsEntry('Partial', {
      stats: etlStats(10, { concentration: { top10: 0.5, top100: null, top1000: 1 } }),
    });
    const none = statsEntry('None', { stats: etlStats(5, { concentration: null }) });
    const allNull = statsEntry('All null', {
      stats: etlStats(4, { concentration: { top10: null, top100: null, top1000: null } }),
    });
    const model = concentrationChart([partial, big, none, allNull]);
    const [rule, top10, top100] = (model.figure?.data ?? []).map(attrs);
    expect(rule.x).toEqual([0.3, 0.99, null, 0.5, 1, null]);
    expect(rule.y).toEqual(['Big', 'Big', null, 'Partial', 'Partial', null]);
    expect(top10).toMatchObject({ name: 'Top 10 codes', x: [0.3, 0.5] });
    expect(top100).toMatchObject({ name: 'Top 100 codes', x: [0.8, null] });
    expect(model.skipped.map(s => s.label)).toEqual(['None', 'All null']);
    expect(model.table.rows).toEqual([
      ['Big', '30%', '80%', '99%'],
      ['Partial', '50%', '—', '100%'],
    ]);
  });

  it('has no figure without data', () => {
    expect(concentrationChart([unreadable]).figure).toBeNull();
  });
});

describe('ontologyChart', () => {
  it('draws mapping coverage and lists vocabularies, noting suppressed ones', () => {
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
    expect(codes).toMatchObject({ x: [0.25, 0.5], customdata: ['LOINC', '—'] });
    expect(model.skipped).toEqual([
      { label: 'Unmapped', reason: 'Its code metadata maps no codes to parent codes in a vocabulary.' },
      { label: 'Blank', reason: 'Its stats file has no mapping-coverage figures.' },
    ]);
    expect(model.table.rows).toEqual([
      ['Big', '60%', '25%', 'LOINC'],
      ['Rolled', '—', '50%', '— (+2 suppressed)'],
    ]);
  });

  it('has no figure without data', () => {
    expect(ontologyChart([]).figure).toBeNull();
  });
});
