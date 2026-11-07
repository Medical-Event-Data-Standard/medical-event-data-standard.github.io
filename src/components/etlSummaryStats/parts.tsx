import React from 'react';
import { Box, Link, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import PlotlyWrapper from '@site/src/components/MEDS-DEV/plots/PlotlyWrapper';
import type { Figure, Skipped, TableView } from '@site/src/lib/etlSummaryStats/charts';

// Building blocks of the dataset statistics page: a chart section, its Plotly figure, the note listing the
// datasets a chart leaves out, and the table view every chart has.

const PLOT_CONFIG = { displayModeBar: false, responsive: true };

/** A Plotly figure that fills its container's width. Plotly itself is only loaded in the browser. */
export function Plot({ figure, label }: { figure: Figure; label: string }): React.JSX.Element {
  return (
    <Box role="img" aria-label={label} sx={{ minHeight: figure.layout.height }}>
      <PlotlyWrapper
        data={figure.data}
        layout={figure.layout}
        config={PLOT_CONFIG}
        useResizeHandler
        style={{ width: '100%', height: figure.layout.height }}
      />
    </Box>
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
export function SkippedNote({ skipped }: { skipped: Skipped[] }): React.JSX.Element | null {
  if (skipped.length === 0) return null;
  return (
    <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
      <Typography variant="body2" component="p" sx={{ mb: 0.5 }}>
        Not shown in this chart:
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

/**
 * Styles for a plain `<table>` inside a Markdown page: the site's table look, tighter, with one line per cell. The
 * wrapper scrolls sideways when the table is wider than the screen.
 */
export const COMPACT_TABLE = {
  overflowX: 'auto',
  fontSize: '0.8125rem',
  fontVariantNumeric: 'tabular-nums',
  '& table': { display: 'table', width: '100%', mb: 0 },
  '& th, & td': { py: 0.75, px: 1.25, whiteSpace: 'nowrap' },
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

/** A row of mutually exclusive buttons choosing what a chart shows. */
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
    <ToggleButtonGroup
      exclusive
      size="small"
      color="primary"
      aria-label={label}
      value={value}
      onChange={(_event, next: T | null) => next && onChange(next)}
      sx={{ flexWrap: 'wrap', mb: 1.5 }}
    >
      {options.map(option => (
        <ToggleButton key={option.key} value={option.key} sx={{ textTransform: 'none', py: 0.25 }}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** A control with a short visible label in front of it, e.g. "Sort by". */
export function LabelledToggle({
  label,
  children,
}: React.PropsWithChildren<{ label: string }>): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2" component="span" sx={{ color: 'text.secondary' }} aria-hidden="true">
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/**
 * A titled chart section: description, optional controls, the chart, what it leaves out, and (unless the chart
 * already prints every number, like a labelled heatmap) its numbers as a table.
 */
export function ChartSection({
  id,
  title,
  description,
  controls,
  skipped,
  table,
  children,
}: React.PropsWithChildren<{
  id: string;
  title: string;
  description: React.ReactNode;
  controls?: React.ReactNode;
  skipped: Skipped[];
  table?: TableView;
}>): React.JSX.Element {
  return (
    <Box component="section" aria-labelledby={id} sx={{ mb: 5 }}>
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
      {controls}
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
        {children}
      </Paper>
      <SkippedNote skipped={skipped} />
      {table && <TableDetails table={table} caption={`${title}: the numbers`} />}
    </Box>
  );
}
