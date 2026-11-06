import type { Data, Layout } from 'plotly.js';
import type { Distribution, EtlStats, EtlStatsEntry } from './types';

// Pure functions that turn the collected stats into Plotly figures, a table view of each chart, and the list of
// datasets each chart had to leave out (with the reason, which the page shows). No React and no Plotly runtime
// here, so all of it is unit-tested.
//
// Every number plotted is one the ETL's stats file states, or a ratio of two it states. Suppressed cells are
// never filled in or back-computed: a chart that would need them leaves the dataset out with a note.

// ─── Look ───────────────────────────────────────────────────────

/** Categorical slots, in fixed order; validated for colour-vision deficiencies on a white surface. */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'] as const;
/** Text and chrome. Text never takes a series colour. */
export const INK = {
  primary: '#1c1e21',
  secondary: '#52514e',
  muted: '#6f6e69',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  /** Text on a filled mark: white, or near-black on the light yellow slot. */
  onFill: '#ffffff',
  onYellow: '#0b0b0b',
} as const;
/** Single-hue sequential ramp (light to dark) for magnitude. */
const SEQUENTIAL_BLUES: [number, string][] = [
  [0, '#eef5fd'],
  [0.25, '#b7d3f6'],
  [0.5, '#6da7ec'],
  [0.75, '#2a78d6'],
  [1, '#104281'],
];

/**
 * A Plotly trace. Plotly accepts attributes that @types/plotly.js lacks or types too narrowly (`cornerradius`,
 * `insidetextanchor`, a heatmap's 2-D `text`), so traces are written as plain objects and checked by the tests.
 */
const trace = (attributes: Record<string, unknown>): Data => attributes as Data;

const ROW_HEIGHT = 34;
const MARGIN = { l: 8, r: 24, t: 8, b: 40 };

// ─── Formatting ─────────────────────────────────────────────────

const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fullFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** 364.6K, 881.4M. */
export const formatCompact = (value: number): string => compactFormat.format(value);
/** 364,627. */
export const formatCount = (value: number): string => fullFormat.format(value);

/** A share as a percentage: whole percents, with one decimal below 10%, and "<0.1%" for tiny non-zero shares. */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent === 0) return '0%';
  if (percent < 0.05) return '<0.1%';
  // Round before choosing the precision, so 9.97% reads "10%" rather than "10.0%".
  return Math.round(percent * 10) / 10 < 10 ? `${percent.toFixed(1)}%` : `${percent.toFixed(0)}%`;
}

/** The date part of an ISO timestamp (`2026-11-04T22:16:51` -> `2026-11-04`). */
export const formatDate = (iso: string | null): string =>
  iso ? (/^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0] ?? iso) : '—';

/** Powers of ten spanning [min, max], labelled compactly, for a log axis. */
export function logTicks(min: number, max: number): { tickvals: number[]; ticktext: string[] } {
  const tickvals: number[] = [];
  for (let exp = Math.floor(Math.log10(min)); exp <= Math.ceil(Math.log10(max)); exp++) {
    tickvals.push(10 ** exp);
  }
  return { tickvals, ticktext: tickvals.map(formatCompact) };
}

// ─── Shared helpers ─────────────────────────────────────────────

export interface Skipped {
  label: string;
  reason: string;
}

export interface TableView {
  columns: string[];
  rows: string[][];
}

export interface Figure {
  data: Data[];
  layout: Partial<Layout>;
}

export interface ChartModel {
  /** Null when no dataset can be drawn. */
  figure: Figure | null;
  skipped: Skipped[];
  table: TableView;
}

/** Largest datasets (by subjects) first, so the charts list datasets in the same order. */
export function orderDatasets(entries: EtlStatsEntry[]): EtlStatsEntry[] {
  return [...entries].sort(
    (a, b) =>
      (b.stats?.counts.subjects ?? -1) - (a.stats?.counts.subjects ?? -1) || a.label.localeCompare(b.label)
  );
}

/** "fewer than 20 subjects" (the file's suppression floor), or a generic phrase if the file doesn't state it. */
const floorPhrase = (entry: EtlStatsEntry): string =>
  entry.minCellSize !== null ? `fewer than ${formatCount(entry.minCellSize)} subjects` : 'too few subjects';

/**
 * Splits the datasets into those a chart can draw (`pick` returns a value) and those it skips (`pick` returns a
 * reason). Datasets whose file couldn't be read at all are skipped with the file's problem.
 */
export function partition<T>(
  entries: EtlStatsEntry[],
  pick: (stats: EtlStats, entry: EtlStatsEntry) => T | { skip: string }
): { drawn: { entry: EtlStatsEntry; value: T }[]; skipped: Skipped[] } {
  const drawn: { entry: EtlStatsEntry; value: T }[] = [];
  const skipped: Skipped[] = [];
  for (const entry of entries) {
    if (!entry.stats) {
      skipped.push({ label: entry.label, reason: entry.problem ?? 'Its stats file could not be read.' });
      continue;
    }
    const value = pick(entry.stats, entry);
    if (value !== null && typeof value === 'object' && 'skip' in value) {
      skipped.push({ label: entry.label, reason: value.skip });
    } else {
      drawn.push({ entry, value: value as T });
    }
  }
  return { drawn, skipped };
}

const axisStyle = {
  gridcolor: INK.grid,
  linecolor: INK.axis,
  zeroline: false,
  tickfont: { color: INK.muted },
  title: { font: { color: INK.secondary, size: 12 } },
  fixedrange: true,
};

/** Layout shared by every chart; `rows` sizes a horizontal chart so each dataset gets a band of the same height. */
export function baseLayout(rows: number, overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    height: Math.max(rows, 1) * ROW_HEIGHT + MARGIN.t + MARGIN.b,
    autosize: true,
    margin: { ...MARGIN },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      size: 12,
      color: INK.secondary,
    },
    hoverlabel: { bgcolor: '#ffffff', bordercolor: INK.grid, font: { color: INK.primary } },
    showlegend: false,
    ...overrides,
    xaxis: { ...axisStyle, ...overrides.xaxis },
    yaxis: {
      ...axisStyle,
      automargin: true,
      autorange: 'reversed',
      gridcolor: 'rgba(0,0,0,0)',
      tickfont: { color: INK.primary },
      ...overrides.yaxis,
    },
  } as Partial<Layout>;
}

/** A legend above the plot, in one row that wraps on narrow screens. */
const TOP_LEGEND: Partial<Layout> = {
  showlegend: true,
  legend: {
    orientation: 'h',
    // Plotly lists stacked bars' legend in reverse by default; keep it in trace (split) order.
    traceorder: 'normal',
    x: 0,
    xanchor: 'left',
    y: 1,
    yanchor: 'bottom',
    font: { color: INK.primary },
  },
};

/** A log axis if every value is positive (values span orders of magnitude), else a linear one from zero. */
export function valueAxis(values: number[], title: string): Partial<Layout['xaxis']> {
  if (values.length === 0 || values.some(value => value <= 0)) {
    return { title: { text: title }, rangemode: 'tozero' };
  }
  const { tickvals, ticktext } = logTicks(Math.min(...values), Math.max(...values));
  return { title: { text: `${title} (log scale)` }, type: 'log', tickvals, ticktext };
}

// ─── 1. Dataset size ────────────────────────────────────────────

export type SizeMetric = 'subjects' | 'events' | 'measurements' | 'uniqueCodes';

export const SIZE_METRICS: { key: SizeMetric; label: string }[] = [
  { key: 'subjects', label: 'Subjects' },
  { key: 'events', label: 'Events' },
  { key: 'measurements', label: 'Measurements' },
  { key: 'uniqueCodes', label: 'Unique codes' },
];

/** Ranked bars (largest on top) of one size metric, on a log axis. The table lists all four metrics. */
export function sizeChart(entries: EtlStatsEntry[], metric: SizeMetric): ChartModel {
  const meta = SIZE_METRICS.find(m => m.key === metric) as (typeof SIZE_METRICS)[number];
  const { drawn, skipped } = partition(entries, stats => {
    const value = stats.counts[metric];
    return value === null ? { skip: `Its stats file has no ${meta.label.toLowerCase()} count.` } : value;
  });
  drawn.sort((a, b) => b.value - a.value);

  const table: TableView = {
    columns: ['Dataset', ...SIZE_METRICS.map(m => m.label)],
    rows: orderDatasets(entries).flatMap(({ label, stats }) =>
      stats
        ? [
            [
              label,
              ...SIZE_METRICS.map(m =>
                stats.counts[m.key] === null ? '—' : formatCount(stats.counts[m.key] as number)
              ),
            ],
          ]
        : []
    ),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  const values = drawn.map(d => d.value);
  return {
    figure: {
      data: [
        trace({
          type: 'bar',
          orientation: 'h',
          y: drawn.map(d => d.entry.label),
          x: values,
          text: values.map(formatCompact),
          textposition: 'outside',
          textfont: { color: INK.primary },
          cliponaxis: false,
          marker: { color: SERIES_COLORS[0], cornerradius: 4 },
          customdata: values.map(formatCount),
          hovertemplate: `%{y}<br>${meta.label}: %{customdata}<extra></extra>`,
        }),
      ],
      layout: baseLayout(drawn.length, {
        bargap: 0.35,
        margin: { ...MARGIN, r: 56 },
        xaxis: valueAxis(values, meta.label),
      }),
    },
    skipped,
    table,
  };
}

// ─── 2. Per-subject distributions ───────────────────────────────

export type PerSubjectMetric = 'measurements' | 'events' | 'uniqueCodes' | 'spanDays';

export const PER_SUBJECT_METRICS: { key: PerSubjectMetric; label: string; axis: string }[] = [
  { key: 'measurements', label: 'Measurements', axis: 'Measurements per subject' },
  { key: 'events', label: 'Events', axis: 'Events per subject' },
  { key: 'uniqueCodes', label: 'Unique codes', axis: 'Distinct codes per subject' },
  { key: 'spanDays', label: 'Record span', axis: 'Days from first to last event per subject' },
];

/**
 * Box-style summaries drawn from the published quantiles: the box spans the 25th to 75th percentile, the line
 * inside it is the median, and the whiskers reach the 5th and 95th percentiles (there are no minima or maxima:
 * `meds_summary_stats` never publishes extremes).
 */
export function perSubjectChart(entries: EtlStatsEntry[], metric: PerSubjectMetric): ChartModel {
  const meta = PER_SUBJECT_METRICS.find(m => m.key === metric) as (typeof PER_SUBJECT_METRICS)[number];
  const { drawn, skipped } = partition(orderDatasets(entries), (stats, entry) => {
    const dist: Distribution | null = stats.perSubject[metric];
    if (!dist) return { skip: `Its stats file has no per-subject ${meta.label.toLowerCase()} distribution.` };
    if (dist.suppressed) {
      return { skip: `Suppressed: the quantiles are withheld because they rest on ${floorPhrase(entry)}.` };
    }
    return dist;
  });
  const table: TableView = {
    columns: ['Dataset', 'Subjects', '5th pct.', '25th pct.', 'Median', '75th pct.', '95th pct.'],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      formatCount(value.n),
      ...[value.p5, value.p25, value.p50, value.p75, value.p95].map(formatCount),
    ]),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  const labels = drawn.map(d => d.entry.label);
  const dists = drawn.map(d => d.value);
  const pick = (key: 'p5' | 'p25' | 'p50' | 'p75' | 'p95') => dists.map(d => d[key]);
  return {
    figure: {
      data: [
        trace({
          type: 'box',
          orientation: 'h',
          y: labels,
          lowerfence: pick('p5'),
          q1: pick('p25'),
          median: pick('p50'),
          q3: pick('p75'),
          upperfence: pick('p95'),
          fillcolor: 'rgba(42, 120, 214, 0.18)',
          line: { color: SERIES_COLORS[0], width: 2 },
          whiskerwidth: 0.4,
          hoverinfo: 'skip',
        }),
        // The box trace's own hover names the whiskers "fences"; this invisible layer explains them properly.
        trace({
          type: 'scatter',
          mode: 'markers',
          y: labels,
          x: pick('p50'),
          marker: { size: 18, color: 'rgba(0,0,0,0)' },
          customdata: dists.map(d => [d.p5, d.p25, d.p50, d.p75, d.p95, d.n].map(formatCount)),
          hovertemplate:
            '%{y}<br>Median: %{customdata[2]}<br>25th–75th percentile: %{customdata[1]}–%{customdata[3]}' +
            '<br>5th–95th percentile: %{customdata[0]}–%{customdata[4]}<br>Subjects: %{customdata[5]}<extra></extra>',
        }),
      ],
      layout: baseLayout(drawn.length, {
        xaxis: valueAxis([...pick('p5'), ...pick('p95')], meta.axis),
      }),
    },
    skipped,
    table,
  };
}

// ─── 3. Calendar years ──────────────────────────────────────────

export type YearMetric = 'measurements' | 'subjects';

export interface YearPanel {
  label: string;
  figure: Figure;
  /** E.g. how many years were suppressed. */
  note: string | null;
}

/**
 * One small chart per dataset with a column per reported calendar year, each on its own year range, since
 * datasets shift their dates by different amounts. A year that isn't reported (no data, or suppressed) has no
 * column; it is never drawn as zero.
 */
export function yearPanels(
  entries: EtlStatsEntry[],
  metric: YearMetric
): { panels: YearPanel[]; skipped: Skipped[]; table: TableView } {
  const { drawn, skipped } = partition(orderDatasets(entries), (stats, entry) => {
    const byYear = stats.byYear;
    if (byYear && byYear.years.length > 0) return byYear;
    const count = byYear?.suppressed?.cells;
    if (count === undefined) return { skip: 'Its stats file has no calendar-year counts.' };
    return {
      skip: `Suppressed: all ${count === null ? '' : `${formatCount(count)} `}years had ${floorPhrase(entry)} each.`,
    };
  });

  const unit = metric === 'measurements' ? 'measurements' : 'subjects';
  const panels = drawn.map(({ entry, value }) => {
    const suppressed = value.suppressed?.cells;
    const note = suppressed
      ? `${formatCount(suppressed)} more year${suppressed === 1 ? '' : 's'} suppressed (${floorPhrase(entry)} each).`
      : null;
    return {
      label: entry.label,
      note,
      figure: {
        data: [
          trace({
            type: 'bar',
            x: value.years,
            y: value[metric],
            marker: { color: SERIES_COLORS[0] },
            hovertemplate: `%{x}: %{y:,} ${unit}<extra></extra>`,
          }),
        ],
        layout: baseLayout(0, {
          height: 170,
          margin: { l: 8, r: 12, t: 8, b: 28 },
          bargap: 0.1,
          xaxis: { tickformat: 'd', nticks: 5, gridcolor: 'rgba(0,0,0,0)' },
          yaxis: {
            autorange: true,
            automargin: true,
            rangemode: 'tozero',
            tickformat: '~s',
            nticks: 4,
            gridcolor: INK.grid,
            tickfont: { color: INK.muted },
          },
        }),
      },
    };
  });

  const table: TableView = {
    columns: ['Dataset', 'Years reported', 'First', 'Last', `Peak year (${metric})`, 'Years suppressed'],
    rows: drawn.map(({ entry, value }) => {
      const peak = value[metric].indexOf(Math.max(...value[metric]));
      return [
        entry.label,
        formatCount(value.years.length),
        String(value.years[0]),
        String(value.years[value.years.length - 1]),
        `${value.years[peak]} (${formatCount(value[metric][peak])})`,
        value.suppressed?.cells ? formatCount(value.suppressed.cells) : '0',
      ];
    }),
  };
  return { panels, skipped, table };
}

// ─── 4. Splits ──────────────────────────────────────────────────

/** The MEDS split names, in order; other names are pooled as "other". */
const KNOWN_SPLITS = ['train', 'tuning', 'held_out'];

/**
 * A 100% stacked bar per dataset of its subjects' shares in train / tuning / held_out (any other split names are
 * pooled as "other"). Shares are of the subjects in the reported splits. A dataset with a suppressed split is
 * left out: its share can't be shown without back-computing the suppressed split's size.
 */
export function splitChart(entries: EtlStatsEntry[]): ChartModel {
  const { drawn, skipped } = partition<{ totals: Record<string, number>; total: number }>(
    orderDatasets(entries),
    (stats, entry) => {
      const splits = stats.splits;
      if (!splits || (splits.cells.length === 0 && !splits.suppressed)) {
        return { skip: 'Its stats file has no subject splits.' };
      }
      if (splits.suppressed) {
        const count = splits.suppressed.cells;
        const which =
          count === 1
            ? `1 split had ${floorPhrase(entry)}`
            : `${count !== null ? formatCount(count) : 'some'} splits had ${floorPhrase(entry)} each`;
        return {
          skip: `Suppressed: ${which}, and showing shares would mean back-computing ${count === 1 ? 'its' : 'their'} size.`,
        };
      }
      const totals: Record<string, number> = {};
      for (const cell of splits.cells) {
        const key = KNOWN_SPLITS.includes(cell.split) ? cell.split : 'other';
        totals[key] = (totals[key] ?? 0) + cell.subjects;
      }
      const total = Object.values(totals).reduce((sum, n) => sum + n, 0);
      if (total === 0) return { skip: 'Its splits have no subjects.' };
      return { totals, total };
    }
  );

  const keys = [...KNOWN_SPLITS, 'other'].filter(key => drawn.some(d => d.value.totals[key] !== undefined));
  const table: TableView = {
    columns: ['Dataset', ...keys.map(key => `${key} subjects`)],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      ...keys.map(key => {
        const n = value.totals[key];
        return n === undefined ? '—' : `${formatCount(n)} (${formatPercent(n / value.total)})`;
      }),
    ]),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  return {
    figure: {
      data: keys.map((key, i) => {
        const shares = drawn.map(d => (d.value.totals[key] ?? 0) / d.value.total);
        return trace({
          type: 'bar',
          orientation: 'h',
          name: key,
          y: drawn.map(d => d.entry.label),
          x: shares,
          text: shares.map(share => (share > 0 ? formatPercent(share) : '')),
          textposition: 'inside',
          insidetextanchor: 'middle',
          textfont: { color: SERIES_COLORS[i] === '#eda100' ? INK.onYellow : INK.onFill },
          marker: { color: SERIES_COLORS[i], line: { color: '#ffffff', width: 2 } },
          customdata: drawn.map(d => formatCount(d.value.totals[key] ?? 0)),
          hovertemplate: `%{y}<br>${key}: %{customdata} subjects (%{text})<extra></extra>`,
        });
      }),
      layout: baseLayout(drawn.length, {
        ...TOP_LEGEND,
        barmode: 'stack',
        bargap: 0.35,
        margin: { ...MARGIN, t: 32 },
        // Hides a share that doesn't fit inside its segment; the hover and the table still give it.
        uniformtext: { minsize: 10, mode: 'hide' },
        xaxis: { title: { text: 'Share of subjects' }, tickformat: '.0%', range: [0, 1] },
      } as Partial<Layout>),
    },
    skipped,
    table,
  };
}

// ─── 5. Record coverage ─────────────────────────────────────────

const COVERAGE_COLUMNS: {
  label: string;
  short: string;
  value: (counts: EtlStats['counts']) => number | null;
}[] = [
  {
    label: 'Subjects with a birth record',
    short: 'Birth',
    value: c => ratio(c.subjectsWithBirth, c.subjects),
  },
  {
    label: 'Subjects with a death record',
    short: 'Death',
    value: c => ratio(c.subjectsWithDeath, c.subjects),
  },
  {
    label: 'Subjects with static data',
    short: 'Static',
    value: c => ratio(c.subjectsWithStatic, c.subjects),
  },
  {
    label: 'Measurements with a numeric value',
    short: 'Numeric',
    value: c => ratio(c.numericValues, c.measurements),
  },
];

/** `part / whole`, or null if either is missing or the whole is zero. */
export function ratio(part: number | null, whole: number | null): number | null {
  return part === null || whole === null || whole === 0 ? null : part / whole;
}

/** A dataset x measure grid of shares, shaded light (0%) to dark (100%) blue, with each share printed. */
export function coverageChart(entries: EtlStatsEntry[]): ChartModel {
  const { drawn, skipped } = partition(orderDatasets(entries), stats => {
    const values = COVERAGE_COLUMNS.map(column => column.value(stats.counts));
    return values.every(value => value === null)
      ? { skip: 'Its stats file has none of these counts.' }
      : values;
  });
  const table: TableView = {
    columns: ['Dataset', ...COVERAGE_COLUMNS.map(column => column.label)],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      ...value.map(share => (share === null ? '—' : formatPercent(share))),
    ]),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  return {
    figure: {
      data: [
        trace({
          type: 'heatmap',
          x: COVERAGE_COLUMNS.map(column => column.short),
          y: drawn.map(d => d.entry.label),
          z: drawn.map(d => d.value),
          zmin: 0,
          zmax: 1,
          colorscale: SEQUENTIAL_BLUES,
          showscale: false,
          xgap: 2,
          ygap: 2,
          text: drawn.map(d => d.value.map(share => (share === null ? 'n/a' : formatPercent(share)))),
          texttemplate: '%{text}',
          customdata: drawn.map(() => COVERAGE_COLUMNS.map(column => column.label)),
          hovertemplate: '%{y}<br>%{customdata}: %{text}<extra></extra>',
        }),
      ],
      layout: baseLayout(drawn.length, {
        margin: { ...MARGIN, t: 28, b: 8 },
        xaxis: {
          side: 'top',
          ticks: '',
          // One word per column, never rotated, so the labels fit over narrow columns on a phone.
          tickangle: 0,
          gridcolor: 'rgba(0,0,0,0)',
          linecolor: 'rgba(0,0,0,0)',
          tickfont: { color: INK.primary },
        },
        yaxis: { ticks: '', linecolor: 'rgba(0,0,0,0)' },
      }),
    },
    skipped,
    table,
  };
}

// ─── 6. Code concentration ──────────────────────────────────────

const CONCENTRATION_LEVELS = [
  { key: 'top10', label: 'Top 10 codes' },
  { key: 'top100', label: 'Top 100 codes' },
  { key: 'top1000', label: 'Top 1,000 codes' },
] as const;

/**
 * For each dataset, three dots on one line: the share of all measurements whose code is among the 10, 100 and
 * 1,000 most frequent codes. Dots far to the right mean a few codes dominate the data.
 */
export function concentrationChart(entries: EtlStatsEntry[]): ChartModel {
  const { drawn, skipped } = partition(orderDatasets(entries), stats => {
    const c = stats.concentration;
    if (!c || CONCENTRATION_LEVELS.every(level => c[level.key] === null)) {
      return { skip: 'Its stats file has no code-concentration figures.' };
    }
    return c;
  });
  const table: TableView = {
    columns: [
      'Dataset',
      ...CONCENTRATION_LEVELS.map(level => `Measurements in ${level.label.toLowerCase()}`),
    ],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      ...CONCENTRATION_LEVELS.map(level => {
        const share = value[level.key];
        return share === null ? '—' : formatPercent(share);
      }),
    ]),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  const labels = drawn.map(d => d.entry.label);
  // A thin rule from each dataset's lowest to highest share ties its dots together.
  const rule: Data = trace({
    type: 'scatter',
    mode: 'lines',
    x: drawn.flatMap(d => {
      const shares = CONCENTRATION_LEVELS.map(level => d.value[level.key]).filter(
        (s): s is number => s !== null
      );
      return [Math.min(...shares), Math.max(...shares), null];
    }),
    y: drawn.flatMap(d => [d.entry.label, d.entry.label, null]),
    line: { color: INK.axis, width: 2 },
    hoverinfo: 'skip',
    showlegend: false,
  });
  return {
    figure: {
      data: [
        rule,
        ...CONCENTRATION_LEVELS.map((level, i) =>
          trace({
            type: 'scatter',
            mode: 'markers',
            name: level.label,
            y: labels,
            x: drawn.map(d => d.value[level.key]),
            marker: { color: SERIES_COLORS[i], size: 11, line: { color: '#ffffff', width: 2 } },
            hovertemplate: `%{y}<br>${level.label}: %{x:.1%} of measurements<extra></extra>`,
          })
        ),
      ],
      layout: baseLayout(drawn.length, {
        ...TOP_LEGEND,
        margin: { ...MARGIN, t: 32 },
        xaxis: { title: { text: 'Share of all measurements' }, tickformat: '.0%', range: [0, 1.02] },
        yaxis: { gridcolor: INK.grid },
      }),
    },
    skipped,
    table,
  };
}

// ─── 7. Ontology coverage ───────────────────────────────────────

const ONTOLOGY_MEASURES = [
  { key: 'measurementsMapped', label: 'Measurements mapped' },
  { key: 'codesWithParents', label: 'Observed codes with a parent' },
] as const;

/**
 * Grouped bars of how much of each dataset reaches an external vocabulary through `parent_codes` in its code
 * metadata: the share of measurements, and the share of distinct observed codes.
 */
export function ontologyChart(entries: EtlStatsEntry[]): ChartModel {
  const { drawn, skipped } = partition(orderDatasets(entries), stats => {
    const ontology = stats.ontology;
    if (!ontology) return { skip: 'Its code metadata maps no codes to parent codes in a vocabulary.' };
    if (ONTOLOGY_MEASURES.every(measure => ontology[measure.key] === null)) {
      return { skip: 'Its stats file has no mapping-coverage figures.' };
    }
    return ontology;
  });
  const table: TableView = {
    columns: ['Dataset', ...ONTOLOGY_MEASURES.map(measure => measure.label), 'Vocabularies'],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      ...ONTOLOGY_MEASURES.map(measure => {
        const share = value[measure.key];
        return share === null ? '—' : formatPercent(share);
      }),
      [
        value.vocabularies.join(', ') || '—',
        value.suppressed?.cells ? `(+${formatCount(value.suppressed.cells)} suppressed)` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ]),
  };
  if (drawn.length === 0) return { figure: null, skipped, table };

  return {
    figure: {
      data: ONTOLOGY_MEASURES.map((measure, i) => {
        const shares = drawn.map(d => d.value[measure.key]);
        return trace({
          type: 'bar',
          orientation: 'h',
          name: measure.label,
          y: drawn.map(d => d.entry.label),
          x: shares,
          text: shares.map(share => (share === null ? '' : formatPercent(share))),
          textposition: 'outside',
          textfont: { color: INK.primary },
          cliponaxis: false,
          marker: { color: SERIES_COLORS[i], cornerradius: 4 },
          customdata: drawn.map(d => d.value.vocabularies.join(', ') || '—'),
          hovertemplate: `%{y}<br>${measure.label}: %{text}<br>Vocabularies: %{customdata}<extra></extra>`,
        });
      }),
      layout: baseLayout(drawn.length * 1.6, {
        ...TOP_LEGEND,
        barmode: 'group',
        bargap: 0.3,
        bargroupgap: 0.1,
        margin: { ...MARGIN, t: 32, r: 48 },
        xaxis: { title: { text: 'Share' }, tickformat: '.0%', range: [0, 1] },
      }),
    },
    skipped,
    table,
  };
}

// ─── Summary table ──────────────────────────────────────────────

export const githubRepoUrl = (githubRepo: string): string => `https://github.com/${githubRepo}`;
export const statsFileUrl = (entry: Pick<EtlStatsEntry, 'githubRepo' | 'path'>): string =>
  `https://github.com/${entry.githubRepo}/blob/HEAD/${entry.path}`;

/** "MIMIC-IV 3.1:0.2.1", or whatever part of the name and version the file states. */
export function datasetName(entry: EtlStatsEntry): string {
  const { name, version } = entry.dataset ?? { name: null, version: null };
  return [name, version].filter(Boolean).join(' ') || '—';
}

/** "1 (tool 0.0.3)": the stats schema version and the meds_summary_stats version that wrote the file. */
export function schemaDescription(entry: EtlStatsEntry): string {
  if (entry.schemaVersion === null) return '—';
  return entry.toolVersion
    ? `${entry.schemaVersion} (tool ${entry.toolVersion})`
    : String(entry.schemaVersion);
}
