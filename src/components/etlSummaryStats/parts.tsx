import React from 'react';
import { Box, Link, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import WarningIcon from '@mui/icons-material/Warning';
import Heading from '@theme/Heading';
import PlotlyWrapper from '@site/src/components/MEDS-DEV/plots/PlotlyWrapper';
import {
  AXIS_SCALES,
  type Axis,
  type AxisScale,
  BUBBLE_FILL,
  type BubbleChartModel,
  type CheckCell,
  type CheckStatus,
  type Figure,
  HEALTH_CHECKS,
  type HealthCheckModel,
  INK,
  STATUS_COLORS,
  type Skipped,
  type TableView,
} from '@site/src/lib/etlSummaryStats/charts';

// Building blocks of the dataset statistics page: a chart section, its Plotly figure, the note listing the
// datasets a chart leaves out, and the table view every chart has.

const PLOT_CONFIG = { displayModeBar: false, responsive: true };

/**
 * Styles for a box whose content scrolls sideways when it is wider than the box, and only then. Overlay scrollbars
 * (macOS, phones) stay hidden until one scrolls, which hides that there is more to the right, so the scrollbar is
 * styled, like the site's sidebar scrollbar and in its colours: Chrome, Edge and Safari then always draw it.
 * Firefox, which ignores those styles, gets a thin scrollbar in the same colours.
 */
export const SCROLL_X = {
  overflowX: 'auto',
  '&::-webkit-scrollbar': { height: 'var(--ifm-scrollbar-size)' },
  '&::-webkit-scrollbar-track': {
    background: 'var(--ifm-scrollbar-track-background-color)',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'var(--ifm-scrollbar-thumb-background-color)',
    borderRadius: '10px',
  },
  '&::-webkit-scrollbar-thumb:hover': { background: 'var(--ifm-scrollbar-thumb-hover-background-color)' },
  '@supports not selector(::-webkit-scrollbar)': {
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--ifm-scrollbar-thumb-background-color) var(--ifm-scrollbar-track-background-color)',
  },
} as const;

/**
 * A Plotly figure that fills its container's width. Plotly itself is only loaded in the browser. With `minWidth`, a
 * narrower screen scrolls the figure sideways (see `SCROLL_X`) rather than squeezing it.
 */
export function Plot({
  figure,
  label,
  minWidth,
}: {
  figure: Figure;
  label: string;
  minWidth?: number;
}): React.JSX.Element {
  return (
    <Box sx={minWidth ? SCROLL_X : undefined}>
      <Box role="img" aria-label={label} sx={{ minHeight: figure.layout.height, minWidth }}>
        <PlotlyWrapper
          data={figure.data}
          layout={figure.layout}
          config={PLOT_CONFIG}
          useResizeHandler
          style={{ width: '100%', height: figure.layout.height }}
        />
      </Box>
    </Box>
  );
}

/** Below a bubble chart: reference bubbles for its size scale, how size maps to codes, and unlabelled bubbles. */
export function BubbleKey({
  model,
}: {
  model: Pick<BubbleChartModel, 'sizeKey' | 'sizeNote' | 'unlabelled'>;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 2,
        rowGap: 1,
        mt: 1,
        color: 'text.secondary',
        fontSize: '0.8125rem',
      }}
    >
      {model.sizeKey.map(({ label, diameter }) => (
        <Box key={label} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <svg width={diameter} height={diameter} aria-hidden="true">
            <circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2 - 0.75} fill={BUBBLE_FILL} />
          </svg>
          {label}
        </Box>
      ))}
      <span>{model.sizeNote}</span>
      {model.unlabelled.length > 0 && (
        <span>
          Left unlabelled to avoid overlaps: {model.unlabelled.join(', ')}. Hover over a bubble, or see the
          numbers below.
        </span>
      )}
    </Box>
  );
}

/** A drop-down choosing one of the datasets, e.g. the one a chart highlights. */
export function DatasetSelect({
  label,
  options,
  value,
  onChange,
  emptyOption,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** If given, a first choice with this text and the value '' (e.g. "None"). */
  emptyOption?: string;
}): React.JSX.Element {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      // Keep the label above the field even when the value is empty ("None"), so the two never overlap.
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      sx={{ mt: 1, minWidth: 220 }}
    >
      {emptyOption !== undefined && <option value="">{emptyOption}</option>}
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </TextField>
  );
}

const STATUS_ICONS: Record<
  Exclude<CheckStatus, 'info'>,
  { Icon: typeof CheckCircleIcon; color: string; title: string }
> = {
  pass: { Icon: CheckCircleIcon, color: STATUS_COLORS.pass, title: 'Passes' },
  warn: { Icon: WarningIcon, color: STATUS_COLORS.warn, title: 'Warning' },
  unknown: { Icon: HelpOutlineIcon, color: INK.muted, title: 'Not known' },
};

/** One scorecard cell: an icon naming its status (none for information) and its text, never colour alone. */
function CheckCellView({ cell }: { cell: CheckCell }): React.JSX.Element {
  const icon = cell.status === 'info' ? null : STATUS_ICONS[cell.status];
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, verticalAlign: 'middle' }}
    >
      {icon && <icon.Icon titleAccess={icon.title} sx={{ fontSize: 18, color: icon.color }} />}
      <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
        {cell.text}
      </Box>
    </Box>
  );
}

/**
 * The health-check scorecard: one row per dataset, one column per check, then what each check means. Headings and
 * cells wrap, so that the table fits beside the page's table of contents; on a narrower screen it scrolls sideways,
 * with the datasets' names kept in view.
 */
export function HealthTable({ model }: { model: HealthCheckModel }): React.JSX.Element {
  return (
    <>
      <Box
        sx={{
          ...COMPACT_TABLE,
          '& th, & td': { ...COMPACT_TABLE['& th, & td'], px: 1, whiteSpace: 'normal' },
          '& thead th': { minWidth: '5em', verticalAlign: 'bottom' },
          // Long ETL versions break anywhere rather than widening their column, which fits an ETL's name, such as
          // MEDS_transforms. (Chrome counts a cell's padding in its minimum width.)
          '& td.versions': { minWidth: '10em', overflowWrap: 'anywhere' },
        }}
      >
        <table aria-label="Health check of each dataset">
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              {HEALTH_CHECKS.map(check => (
                <th key={check.key} scope="col">
                  {check.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map(row => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {HEALTH_CHECKS.map(check => (
                  <td key={check.key} className={check.key}>
                    <CheckCellView cell={row.cells[check.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <Box component="ul" sx={{ mt: 1.5, mb: 0, pl: 3, color: 'text.secondary', fontSize: '0.875rem' }}>
        {HEALTH_CHECKS.map(check => (
          <li key={check.key}>
            <strong>{check.label}</strong>: {check.help}
          </li>
        ))}
      </Box>
    </>
  );
}

/** An external link that opens in a new tab. */
export function ExternalLink({
  href,
  children,
}: React.PropsWithChildren<{ href: string }>): React.JSX.Element {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  );
}

/** Lists the datasets a chart leaves out, and why, so a missing bar is never silent. */
export function SkippedNote({
  skipped,
  hasChart,
}: {
  skipped: Skipped[];
  /** False if no dataset could be drawn, so there is no chart. */
  hasChart: boolean;
}): React.JSX.Element | null {
  if (skipped.length === 0) return null;
  return (
    <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
      <Typography variant="body2" component="p" sx={{ mb: 0.5 }}>
        {hasChart ? 'Not shown in this chart:' : 'No dataset can be drawn in this chart:'}
      </Typography>
      <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3 }}>
        {skipped.map(({ label, reason }) => (
          <li key={label}>
            <strong>{label}</strong>: {reason}
          </li>
        ))}
      </Box>
    </Box>
  );
}

/** The site's (Infima's) shading of every other table row, which is translucent. */
const STRIPE = 'linear-gradient(var(--ifm-table-stripe-background), var(--ifm-table-stripe-background))';

/**
 * Styles for a plain `<table>` inside a Markdown page: the site's table look, tighter, with one line per cell. The
 * wrapper scrolls sideways when the table is wider than it (see `SCROLL_X`), and the first column, which names each
 * row, stays in view while it does. A cell that stays in view needs an opaque background, so the first column's is
 * white, under the site's row shading, with a line on its right edge.
 */
export const COMPACT_TABLE = {
  ...SCROLL_X,
  fontSize: '0.8125rem',
  fontVariantNumeric: 'tabular-nums',
  '& table': { display: 'table', width: '100%', mb: 0 },
  '& th, & td': { py: 0.75, px: 1.25, whiteSpace: 'nowrap' },
  // Each row's first cell, its heading: a `th`, unlike the cells after it.
  '& tr > th:first-of-type': {
    position: 'sticky',
    // One pixel past the edge, so that no sliver of the cells scrolling under it shows beside it.
    left: '-1px',
    zIndex: 1,
    backgroundColor: '#ffffff',
    boxShadow: 'inset -1px 0 0 var(--ifm-table-border-color)',
  },
  '& thead tr > th:first-of-type, & tbody tr:nth-of-type(2n) > th:first-of-type': {
    backgroundImage: STRIPE,
  },
} as const;

/** A plain table, styled like the site's Markdown tables. */
export function DataTable({ table, caption }: { table: TableView; caption: string }): React.JSX.Element {
  return (
    <Box sx={{ ...COMPACT_TABLE, mt: 1 }}>
      <table aria-label={caption}>
        <thead>
          <tr>
            {table.columns.map(column => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(([first, ...rest]) => (
            <tr key={first}>
              <th scope="row">{first}</th>
              {rest.map((cell, i) => (
                <td key={table.columns[i + 1]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

/** The numbers behind a chart, collapsed by default. */
export function TableDetails({
  table,
  caption,
}: {
  table: TableView;
  caption: string;
}): React.JSX.Element | null {
  if (table.rows.length === 0) return null;
  return (
    <Box component="details" sx={{ mt: 1 }}>
      <Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: '0.875rem' }}>
        Show the numbers
      </Box>
      <DataTable table={table} caption={caption} />
    </Box>
  );
}

export interface MetricOption<T extends string> {
  key: T;
  label: string;
}

/**
 * A row of mutually exclusive buttons choosing what a chart shows, after a short visible label that also names the
 * group for screen readers. Every control on the page that switches between a few choices is one of these.
 */
export function MetricToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: MetricOption<T>[];
  value: T;
  onChange: (value: T) => void;
}): React.JSX.Element {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2" component="span" color="text.secondary" aria-hidden="true">
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        aria-label={label}
        value={value}
        onChange={(_event, next: T | null) => next && onChange(next)}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map(option => (
          <ToggleButton key={option.key} value={option.key} sx={{ textTransform: 'none', py: 0.25 }}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

/** The names of a chart's axes on their scale toggles. */
export const AXIS_NAMES: Record<Axis, string> = { x: 'Horizontal axis', y: 'Vertical axis' };

/** The log/linear toggle that every logarithmic axis on the page has. */
export function ScaleToggle({
  axis,
  value,
  onChange,
}: {
  axis: Axis;
  value: AxisScale;
  onChange: (value: AxisScale) => void;
}): React.JSX.Element {
  return <MetricToggle label={AXIS_NAMES[axis]} options={AXIS_SCALES} value={value} onChange={onChange} />;
}

/**
 * A titled chart section: a heading with a permalink, the description, optional controls, the chart, notes on how
 * some datasets are drawn, what it leaves out, and (unless the chart already prints every number, like a labelled
 * heatmap) its numbers as a table. Without a chart (no dataset can be drawn) there is no empty frame, only the note
 * on why.
 */
export function ChartSection({
  id,
  title,
  description,
  controls,
  notes = [],
  skipped,
  table,
  children,
}: React.PropsWithChildren<{
  id: string;
  title: string;
  description: React.ReactNode;
  controls?: React.ReactNode;
  notes?: string[];
  skipped: Skipped[];
  table?: TableView;
}>): React.JSX.Element {
  const hasChart = React.Children.toArray(children).length > 0;
  const hasControls = React.Children.toArray(controls).length > 0;
  return (
    <Box component="section" aria-labelledby={id} sx={{ mb: 5 }}>
      <Heading as="h2" id={id}>
        {title}
      </Heading>
      <p>{description}</p>
      {hasControls && (
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 1, mb: 1.5 }}
        >
          {controls}
        </Box>
      )}
      {hasChart && (
        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
          {children}
        </Paper>
      )}
      {notes.map(note => (
        <Typography key={note} variant="body2" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
          {note}
        </Typography>
      ))}
      <SkippedNote skipped={skipped} hasChart={hasChart} />
      {table && <TableDetails table={table} caption={`${title}: the numbers`} />}
    </Box>
  );
}
