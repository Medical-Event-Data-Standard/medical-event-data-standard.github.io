import type { Data, Layout } from 'plotly.js';
import type { Distribution, EtlStats, EtlStatsEntry } from './types';

// Pure functions that turn the collected stats into Plotly figures, a table view of each chart, and the list of
// datasets each chart had to leave out (with the reason, which the page shows). No React and no Plotly runtime
// here, so all of it is unit-tested.
//
// Every number plotted is one the ETL's stats file states, a ratio of two it states, or one minus a share it
// states. Suppressed cells are never filled in or back-computed: a chart that would need them leaves the dataset
// out with a note.

// ─── Look ───────────────────────────────────────────────────────

/**
 * The categorical palette, in its fixed order: eight hues validated (dataviz `validate_palette.js`, light mode) for
 * colour-vision deficiencies between neighbouring series, as in bar and line charts. Charts with more series than
 * slots add a second encoding (line dash and marker shape, see `seriesStyle`) rather than inventing new hues.
 */
export const CATEGORICAL_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
] as const;
/** The first four categorical slots, for charts with at most four series. */
export const SERIES_COLORS = CATEGORICAL_COLORS.slice(0, 4) as unknown as readonly [
  string,
  string,
  string,
  string,
];

const LINE_DASHES = ['solid', 'dash', 'dot'] as const;
const MARKER_SYMBOLS = ['circle', 'square', 'diamond'] as const;

/**
 * The colour, line dash and marker of the series at `index` in a stable identity order: the eight palette colours
 * with solid lines and round markers, then the same colours dashed with square markers, then dotted with diamonds.
 * Past the eighth series colour is therefore never the only cue, and since the index comes from the series'
 * identity (not its rank), a series keeps its style when others are filtered out.
 */
export function seriesStyle(index: number): { color: string; dash: string; symbol: string } {
  const tier = Math.min(Math.floor(index / CATEGORICAL_COLORS.length), LINE_DASHES.length - 1);
  return {
    color: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length],
    dash: LINE_DASHES[tier],
    symbol: MARKER_SYMBOLS[tier],
  };
}
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
/** Fill of the depth-vs-breadth bubbles: slot 1, translucent so that overlapping bubbles stay visible. */
export const BUBBLE_FILL = 'rgba(42, 120, 214, 0.75)';
/** Fill of an empty heatmap cell (no data), one step off the surface, so the grid's columns stay traceable. */
export const EMPTY_CELL = '#f3f2ee';
/** Status colours, reserved for pass/warning and always shown with an icon and text. */
export const STATUS_COLORS = { pass: '#0ca30c', warn: '#fab219' } as const;
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
const ratioFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 });

/** 364.6K, 881.4M. */
export const formatCompact = (value: number): string => compactFormat.format(value);
/** 364,627. */
export const formatCount = (value: number): string => fullFormat.format(value);

/** A ratio to three significant digits: 0.0134, 2.21, 16.5. */
export const formatRatio = (value: number): string => ratioFormat.format(value);

/** A share as a percentage: whole percents, with one decimal below 10%, and "<0.1%" for tiny non-zero shares. */
export function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent === 0) return '0%';
  if (percent < 0.05) return '<0.1%';
  // Round before choosing the precision, so 9.97% reads "10%" rather than "10.0%".
  return Math.round(percent * 10) / 10 < 10 ? `${percent.toFixed(1)}%` : `${percent.toFixed(0)}%`;
}

/** A share as a percentage to two significant digits, however small, for log axes: 50%, 6.1%, 0.13%, 0.0042%. */
export const formatPercentSignificant = (fraction: number): string =>
  `${Number((fraction * 100).toPrecision(2))}%`;

/** A share rounded down to one decimal, so that a share short of 100% never reads "100%": 55.4%, 99.9%, 100%. */
export const formatPercentDown = (fraction: number): string =>
  fraction >= 1 ? '100%' : `${(Math.floor(fraction * 1000) / 10).toFixed(1)}%`;

/** "1 code", "3 codes". */
const plural = (count: number, one: string, many: string): string =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** The date part of an ISO timestamp (`2026-11-04T22:16:51` -> `2026-11-04`). */
export const formatDate = (iso: string | null): string =>
  iso ? (/^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0] ?? iso) : '—';

/**
 * Ticks for a log axis spanning [min, max], labelled compactly: powers of ten, or with `multipliers` such as
 * [1, 3] also 3, 30, 300, ... for an axis that spans only a decade or two.
 */
export function logTicks(
  min: number,
  max: number,
  multipliers: readonly number[] = [1]
): { tickvals: number[]; ticktext: string[] } {
  const tickvals: number[] = [];
  for (let exp = Math.floor(Math.log10(min)); exp <= Math.ceil(Math.log10(max)); exp++) {
    // Rounded to 12 significant digits, so 3 x 0.1 is 0.3 rather than 0.30000000000000004.
    for (const multiplier of multipliers) tickvals.push(Number((multiplier * 10 ** exp).toPrecision(12)));
  }
  // Below 1, compact notation would round 0.01 to "0".
  return {
    tickvals,
    ticktext: tickvals.map(value => (value < 1 ? formatRatio(value) : formatCompact(value))),
  };
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

/** The measures drawn side by side for each dataset, in legend (and colour) order. */
export const SIZE_BAR_METRICS: SizeMetric[] = ['events', 'measurements', 'uniqueCodes'];

/**
 * The size chart's order: the most measurements first. A dataset whose file lacks the count (or can't be read)
 * goes last; ties go by name, A–Z.
 */
export function sortByMeasurements<T extends Pick<EtlStatsEntry, 'label' | 'stats'>>(items: T[]): T[] {
  // Counts are never negative, so -1 puts a missing count last.
  const count = (item: T) => item.stats?.counts.measurements ?? -1;
  return [...items].sort((a, b) => count(b) - count(a) || a.label.localeCompare(b.label));
}

const lowerLabel = (metric: SizeMetric): string =>
  (SIZE_METRICS.find(m => m.key === metric) as (typeof SIZE_METRICS)[number]).label.toLowerCase();

/**
 * Events, measurements and unique codes per dataset as grouped bars on one log axis, the most measurements first.
 * A dataset missing one of the counts keeps its other bars and is noted; one missing all three is left out. The
 * table lists all four counts, subjects included, in the same order as the chart.
 */
export function sizeChart(entries: EtlStatsEntry[]): ChartModel {
  const { drawn, skipped } = partition<{ stats: EtlStats; missing: SizeMetric[] }>(entries, stats => {
    const missing = SIZE_BAR_METRICS.filter(metric => stats.counts[metric] === null);
    if (missing.length === SIZE_BAR_METRICS.length) {
      return { skip: 'Its stats file has no event, measurement or unique-code counts.' };
    }
    return { stats, missing };
  });
  const sorted = sortByMeasurements(drawn.map(d => ({ label: d.entry.label, ...d.value })));
  for (const { label, missing } of sorted) {
    if (missing.length > 0) {
      skipped.push({
        label,
        reason: `Its stats file has no ${missing.map(lowerLabel).join(' or ')} count, so that bar is missing.`,
      });
    }
  }

  const table: TableView = {
    columns: ['Dataset', ...SIZE_METRICS.map(m => m.label)],
    rows: sortByMeasurements(
      entries.filter((entry): entry is EtlStatsEntry & { stats: EtlStats } => entry.stats !== null)
    ).map(({ label, stats }) => [
      label,
      ...SIZE_METRICS.map(m => {
        const value = stats.counts[m.key];
        return value === null ? '—' : formatCount(value);
      }),
    ]),
  };
  if (sorted.length === 0) return { figure: null, skipped, table };

  const labels = sorted.map(entry => entry.label);
  const allValues: number[] = [];
  const data = SIZE_BAR_METRICS.map((metric, i) => {
    const meta = SIZE_METRICS.find(m => m.key === metric) as (typeof SIZE_METRICS)[number];
    const values = sorted.map(entry => entry.stats.counts[metric]);
    allValues.push(...values.filter((value): value is number => value !== null));
    return trace({
      type: 'bar',
      orientation: 'h',
      name: meta.label,
      y: labels,
      x: values,
      text: values.map(value => (value === null ? '' : formatCompact(value))),
      textposition: 'outside',
      textfont: { color: INK.primary, size: 11 },
      cliponaxis: false,
      marker: { color: SERIES_COLORS[i], cornerradius: 3 },
      customdata: values.map(value => (value === null ? '—' : formatCount(value))),
      hovertemplate: `%{y}<br>${meta.label}: %{customdata}<extra></extra>`,
    });
  });

  return {
    figure: {
      data,
      layout: baseLayout(sorted.length * 2.2, {
        ...TOP_LEGEND,
        barmode: 'group',
        bargap: 0.25,
        bargroupgap: 0.08,
        margin: { ...MARGIN, t: 32, r: 56 },
        xaxis: valueAxis(allValues, 'Count'),
      }),
    },
    skipped,
    table,
  };
}

// ─── 2. Depth vs. breadth ───────────────────────────────────────

/**
 * Where a label goes, in pixels from its point (y down): the direction it lies in (`ux`, `uy`, each -1, 0 or 1), the
 * offset of its nearest edge or corner (`edgeX`, `edgeY`), the offset of its centre (`dx`, `dy`), and whether a
 * leader line joins it to its point.
 */
export interface LabelPlacement {
  ux: number;
  uy: number;
  edgeX: number;
  edgeY: number;
  dx: number;
  dy: number;
  leader: boolean;
}

export interface LabelledPoint {
  /** Pixel position in the plot area (y down). */
  x: number;
  y: number;
  /** Radius of the point's marker, in pixels. */
  r: number;
  /** Size of its label, in pixels. */
  width: number;
  height: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Clearance between a label and anything else, in pixels. */
const LABEL_PAD = 2;
/** Right, left, above, below, then the diagonals: the order in which label positions are tried. */
const LABEL_DIRECTIONS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];
/** How far past the marker a label may be pushed; beyond the first, a leader line joins it to its point. */
const LABEL_REACH = [0, 18, 36, 54];

const boxesOverlap = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 + LABEL_PAD && b.x0 < a.x1 + LABEL_PAD && a.y0 < b.y1 + LABEL_PAD && b.y0 < a.y1 + LABEL_PAD;

const boxHitsCircle = (box: Box, x: number, y: number, r: number): boolean => {
  const nearestX = Math.min(Math.max(x, box.x0), box.x1);
  const nearestY = Math.min(Math.max(y, box.y0), box.y1);
  return (nearestX - x) ** 2 + (nearestY - y) ** 2 < (r + LABEL_PAD) ** 2;
};

/**
 * Places a label beside each point so that no label overlaps another label, any point's marker, or the edge of the
 * plot. Each label takes the first free position: next to its marker on the right, left, top or bottom, or
 * diagonally; failing that, further out with a leader line. A label with no free position gets null (the page
 * leaves it off; its point keeps its hover and its row in the table). Labels are placed in the order given.
 */
export function placeLabels(
  points: LabelledPoint[],
  plot: { width: number; height: number }
): (LabelPlacement | null)[] {
  const placed: Box[] = [];
  return points.map(point => {
    for (const reach of LABEL_REACH) {
      for (const [ux, uy] of LABEL_DIRECTIONS) {
        const diagonal = ux !== 0 && uy !== 0 ? Math.SQRT1_2 : 1;
        const distance = (point.r + reach) * diagonal + LABEL_PAD;
        const [edgeX, edgeY] = [ux * distance, uy * distance];
        const dx = edgeX + (ux * point.width) / 2;
        const dy = edgeY + (uy * point.height) / 2;
        const box = {
          x0: point.x + dx - point.width / 2,
          x1: point.x + dx + point.width / 2,
          y0: point.y + dy - point.height / 2,
          y1: point.y + dy + point.height / 2,
        };
        const free =
          box.x0 >= 0 &&
          box.y0 >= 0 &&
          box.x1 <= plot.width &&
          box.y1 <= plot.height &&
          points.every(other => !boxHitsCircle(box, other.x, other.y, other.r)) &&
          placed.every(other => !boxesOverlap(box, other));
        if (free) {
          placed.push(box);
          return { ux, uy, edgeX, edgeY, dx, dy, leader: reach > 0 };
        }
      }
    }
    return null;
  });
}

/** Phone-sized screens get smaller bubbles, and their labels are laid out for a narrow plot. */
export interface ScreenOptions {
  narrow: boolean;
}

const SCATTER = {
  height: 460,
  margin: { l: 64, r: 16, t: 12, b: 52 },
  /**
   * The plot-area width the labels are laid out for: no wider than the plot is at that screen size, so labels that
   * clear each other here clear each other on the page, where the points sit further apart.
   */
  plotWidth: { wide: 560, narrow: 260 },
  /** Bubble diameters in pixels: the dataset with the most codes gets `max`; none is smaller than `min`. */
  bubble: { wide: { max: 56, min: 8 }, narrow: { max: 40, min: 8 } },
  font: 12,
  /** A generous estimate of the label font's character width (labels are mostly capitals). */
  charWidth: 7.5,
  lineHeight: 16,
};

export interface BubbleChartModel extends ChartModel {
  /** Reference bubbles for a size legend, with their diameter in pixels. */
  sizeKey: { label: string; diameter: number }[];
  /** How bubble size maps to unique codes. */
  sizeNote: string;
  /** Datasets whose label had to be left off to avoid overlaps. */
  unlabelled: string[];
}

/** A log axis range covering [min, max] (at least a decade) with room for `pad` pixels on both sides. */
function paddedLogRange(min: number, max: number, pad: number, pixels: number): [number, number] {
  let lo = Math.log10(min);
  let hi = Math.log10(max);
  if (hi - lo < 1) {
    const mid = (lo + hi) / 2;
    [lo, hi] = [mid - 0.5, mid + 0.5];
  }
  const margin = (pad * (hi - lo)) / (pixels - 2 * pad);
  return [lo - margin, hi + margin];
}

/** Log-axis ticks for a range given in powers of ten, with intermediate ticks on a short axis. */
function rangeTicks([lo, hi]: [number, number]): { tickvals: number[]; ticktext: string[] } {
  return logTicks(10 ** lo, 10 ** hi, hi - lo < 2.5 ? [1, 3] : [1]);
}

/**
 * One bubble per dataset: how many subjects it has (x) against how much data a typical subject has (y, the median
 * measurements per subject), with the bubble's area proportional to the dataset's number of distinct codes. Both
 * axes are logarithmic. Labels are placed so that none overlap (see `placeLabels`).
 */
export function depthBreadthChart(entries: EtlStatsEntry[], { narrow }: ScreenOptions): BubbleChartModel {
  type Bubble = { subjects: number; median: number; uniqueCodes: number };
  const { drawn, skipped } = partition<Bubble>(orderDatasets(entries), (stats, entry) => {
    const { subjects, uniqueCodes } = stats.counts;
    const dist = stats.perSubject.measurements;
    if (subjects === null) return { skip: 'Its stats file has no subject count.' };
    if (uniqueCodes === null) return { skip: 'Its stats file has no unique-code count.' };
    if (!dist) return { skip: 'Its stats file has no per-subject measurement distribution.' };
    if (dist.suppressed) {
      return { skip: `Suppressed: the median is withheld because it rests on ${floorPhrase(entry)}.` };
    }
    if (subjects <= 0 || dist.p50 <= 0) {
      return { skip: 'It has no subjects or no measurements, which a logarithmic axis cannot show.' };
    }
    return { subjects, median: dist.p50, uniqueCodes };
  });
  const table: TableView = {
    columns: ['Dataset', 'Subjects', 'Median measurements per subject', 'Unique codes'],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      formatCount(value.subjects),
      formatCount(value.median),
      formatCount(value.uniqueCodes),
    ]),
  };
  const empty = { figure: null, skipped, table, sizeKey: [], sizeNote: '', unlabelled: [] };
  if (drawn.length === 0) return empty;

  const screen = narrow ? 'narrow' : 'wide';
  const bubble = SCATTER.bubble[screen];
  const maxCodes = Math.max(...drawn.map(d => d.value.uniqueCodes), 1);
  const diameter = (codes: number) => Math.max(bubble.min, bubble.max * Math.sqrt(codes / maxCodes));
  // In the page's order (largest first), which is also the order in which their labels are placed.
  const points = drawn.map(({ entry, value }) => ({
    label: entry.label,
    ...value,
    diameter: diameter(value.uniqueCodes),
  }));
  // Bubbles are drawn largest first, so that small ones stay on top and can be hovered.
  const bubbles = [...points].sort((a, b) => b.diameter - a.diameter);

  const width = SCATTER.plotWidth[screen];
  const height = SCATTER.height - SCATTER.margin.t - SCATTER.margin.b;
  const pad = bubble.max / 2 + 4;
  const xRange = paddedLogRange(
    Math.min(...points.map(p => p.subjects)),
    Math.max(...points.map(p => p.subjects)),
    pad,
    width
  );
  const yRange = paddedLogRange(
    Math.min(...points.map(p => p.median)),
    Math.max(...points.map(p => p.median)),
    pad,
    height
  );
  const toPixels = (value: number, [lo, hi]: [number, number], pixels: number) =>
    ((Math.log10(value) - lo) / (hi - lo)) * pixels;
  const placements = placeLabels(
    points.map(p => ({
      x: toPixels(p.subjects, xRange, width),
      y: height - toPixels(p.median, yRange, height),
      r: p.diameter / 2,
      width: p.label.length * SCATTER.charWidth,
      height: SCATTER.lineHeight,
    })),
    { width, height }
  );
  const annotations = points.flatMap((p, i) => {
    const place = placements[i];
    if (!place) return [];
    const common = {
      x: Math.log10(p.subjects),
      y: Math.log10(p.median),
      text: p.label,
      font: { color: INK.primary, size: SCATTER.font },
    };
    return [
      place.leader
        ? {
            ...common,
            showarrow: true,
            arrowhead: 0,
            arrowwidth: 1,
            arrowcolor: INK.muted,
            ax: place.dx,
            ay: place.dy,
            standoff: p.diameter / 2,
          }
        : {
            // Anchored at the edge nearest the point, so the gap to the bubble doesn't depend on the text's width.
            ...common,
            showarrow: false,
            xanchor: ['right', 'center', 'left'][place.ux + 1],
            yanchor: ['bottom', 'middle', 'top'][place.uy + 1],
            xshift: place.edgeX,
            yshift: -place.edgeY,
          },
    ];
  });

  // Reference sizes for the legend: the powers of ten below the largest count whose bubble is clearly visible
  // (at most two, since each power of ten is a third of the diameter of the next).
  const sizeKey: BubbleChartModel['sizeKey'] = [];
  for (let codes = 10 ** Math.floor(Math.log10(maxCodes)); codes >= 1; codes /= 10) {
    if (diameter(codes) >= 12)
      sizeKey.push({ label: `${formatCompact(codes)} codes`, diameter: diameter(codes) });
  }
  const floorCodes = maxCodes * (bubble.min / bubble.max) ** 2;
  const atFloor = points.some(p => p.uniqueCodes < floorCodes);

  return {
    figure: {
      data: [
        trace({
          type: 'scatter',
          mode: 'markers',
          x: bubbles.map(p => p.subjects),
          y: bubbles.map(p => p.median),
          text: bubbles.map(p => p.label),
          marker: {
            size: bubbles.map(p => p.diameter),
            sizemode: 'diameter',
            color: BUBBLE_FILL,
            line: { color: '#ffffff', width: 1.5 },
          },
          customdata: bubbles.map(p => [p.subjects, p.median, p.uniqueCodes].map(formatCount)),
          hovertemplate:
            '%{text}<br>Subjects: %{customdata[0]}<br>Median measurements per subject: %{customdata[1]}' +
            '<br>Unique codes: %{customdata[2]}<extra></extra>',
        }),
      ],
      layout: baseLayout(0, {
        height: SCATTER.height,
        margin: { ...SCATTER.margin },
        hovermode: 'closest',
        annotations,
        xaxis: {
          type: 'log',
          range: xRange,
          ...rangeTicks(xRange),
          title: { text: 'Subjects (log scale)' },
        },
        yaxis: {
          type: 'log',
          autorange: false,
          range: yRange,
          ...rangeTicks(yRange),
          gridcolor: INK.grid,
          tickfont: { color: INK.muted },
          title: { text: 'Median measurements per subject (log scale)' },
        },
      } as Partial<Layout>),
    },
    skipped,
    table,
    sizeKey,
    sizeNote:
      'Bubble area is proportional to the number of unique codes.' +
      (atFloor
        ? ` Datasets with fewer than about ${formatCompact(Math.ceil(floorCodes))} codes are drawn at the smallest size, so they stay visible.`
        : ''),
    unlabelled: points.filter((_, i) => placements[i] === null).map(p => p.label),
  };
}

// ─── 3. Per-subject distributions ───────────────────────────────

export type PerSubjectMetric = 'measurements' | 'events' | 'uniqueCodes' | 'spanDays';

export const PER_SUBJECT_METRICS: { key: PerSubjectMetric; label: string; axis: string }[] = [
  { key: 'measurements', label: 'Measurements', axis: 'Measurements per subject' },
  { key: 'events', label: 'Events', axis: 'Events per subject' },
  { key: 'uniqueCodes', label: 'Unique codes', axis: 'Distinct codes per subject' },
  { key: 'spanDays', label: 'Record span', axis: 'Days from first to last event per subject' },
];

/** Which per-subject distribution a box chart draws, and how. */
interface DistributionSpec {
  pick: (stats: EtlStats) => Distribution | null | undefined;
  /** Why a dataset whose file lacks the distribution is left out. */
  missing: string;
  /** Why a dataset whose quantiles are withheld is left out, if not the file's general suppression floor. */
  suppressed?: string;
  /** Who `n` counts, for the table and hover: "Subjects", or e.g. only the subjects with a rate. */
  subjects: string;
  axis: string;
  /** Formats its values: counts in full, rates to three significant digits. */
  format: (value: number) => string;
  /** Whether datasets are ranked by their median, largest first, rather than listed largest dataset first. */
  ranked: boolean;
}

/**
 * Box-style summaries drawn from the published quantiles: the box spans the 25th to 75th percentile, the line
 * inside it is the median, and the whiskers reach the 5th and 95th percentiles (there are no minima or maxima:
 * `meds_summary_stats` never publishes extremes).
 */
function distributionChart(entries: EtlStatsEntry[], spec: DistributionSpec): ChartModel {
  const { drawn, skipped } = partition(orderDatasets(entries), (stats, entry) => {
    const dist = spec.pick(stats);
    if (!dist) return { skip: spec.missing };
    if (dist.suppressed) {
      return {
        skip:
          spec.suppressed ??
          `Suppressed: the quantiles are withheld because they rest on ${floorPhrase(entry)}.`,
      };
    }
    return dist;
  });
  // A stable sort, so datasets with the same median stay largest first.
  if (spec.ranked) drawn.sort((a, b) => b.value.p50 - a.value.p50);
  const { format } = spec;
  const table: TableView = {
    columns: ['Dataset', spec.subjects, '5th pct.', '25th pct.', 'Median', '75th pct.', '95th pct.'],
    rows: drawn.map(({ entry, value }) => [
      entry.label,
      formatCount(value.n),
      ...[value.p5, value.p25, value.p50, value.p75, value.p95].map(format),
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
          customdata: dists.map(d => [...[d.p5, d.p25, d.p50, d.p75, d.p95].map(format), formatCount(d.n)]),
          hovertemplate:
            '%{y}<br>Median: %{customdata[2]}<br>25th–75th percentile: %{customdata[1]}–%{customdata[3]}' +
            '<br>5th–95th percentile: %{customdata[0]}–%{customdata[4]}<br>' +
            `${spec.subjects}: %{customdata[5]}<extra></extra>`,
        }),
      ],
      layout: baseLayout(drawn.length, {
        xaxis: valueAxis([...pick('p5'), ...pick('p95')], spec.axis),
      }),
    },
    skipped,
    table,
  };
}

/** How much data each subject has, as one box per dataset, largest dataset first. */
export function perSubjectChart(entries: EtlStatsEntry[], metric: PerSubjectMetric): ChartModel {
  const meta = PER_SUBJECT_METRICS.find(m => m.key === metric) as (typeof PER_SUBJECT_METRICS)[number];
  return distributionChart(entries, {
    pick: stats => stats.perSubject[metric],
    missing: `Its stats file has no per-subject ${meta.label.toLowerCase()} distribution.`,
    axis: meta.axis,
    subjects: 'Subjects',
    format: formatCount,
    ranked: false,
  });
}

// ─── 4. Pace of measurements ────────────────────────────────────

export type PaceMetric = 'perDay' | 'perEvent';

/** `label` for the toggle; `full` for the table, the hover and the axis. */
export const PACE_METRICS: { key: PaceMetric; label: string; full: string }[] = [
  { key: 'perDay', label: 'Per day, per subject', full: 'Measurements per day, per subject' },
  { key: 'perEvent', label: 'Per event', full: 'Measurements per event' },
];

/**
 * How densely each dataset records data, largest first. "Per day, per subject" is the spread of each subject's own
 * rate, `per_subject.measurements_per_day`, drawn as boxes from its published quantiles like `perSubjectChart`
 * (older stats files don't have it). Very short records give very large rates, which skew the mean, so the mean is
 * never drawn. Only subjects with a rate (two or more distinct timestamps) are counted, and their quantiles are
 * withheld below `min_numeric_cell_size`, which the page doesn't read, so that note names no number. "Per event"
 * divides the dataset's measurements by its events, which is exact, as one bar per dataset.
 */
export function paceChart(entries: EtlStatsEntry[], metric: PaceMetric): ChartModel {
  const meta = PACE_METRICS.find(m => m.key === metric) as (typeof PACE_METRICS)[number];
  if (metric === 'perDay') {
    const missing =
      'Its stats file has no per-subject measurements per day, which newer versions of meds_summary_stats publish.';
    const model = distributionChart(entries, {
      pick: stats => stats.perSubject.measurementsPerDay,
      missing,
      suppressed: 'Suppressed: too few subjects have a rate, so its quantiles are withheld.',
      subjects: 'Subjects with a rate',
      // Short enough for a phone; the boxes and the toggle say it is per subject.
      axis: 'Measurements per day',
      format: formatRatio,
      ranked: true,
    });
    // Until every ETL re-runs a newer meds_summary_stats, many files lack the rate: one note for all of them.
    const older = model.skipped.filter(s => s.reason === missing);
    if (older.length < 2) return model;
    return {
      ...model,
      skipped: [
        {
          label: older.map(s => s.label).join(', '),
          reason:
            'Their stats files have no per-subject measurements per day, which newer versions of meds_summary_stats publish.',
        },
        ...model.skipped.filter(s => s.reason !== missing),
      ],
    };
  }
  const { drawn, skipped } = partition<{ value: number; inputs: [number, number] }>(
    orderDatasets(entries),
    stats => {
      const { measurements, events } = stats.counts;
      const value = ratio(measurements, events);
      if (value === null) return { skip: 'Its stats file has no measurement or event count.' };
      return { value, inputs: [measurements as number, events as number] };
    }
  );
  const ranked = [...drawn].sort((a, b) => b.value.value - a.value.value);
  const table: TableView = {
    columns: ['Dataset', 'Measurements', 'Events', meta.full],
    rows: ranked.map(({ entry, value }) => [
      entry.label,
      ...value.inputs.map(formatCount),
      formatRatio(value.value),
    ]),
  };
  if (ranked.length === 0) return { figure: null, skipped, table };

  const values = ranked.map(d => d.value.value);
  return {
    figure: {
      data: [
        trace({
          type: 'bar',
          orientation: 'h',
          y: ranked.map(d => d.entry.label),
          x: values,
          text: values.map(formatRatio),
          textposition: 'outside',
          textfont: { color: INK.primary },
          cliponaxis: false,
          marker: { color: SERIES_COLORS[0], cornerradius: 4 },
          hovertemplate: `%{y}<br>${meta.full}: %{text}<extra></extra>`,
        }),
      ],
      layout: baseLayout(ranked.length, {
        bargap: 0.35,
        margin: { ...MARGIN, r: 48 },
        xaxis: { title: { text: meta.full }, rangemode: 'tozero' },
      }),
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

// ─── 6. The tail of codes ───────────────────────────────────────

export interface CodeTailPoint {
  /** The number of most frequent codes, N. */
  codes: number;
  /** The share of all measurements whose code is not among the N most frequent: one minus the share they cover. */
  remaining: number;
  /** What the point says, for the hover label. */
  text: string;
}

/** One minus a share, rounded to 12 significant digits so that 1 - 0.9 is 0.1 rather than 0.09999999999999998. */
const complement = (share: number): number => Number((1 - share).toPrecision(12));

/**
 * The points of a dataset's code-tail curve, by number of codes N, each with the share of measurements left outside
 * the N most frequent codes: from the shares its 10, 100 and 1,000 most frequent codes cover, and from how many
 * codes it takes to cover 50%, 90% and 99% (which leave 50%, 10% and 1% outside). Points that leave nothing
 * outside have no place on a logarithmic axis and are dropped, as are points beyond the dataset's number of codes
 * (its 1,000 most frequent codes are all its codes if it has fewer).
 */
export function codeTailPoints(
  concentration: NonNullable<EtlStats['concentration']>,
  uniqueCodes: number | null
): CodeTailPoint[] {
  type Candidate = { codes: number | null; remaining: number | null; text: (codes: number) => string };
  const top = (codes: number, share: number | null): Candidate => {
    const remaining = share === null ? null : complement(share);
    return {
      codes,
      remaining,
      text: n =>
        `${formatPercentSignificant(remaining as number)} of measurements fall outside the ${formatCount(n)} most frequent codes`,
    };
  };
  const covering = (codes: number | null, share: number): Candidate => ({
    codes,
    remaining: complement(share),
    text: n =>
      `It takes the ${formatCount(n)} most frequent codes to cover ${formatPercent(share)} of measurements, ` +
      `leaving ${formatPercentSignificant(complement(share))} outside them`,
  });
  const c = concentration;
  const candidates: Candidate[] = [
    top(10, c.top10),
    top(100, c.top100),
    top(1000, c.top1000),
    covering(c.codesFor50, 0.5),
    covering(c.codesFor90, 0.9),
    covering(c.codesFor99, 0.99),
  ];
  const points: CodeTailPoint[] = [];
  for (const { codes, remaining, text } of candidates) {
    if (codes === null || remaining === null || codes <= 0 || remaining <= 0) continue;
    if (uniqueCodes !== null && codes > uniqueCodes) continue;
    points.push({ codes, remaining, text: text(codes) });
  }
  return points.sort((a, b) => a.codes - b.codes || b.remaining - a.remaining);
}

/** Heights of the tail plot, in pixels. */
const CODE_TAIL_HEIGHT = { wide: 460, narrow: 700 };

export interface CodeTailModel extends ChartModel {
  /** The datasets that can be highlighted, in the page's order. */
  options: string[];
  /** The dataset drawn emphasised, with the others faded; null when none is (every curve drawn alike). */
  highlighted: string | null;
}

/**
 * A tail plot: one curve per dataset of the share of measurements outside its N most frequent codes, against N,
 * both on log axes, as in a plot of a power law. A straight, falling line means code frequencies fall off as a power
 * of their rank, as in Zipf's law (a slope of -a means a frequency proportional to rank^-(a+1)); the steeper it falls,
 * the more the data concentrates in its most frequent codes. No line is fitted, and no reference slope is drawn: on
 * these axes classic Zipf (rank^-1) is not a straight line, and a slope-only guide would add a line to 15 curves.
 * Every dataset has its own colour, line dash and marker (`seriesStyle`), assigned alphabetically over
 * `identityLabels` (pass every dataset's label, including ones filtered out) so that toggling datasets never repaints
 * the others. Optionally one dataset is highlighted: drawn thicker and on top, with the others faded.
 */
export function codeTailChart(
  entries: EtlStatsEntry[],
  highlight: string | null,
  identityLabels: string[] = [],
  { narrow }: ScreenOptions = { narrow: false }
): CodeTailModel {
  type Curve = {
    points: CodeTailPoint[];
    concentration: NonNullable<EtlStats['concentration']>;
    uniqueCodes: number | null;
  };
  const { drawn, skipped } = partition<Curve>(orderDatasets(entries), stats => {
    const c = stats.concentration;
    if (!c || Object.values(c).every(value => value === null)) {
      return { skip: 'Its stats file has no code-concentration figures.' };
    }
    const points = codeTailPoints(c, stats.counts.uniqueCodes);
    if (points.length === 0) {
      return {
        skip: 'Its most frequent codes leave no measurements outside them, which a logarithmic axis cannot show.',
      };
    }
    return { points, concentration: c, uniqueCodes: stats.counts.uniqueCodes };
  });
  const outside = (share: number | null) =>
    share === null ? '—' : formatPercentSignificant(complement(share));
  const count = (value: number | null) => (value === null ? '—' : formatCount(value));
  const table: TableView = {
    columns: [
      'Dataset',
      'Outside the top 10 codes',
      'Outside the top 100',
      'Outside the top 1,000',
      'Codes to cover 50%',
      'Codes to cover 90%',
      'Codes to cover 99%',
      'Unique codes',
    ],
    rows: drawn.map(({ entry, value: { concentration: c, uniqueCodes } }) => [
      entry.label,
      outside(c.top10),
      outside(c.top100),
      outside(c.top1000),
      count(c.codesFor50),
      count(c.codesFor90),
      count(c.codesFor99),
      count(uniqueCodes),
    ]),
  };
  const options = drawn.map(d => d.entry.label);
  if (drawn.length === 0) return { figure: null, skipped, table, options, highlighted: null };

  const highlighted = highlight !== null && options.includes(highlight) ? highlight : null;
  const identity = [...new Set([...identityLabels, ...options])].sort((a, b) => a.localeCompare(b));
  const curves = drawn
    .map(d => ({ ...d, index: identity.indexOf(d.entry.label) }))
    .sort((a, b) => a.index - b.index);
  // The highlighted curve is drawn last, so it sits on top; legend ranks keep the legend in identity order.
  const drawOrder = highlighted
    ? [
        ...curves.filter(c => c.entry.label !== highlighted),
        ...curves.filter(c => c.entry.label === highlighted),
      ]
    : curves;
  const allCodes = drawn.flatMap(d => d.value.points.map(p => p.codes));
  const allRemaining = drawn.flatMap(d => d.value.points.map(p => p.remaining));
  // Powers of ten from just below the smallest share left outside up to 100%, the share outside no codes at all.
  const yLow = Math.log10(Math.min(...allRemaining)) - 0.15;
  const yTicks: number[] = [];
  for (let exp = Math.ceil(yLow); exp <= 0; exp++) yTicks.push(10 ** exp);
  return {
    figure: {
      data: drawOrder.map(({ entry, value, index }) => {
        const style = seriesStyle(index);
        const emphasised = entry.label === highlighted;
        return trace({
          type: 'scatter',
          mode: 'lines+markers',
          name: entry.label,
          legendrank: index + 1,
          x: value.points.map(p => p.codes),
          y: value.points.map(p => p.remaining),
          text: value.points.map(() => entry.label),
          customdata: value.points.map(p => p.text),
          hovertemplate: '%{text}<br>%{customdata}<extra></extra>',
          opacity: highlighted && !emphasised ? 0.25 : 1,
          line: { color: style.color, width: emphasised ? 3.5 : 2, dash: style.dash },
          marker: {
            color: style.color,
            symbol: style.symbol,
            size: emphasised ? 10 : 8,
            line: { color: '#ffffff', width: 1.5 },
          },
        });
      }),
      layout: baseLayout(0, {
        ...TOP_LEGEND,
        // On a phone the legend takes a line per dataset, and Plotly lets a legend above the plot take up to half
        // the figure before it scrolls: a taller figure keeps both the legend and the plot whole.
        height: narrow ? CODE_TAIL_HEIGHT.narrow : CODE_TAIL_HEIGHT.wide,
        margin: { ...MARGIN, t: 32, b: 48 },
        hovermode: 'closest',
        xaxis: {
          type: 'log',
          ...logTicks(Math.min(...allCodes), Math.max(...allCodes)),
          title: { text: 'Number of most frequent codes, N (log scale)' },
        },
        yaxis: {
          type: 'log',
          autorange: false,
          range: [yLow, 0.05],
          tickvals: yTicks,
          ticktext: yTicks.map(formatPercentSignificant),
          gridcolor: INK.grid,
          tickfont: { color: INK.muted },
          title: { text: 'Share outside the top N (log scale)' },
        },
      }),
    },
    skipped,
    table,
    options,
    highlighted,
  };
}

// ─── 7. Mapping to vocabularies ─────────────────────────────────

/** Shares are shaded on a log scale from this share (0.01%) to 100%, so that small vocabularies still show. */
const VOCABULARY_SHADE_FLOOR = 1e-4;
/** The narrowest a heatmap column can be with its share legible, in pixels. */
const VOCABULARY_COLUMN_WIDTH = 44;
/** The empty column that sets the mapping columns apart from the vocabularies. */
const VOCABULARY_SPACER = ' ';

/** The vocabulary heatmap prints every share in its cells, so it has no separate table. */
export interface VocabularyModel {
  figure: Figure | null;
  skipped: Skipped[];
  /** The narrowest the heatmap can be with legible columns; narrower screens scroll it sideways. */
  minWidth: number;
  /** Whether any column is marked as a standard OMOP vocabulary. */
  anyRecognized: boolean;
}

/** The marker after a vocabulary's name that `meds_summary_stats` recognises as an OMOP CDM vocabulary. */
export const OMOP_MARK = '*';

/**
 * The columns before the vocabularies: how much of a dataset maps into any vocabulary at all. Each measurement and
 * code counts once here, however many vocabularies it maps into.
 */
export const MAPPING_COLUMNS = [
  { key: 'measurementsMapped', label: 'Any vocabulary', of: 'of measurements map to a vocabulary' },
  { key: 'codesWithParents', label: 'Codes with a parent', of: 'of the distinct codes have a parent code' },
] as const;

/** A row's text in place of vocabulary cells, when it has none. */
export const NO_MAPPING = 'No vocabulary mapping';

/**
 * Every dataset's mapping of codes to external vocabularies, through the parent codes in its code metadata, as one
 * heatmap. The first columns give the share of measurements mapped to any vocabulary and the share of distinct
 * codes with a parent code, each counted once. Then, after a gap, one column per vocabulary gives the share of
 * measurements whose code has a parent in it. A code can map into several vocabularies, so a row's vocabulary
 * shares can add up to more than its share mapped to any. Vocabularies used by the most datasets come first. A
 * dataset whose code metadata maps no codes is a row of 0% with a note in place of vocabulary cells.
 */
export function vocabularyChart(entries: EtlStatsEntry[]): VocabularyModel {
  type Row = { ontology: EtlStats['ontology']; measurements: number | null };
  const { drawn, skipped } = partition<Row>(orderDatasets(entries), stats =>
    stats.codeMetadata
      ? { ontology: stats.ontology, measurements: stats.counts.measurements }
      : { skip: 'Its stats file does not report on its code metadata.' }
  );

  // What each row shows in place of vocabulary cells, if it has none, and notes on what is missing.
  const markers = new Map<string, string>();
  for (const { entry, value } of drawn) {
    const { ontology, measurements } = value;
    if (!ontology) {
      markers.set(entry.label, NO_MAPPING);
      continue;
    }
    const suppressed = ontology.suppressed?.cells;
    if (ontology.vocabularies.length === 0) {
      if (suppressed === undefined) {
        markers.set(entry.label, 'No named vocabulary');
        skipped.push({ label: entry.label, reason: 'Its code metadata names no vocabulary.' });
        continue;
      }
      const all =
        suppressed === null
          ? 'all its vocabularies are'
          : suppressed === 1
            ? 'its only vocabulary is'
            : `all ${formatCount(suppressed)} vocabularies are`;
      markers.set(entry.label, 'Vocabularies suppressed');
      skipped.push({
        label: entry.label,
        reason: `Suppressed: ${all} reached by ${floorPhrase(entry)}${suppressed === 1 ? '' : ' each'}.`,
      });
      continue;
    }
    if (!measurements) {
      skipped.push({
        label: entry.label,
        reason: 'Its stats file has no measurement count, so its vocabulary shares are unknown.',
      });
    }
    if (suppressed !== undefined) {
      const which =
        suppressed === null
          ? 'Some vocabularies are'
          : suppressed === 1
            ? '1 more vocabulary is'
            : `${formatCount(suppressed)} more vocabularies are`;
      skipped.push({
        label: entry.label,
        reason: `${which} suppressed, as each is reached by ${floorPhrase(entry)}, so they have no column.`,
      });
    }
  }
  if (drawn.length === 0) return { figure: null, skipped, minWidth: 0, anyRecognized: false };

  // Vocabulary columns: every vocabulary any dataset uses, the most widely used first, then by name.
  const used = new Map<string, { datasets: number; recognized: boolean }>();
  for (const { value } of drawn) {
    for (const vocabulary of value.ontology?.vocabularies ?? []) {
      const seen = used.get(vocabulary.name) ?? { datasets: 0, recognized: false };
      used.set(vocabulary.name, {
        datasets: seen.datasets + 1,
        recognized: seen.recognized || vocabulary.recognized === true,
      });
    }
  }
  const vocabularies = [...used.entries()]
    .sort(([a, x], [b, y]) => y.datasets - x.datasets || a.localeCompare(b))
    .map(([name, { recognized }]) => ({ name, recognized }));

  type Cell = { share: number | null; hover: string } | null;
  const shareText = (share: number | null) => (share === null ? 'n/a' : formatPercent(share));
  const rows: Cell[][] = drawn.map(({ value: { ontology, measurements } }) => [
    ...MAPPING_COLUMNS.map(column => {
      // Code metadata without a mapping maps nothing: 0%.
      const share = ontology ? ontology[column.key] : 0;
      return { share, hover: `${column.label}: ${shareText(share)} ${column.of}` };
    }),
    ...(vocabularies.length > 0 ? [null] : []),
    ...vocabularies.map(column => {
      const vocabulary = ontology?.vocabularies.find(v => v.name === column.name);
      if (!vocabulary) return null;
      const share =
        vocabulary.measurements === null || !measurements ? null : vocabulary.measurements / measurements;
      const name = column.recognized ? `${column.name} (a standard OMOP vocabulary)` : column.name;
      return { share, hover: `${name}: ${shareText(share)} of measurements` };
    }),
  ]);

  const x = [
    ...MAPPING_COLUMNS.map(column => column.label),
    ...(vocabularies.length > 0 ? [VOCABULARY_SPACER] : []),
    ...vocabularies.map(column => column.name),
  ];
  const y = drawn.map(d => d.entry.label);
  const tickLabels = [
    ...MAPPING_COLUMNS.map(column => `<b>${column.label}</b>`),
    ...vocabularies.map(c => (c.recognized ? `${c.name}${OMOP_MARK}` : c.name)),
  ];
  const longest = (labels: string[]) => Math.max(...labels.map(label => label.length));
  // Column labels are slanted at 45°, so they need about 0.7 of their length in height.
  const top =
    Math.ceil(longest([...MAPPING_COLUMNS.map(c => c.label), ...vocabularies.map(c => c.name)]) * 7 * 0.72) +
    16;
  // A row's marker starts at the first vocabulary column; if those can't hold it, the plot gets room on the right.
  const markerTexts = [...markers.values()];
  const right =
    8 +
    (markerTexts.length > 0
      ? Math.max(0, longest(markerTexts) * 7 + 12 - vocabularies.length * VOCABULARY_COLUMN_WIDTH)
      : 0);
  const firstVocabulary = (x.length - vocabularies.length) / x.length;
  return {
    figure: {
      data: [
        // A faint cell under every dataset and column but the gap, so that empty cells still show the grid.
        trace({
          type: 'heatmap',
          x,
          y,
          z: drawn.map(() => x.map(column => (column === VOCABULARY_SPACER ? null : 0))),
          colorscale: [
            [0, EMPTY_CELL],
            [1, EMPTY_CELL],
          ],
          showscale: false,
          xgap: 2,
          ygap: 2,
          hoverinfo: 'skip',
        }),
        trace({
          type: 'heatmap',
          x,
          y,
          z: rows.map(row =>
            row.map(cell =>
              cell === null || cell.share === null
                ? null
                : Math.log10(Math.max(cell.share, VOCABULARY_SHADE_FLOOR))
            )
          ),
          zmin: Math.log10(VOCABULARY_SHADE_FLOOR),
          zmax: 0,
          colorscale: SEQUENTIAL_BLUES,
          showscale: false,
          hoverongaps: false,
          xgap: 2,
          ygap: 2,
          text: rows.map(row => row.map(cell => (cell === null ? '' : shareText(cell.share)))),
          texttemplate: '%{text}',
          customdata: rows.map(row => row.map(cell => (cell === null ? '' : cell.hover))),
          hovertemplate: '%{y}<br>%{customdata}<extra></extra>',
        }),
      ],
      layout: baseLayout(drawn.length, {
        height: drawn.length * ROW_HEIGHT + top + 8,
        margin: { l: 8, r: right, t: top, b: 8 },
        annotations: [...markers].map(([label, text]) => ({
          xref: 'paper',
          x: firstVocabulary,
          xanchor: 'left',
          xshift: 6,
          yref: 'y',
          y: label,
          text: `<i>${text}</i>`,
          showarrow: false,
          font: { color: INK.secondary, size: 12 },
        })),
        xaxis: {
          type: 'category',
          side: 'top',
          ticks: '',
          tickangle: -45,
          tickvals: x.filter(column => column !== VOCABULARY_SPACER),
          ticktext: tickLabels,
          gridcolor: 'rgba(0,0,0,0)',
          linecolor: 'rgba(0,0,0,0)',
          tickfont: { color: INK.primary },
        },
        yaxis: { ticks: '', linecolor: 'rgba(0,0,0,0)' },
      } as Partial<Layout>),
    },
    skipped,
    minWidth: longest(y) * 7 + 24 + x.length * VOCABULARY_COLUMN_WIDTH + right - 8,
    anyRecognized: vocabularies.some(c => c.recognized),
  };
}

// ─── 8. Health check ────────────────────────────────────────────

/** `pass` and `warn` are checks; `info` is a fact without a verdict; `unknown` is a check the file can't answer. */
export type CheckStatus = 'pass' | 'warn' | 'info' | 'unknown';

export interface CheckCell {
  status: CheckStatus;
  text: string;
}

export type HealthCheckKey =
  | 'ids'
  | 'missingCodes'
  | 'numeric'
  | 'descriptions'
  | 'unusedCodes'
  | 'medsVersion'
  | 'etl';

/** Codes.parquet passes the description check when at least this share of its codes has a description. */
export const DESCRIPTION_THRESHOLD = 0.9;

export const HEALTH_CHECKS: { key: HealthCheckKey; label: string; help: string }[] = [
  {
    key: 'ids',
    label: 'Empty or null codes and subject IDs',
    help: 'Rows whose code is empty or null, or whose subject_id is null. MEDS requires both on every row, so there should be none.',
  },
  {
    key: 'missingCodes',
    label: 'Data codes missing from codes.parquet',
    help: 'Codes that occur in the data but have no row in metadata/codes.parquet. MEDS requires every code to be listed there, so there should be none.',
  },
  {
    key: 'numeric',
    label: 'Invalid numeric values',
    help: 'Numeric values that are NaN or infinite. A missing value should be null instead, so there should be none.',
  },
  {
    key: 'descriptions',
    label: 'Codes with a description',
    help: `The share of the codes in codes.parquet that have a description. It passes at ${formatPercent(DESCRIPTION_THRESHOLD)} or more and is flagged below that.`,
  },
  {
    key: 'unusedCodes',
    label: 'Listed codes not in the data',
    help: 'Codes in codes.parquet that never occur in the data. MEDS allows this, e.g. for a whole vocabulary, so it is shown as information, not as a problem.',
  },
  {
    key: 'medsVersion',
    label: 'MEDS version',
    help: 'The MEDS version that metadata/dataset.json states.',
  },
  {
    key: 'etl',
    label: 'ETL and version',
    help: 'The ETL that wrote the dataset, and its version, as metadata/dataset.json states.',
  },
];

export interface HealthCheckModel {
  rows: { label: string; cells: Record<HealthCheckKey, CheckCell> }[];
  skipped: Skipped[];
}

const pass = (text: string): CheckCell => ({ status: 'pass', text });
const warn = (text: string): CheckCell => ({ status: 'warn', text });
const info = (text: string): CheckCell => ({ status: 'info', text });
const unknown = (text: string): CheckCell => ({ status: 'unknown', text });
const NOT_REPORTED = unknown('Not reported');

/** A check of counts that should all be zero: a warning listing those that aren't, else a pass if all are known. */
function zeroCheck(counts: [number | null, string, string][]): CheckCell {
  const found = counts.filter((c): c is [number, string, string] => c[0] !== null && c[0] > 0);
  if (found.length > 0) return warn(found.map(([count, one, many]) => plural(count, one, many)).join(', '));
  return counts.some(([count]) => count === null) ? NOT_REPORTED : pass('None');
}

/** A check about codes.parquet, or why it can't be made. */
function codeMetadataCheck(
  codeMetadata: EtlStats['codeMetadata'],
  withoutFile: CheckCell,
  check: (codeMetadata: NonNullable<EtlStats['codeMetadata']>) => CheckCell
): CheckCell {
  if (!codeMetadata) return NOT_REPORTED;
  return codeMetadata.present ? check(codeMetadata) : withoutFile;
}

const NO_CODES_FILE = 'No codes.parquet';

/**
 * A scorecard of invariants every MEDS dataset should meet, one row per dataset: each cell passes, warns, or says
 * the file doesn't report it. The versions and the codes listed but unused are information, without a verdict.
 */
export function healthCheck(entries: EtlStatsEntry[]): HealthCheckModel {
  const { drawn, skipped } = partition(orderDatasets(entries), (stats, entry) => {
    const { checks, codeMetadata: cm } = stats;
    const etl = [entry.dataset?.etlName, entry.dataset?.etlVersion].filter(Boolean).join(' ');
    const medsVersion = entry.dataset?.medsVersion;
    const cells: Record<HealthCheckKey, CheckCell> = {
      ids: zeroCheck([
        [checks.emptyCodes, 'empty code', 'empty codes'],
        [checks.nullCodes, 'null code', 'null codes'],
        [checks.nullSubjectIds, 'null subject ID', 'null subject IDs'],
      ]),
      missingCodes: codeMetadataCheck(cm, warn(NO_CODES_FILE), ({ dataCodesMissing }) => {
        if (dataCodesMissing === null) return NOT_REPORTED;
        return dataCodesMissing === 0 ? pass('None') : warn(plural(dataCodesMissing, 'code', 'codes'));
      }),
      numeric: zeroCheck([
        [checks.nanValues, 'NaN', 'NaN'],
        [checks.infiniteValues, 'infinite', 'infinite'],
      ]),
      descriptions: codeMetadataCheck(cm, unknown(NO_CODES_FILE), ({ codes, withDescription }) => {
        if (!codes || withDescription === null) return NOT_REPORTED;
        const share = withDescription / codes;
        return (share >= DESCRIPTION_THRESHOLD ? pass : warn)(formatPercentDown(share));
      }),
      unusedCodes: codeMetadataCheck(cm, unknown(NO_CODES_FILE), ({ metadataCodesUnused: unused }) => {
        if (unused === null) return NOT_REPORTED;
        return info(unused === 0 ? 'None' : plural(unused, 'code', 'codes'));
      }),
      medsVersion: medsVersion ? info(medsVersion) : unknown('Not stated'),
      etl: etl ? info(etl) : unknown('Not stated'),
    };
    return cells;
  });
  return { rows: drawn.map(({ entry, value }) => ({ label: entry.label, cells: value })), skipped };
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
