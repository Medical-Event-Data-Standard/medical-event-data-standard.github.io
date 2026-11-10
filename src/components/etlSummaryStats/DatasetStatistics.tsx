import React, { useMemo, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Switch, Typography, useMediaQuery } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import Heading from '@theme/Heading';
import {
  type Axis,
  type AxisScale,
  type AxisScales,
  BREADTH_MEASURES,
  type BreadthMeasure,
  CHART_FONT,
  type ChartModel,
  DESCRIPTION_THRESHOLD,
  ICD_GROUP,
  MAPPING_COLUMNS,
  MISSING_CODES_VIEWS,
  type MissingCodesView,
  NO_MAPPING,
  OMOP_MARK,
  PACE_LABEL,
  type PerSubjectMetric,
  PER_SUBJECT_METRICS,
  codeTailChart,
  coverageChart,
  datasetName,
  depthBreadthChart,
  formatDate,
  formatPercent,
  githubRepoUrl,
  healthCheck,
  INK,
  orderDatasets,
  paceChart,
  perSubjectChart,
  schemaDescription,
  sizeChart,
  statsFileUrl,
  vocabularyChart,
} from '@site/src/lib/etlSummaryStats/charts';
import {
  type DatasetLocations as DatasetLocationsConfig,
  ETL_SUMMARY_STATS_PLUGIN,
  type EtlStatsEntry,
  type EtlStatsPageData,
} from '@site/src/lib/etlSummaryStats/types';
import DatasetLocations from './DatasetLocations';
import {
  BubbleKey,
  COMPACT_TABLE,
  ChartSection,
  DatasetSelect,
  ExternalLink,
  HealthTable,
  MetricToggle,
  Plot,
  ScaleToggle,
} from './parts';

// The "Dataset statistics" page: charts of the `meds_summary_stats` files that dataset ETLs publish, and of those
// committed to this site's repository, collected at build time by plugins/etlSummaryStats.ts. One filter (include
// demo datasets) above everything it scopes, then a summary table with each file's provenance, then one section per
// chart.

/**
 * Screens up to this width get the phone layouts: smaller bubbles and labels laid out for a narrow plot in the
 * bubble chart, and a taller tail plot, whose legend takes a line per dataset.
 */
const NARROW_SCREEN = '(max-width: 760px)';

/** The page's sections, in order: their heading and its anchor. */
export const SECTIONS = {
  files: { id: 'stats-files', title: 'Datasets and their stats files' },
  locations: { id: 'dataset-locations', title: 'Where the datasets come from' },
  size: { id: 'dataset-size', title: 'Dataset size' },
  depth: { id: 'depth-breadth', title: 'Depth vs. breadth' },
  perSubject: { id: 'per-subject', title: 'How much data each subject has' },
  pace: { id: 'pace', title: 'Pace of events' },
  coverage: { id: 'record-coverage', title: 'Record coverage' },
  tail: { id: 'code-tail', title: 'How long the tail of codes is' },
  vocabularies: { id: 'vocabularies', title: 'Mapping to vocabularies' },
  health: { id: 'health-check', title: 'Health check' },
} as const;

/**
 * The sections' entries in the page's table of contents. Headings rendered by a component don't reach the table of
 * contents by themselves, so the MDX page exports these as part of its `toc`.
 */
export const DATASET_STATISTICS_TOC = Object.values(SECTIONS).map(({ id, title }) => ({
  value: title,
  id,
  level: 2,
}));

/** "A", "A and B", "A, B and C". */
const listOf = (items: string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** What a chart's axes are, for its description. */
function axesSentence(log: Record<Axis, boolean>): string {
  const minorGrid = 'with fainter gridlines at 2 to 9 times each power of ten';
  if (log.x && log.y) return `Both axes are logarithmic, ${minorGrid}.`;
  if (!log.x && !log.y) return 'Both axes are linear.';
  return log.x
    ? `The horizontal axis is logarithmic, ${minorGrid}, and the vertical axis linear.`
    : `The vertical axis is logarithmic, ${minorGrid}, and the horizontal axis linear.`;
}

/** What the value axis of a bar or box chart is, for its description. */
const valueAxisSentence = (log: boolean): string =>
  log
    ? 'The axis is logarithmic: each labelled gridline is ten times the last, and the fainter gridlines between them mark 2 to 9 times.'
    : 'The axis is linear, from zero.';

/** The charts whose logarithmic axes can be switched to linear. */
type ScaledChart = 'size' | 'depth' | 'perSubject' | 'pace' | 'tail';

/** Below this width the summary table stacks each dataset's cells, each after its heading, rather than scrolling. */
const STACKED = '@media (max-width: 599.95px)';

/** Styles of the summary table: cells wrap, so it fits beside the table of contents, and it stacks on a phone. */
const SUMMARY_TABLE = {
  ...COMPACT_TABLE,
  '& th, & td': { ...COMPACT_TABLE['& th, & td'], whiteSpace: 'normal' },
  '& thead th': { verticalAlign: 'bottom' },
  // Long versions break anywhere rather than widening their column.
  '& td.dataset-name': { minWidth: '9em', overflowWrap: 'anywhere' },
  '& td.extracted': { whiteSpace: 'nowrap' },
  [STACKED]: {
    '& table, & tbody, & tr': { display: 'block' },
    // The headings stay for screen readers; each cell shows its own.
    '& thead': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    },
    '& tr': { py: 0.75 },
    // Each dataset's heading heads its block rather than staying in view, on its row's shading. (These selectors
    // match those that make the heading stay in view, so that they win over them.)
    '& tr > th:first-of-type, & tbody tr:nth-of-type(2n) > th:first-of-type': {
      position: 'static',
      boxShadow: 'none',
      background: 'none',
    },
    '& th, & td': { display: 'block', border: 0, py: 0.25, px: 1.25, textAlign: 'left' },
    '& td, & td.extracted': {
      display: 'grid',
      gridTemplateColumns: '8.5em minmax(0, 1fr)',
      columnGap: 1,
      whiteSpace: 'normal',
    },
    '& td.dataset-name': { minWidth: 0 },
    '& td::before': { content: 'attr(data-label)', color: 'text.secondary' },
  },
} as const;

/** The columns of the summary table after the dataset's label. */
const SUMMARY_COLUMNS = ['Dataset name and version', 'Stats file', 'Extracted', 'Schema'] as const;

/** Which dataset, file and repository each dataset's numbers come from, and when they were extracted. */
function SummaryTable({ entries }: { entries: EtlStatsEntry[] }): React.JSX.Element {
  const [nameColumn, fileColumn, extractedColumn, schemaColumn] = SUMMARY_COLUMNS;
  return (
    <Box sx={SUMMARY_TABLE}>
      <table aria-label="Datasets and their stats files">
        <thead>
          <tr>
            <th scope="col">Dataset</th>
            {SUMMARY_COLUMNS.map(header => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => (
            <tr key={entry.id}>
              <th scope="row">{entry.label}</th>
              {/* Each cell holds one element, the second column of its row when the table is stacked. */}
              <td className="dataset-name" data-label={nameColumn}>
                <span>
                  {datasetName(entry)}
                  {entry.datasetOverride && <sup>{OVERRIDE_MARK}</sup>}
                </span>
              </td>
              <td data-label={fileColumn}>
                <div>
                  <ExternalLink href={statsFileUrl(entry)}>{entry.path.split('/').pop()}</ExternalLink>
                  <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                    {entry.host === 'site' ? (
                      "in this site's repository"
                    ) : (
                      <>
                        in{' '}
                        <ExternalLink href={githubRepoUrl(entry.githubRepo)}>{entry.githubRepo}</ExternalLink>
                      </>
                    )}
                  </Box>
                </div>
              </td>
              <td className="extracted" data-label={extractedColumn}>
                {formatDate(entry.extractedAt)}
              </td>
              <td data-label={schemaColumn}>{schemaDescription(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

/**
 * A chart's row names, set beside it rather than in it, so that they stay in view when it scrolls sideways, in
 * the chart's font. Screen readers get the chart's own label instead.
 */
function RowLabels({
  labels,
  top,
  rowHeight,
}: {
  labels: string[];
  top: number;
  rowHeight: number;
}): React.JSX.Element {
  return (
    <Box
      aria-hidden="true"
      sx={{
        flex: 'none',
        pt: `${top}px`,
        pr: 1,
        textAlign: 'right',
        font: `12px ${CHART_FONT}`,
        color: INK.primary,
      }}
    >
      {labels.map(label => (
        <Box key={label} sx={{ height: rowHeight, lineHeight: `${rowHeight}px`, whiteSpace: 'nowrap' }}>
          {label}
        </Box>
      ))}
    </Box>
  );
}

/** No recorded locations, for global data without them. */
const NO_LOCATIONS: DatasetLocationsConfig = { locations: [], unplaced: [] };

/** Marks a dataset name and version set in this site's configuration rather than taken from the stats file. */
const OVERRIDE_MARK = '†';

export default function DatasetStatistics(): React.JSX.Element {
  const data = usePluginData(ETL_SUMMARY_STATS_PLUGIN) as EtlStatsPageData | undefined;
  const [includeDemo, setIncludeDemo] = useState(true);
  const [perSubjectMetric, setPerSubjectMetric] = useState<PerSubjectMetric>('events');
  const [breadth, setBreadth] = useState<BreadthMeasure>('subjects');
  const [bubbleSize, setBubbleSize] = useState<BreadthMeasure>('uniqueCodes');
  const [missingCodes, setMissingCodes] = useState<MissingCodesView>('share');
  const [highlight, setHighlight] = useState<string | null>(null);
  // Each chart's axis scales; every axis that can be logarithmic starts out so.
  const [scales, setScales] = useState<Partial<Record<ScaledChart, AxisScales>>>({});
  const narrow = useMediaQuery(NARROW_SCREEN);

  const allEntries = useMemo(() => orderDatasets(data?.datasets ?? []), [data]);
  const entries = useMemo(
    () => allEntries.filter(entry => includeDemo || entry.variant !== 'demo'),
    [allEntries, includeDemo]
  );
  const scaleOf = (chart: ScaledChart, axis: Axis): AxisScale => scales[chart]?.[axis] ?? 'log';
  const size = useMemo(() => sizeChart(entries, scales.size?.x), [entries, scales.size]);
  const depth = useMemo(
    () => depthBreadthChart(entries, { narrow, breadth, size: bubbleSize, scales: scales.depth }),
    [entries, narrow, breadth, bubbleSize, scales.depth]
  );
  const perSubject = useMemo(
    () => perSubjectChart(entries, perSubjectMetric, scales.perSubject?.x),
    [entries, perSubjectMetric, scales.perSubject]
  );
  const pace = useMemo(() => paceChart(entries, scales.pace?.x), [entries, scales.pace]);
  const coverage = useMemo(() => coverageChart(entries), [entries]);
  const datasetLabels = useMemo(() => allEntries.map(entry => entry.label), [allEntries]);
  const shownLabels = useMemo(() => entries.map(entry => entry.label), [entries]);
  const codeTail = useMemo(
    () => codeTailChart(entries, highlight, datasetLabels, { narrow, scales: scales.tail }),
    [entries, highlight, datasetLabels, narrow, scales.tail]
  );
  const vocabularies = useMemo(() => vocabularyChart(entries), [entries]);
  const health = useMemo(() => healthCheck(entries, { missingCodes }), [entries, missingCodes]);

  if (!data || data.datasets.length === 0) {
    return (
      <Alert severity="warning">
        No dataset statistics could be collected when this site was built. Each ETL&apos;s stats file is
        linked from its repository on GitHub.
      </Alert>
    );
  }

  /** Whether a chart's axis is drawn logarithmic: it can be, and its toggle is on log. */
  const isLog = (chart: ScaledChart, model: ChartModel, axis: Axis = 'x'): boolean =>
    model.logAxes.includes(axis) && scaleOf(chart, axis) === 'log';
  /** A log/linear toggle for each axis of the chart that can be logarithmic. */
  const scaleToggles = (chart: ScaledChart, model: ChartModel): React.ReactNode[] =>
    model.logAxes.map(axis => (
      <ScaleToggle
        key={axis}
        axis={axis}
        value={scaleOf(chart, axis)}
        onChange={scale => setScales(prev => ({ ...prev, [chart]: { ...prev[chart], [axis]: scale } }))}
      />
    ));

  const hasDemo = allEntries.some(entry => entry.variant === 'demo');
  const minCellSizes = [...new Set(allEntries.map(entry => entry.minCellSize).filter(n => n !== null))];
  const problems = entries.filter(entry => entry.problem);
  const missing = data.reposWithoutStats;
  const overridden = entries.some(entry => entry.datasetOverride);
  const measure = (key: BreadthMeasure) =>
    BREADTH_MEASURES.find(option => option.key === key) as (typeof BREADTH_MEASURES)[number];
  const across = measure(breadth);
  const sizedBy = measure(bubbleSize);
  const tailLog = { x: isLog('tail', codeTail, 'x'), y: isLog('tail', codeTail, 'y') };
  const tailAxes =
    tailLog.x === tailLog.y
      ? `both ${tailLog.x ? 'logarithmic' : 'linear'}`
      : `${tailLog.x ? 'logarithmic' : 'linear'} across and ${tailLog.y ? 'logarithmic' : 'linear'} up`;

  return (
    <div>
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        {allEntries.some(entry => entry.host === 'site') ? (
          <>
            Every number here comes from a stats file that <code>meds_summary_stats</code> computed on a copy
            of the dataset. ETL maintainers publish these files in their repositories, and some are committed
            to this site&apos;s repository; the table links to each file and gives the date it was extracted.
          </>
        ) : (
          <>
            Every number here comes from the stats file that an ETL&apos;s maintainers computed on their own
            copy of the data and published in their repository; the table links to each file and gives the
            date it was extracted.
          </>
        )}
        {data.updatedAt ? ` This site collected the files on ${formatDate(data.updatedAt)}.` : ''} Cells
        backed by
        {minCellSizes.length === 1 ? ` fewer than ${minCellSizes[0]} subjects` : ' too few subjects'} are
        suppressed by <code>meds_summary_stats</code>, and are shown as suppressed, never filled in. Every row
        of a dataset counts as one event, including rows that share a subject and time.
      </Alert>

      {hasDemo && (
        <Paper variant="outlined" sx={{ px: 2, py: 0.5, mb: 2 }}>
          <FormControlLabel
            control={
              <Switch checked={includeDemo} onChange={event => setIncludeDemo(event.target.checked)} />
            }
            label="Include demo datasets (small, openly available samples)"
          />
        </Paper>
      )}

      <Box component="section" aria-labelledby={SECTIONS.files.id} sx={{ mb: 5 }}>
        <Heading as="h2" id={SECTIONS.files.id}>
          {SECTIONS.files.title}
        </Heading>
        <SummaryTable entries={entries} />
        {overridden && (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {OVERRIDE_MARK} Set in this site&apos;s configuration (
            <code>static/data/etl_summary_stats.yaml</code>) rather than taken from the stats file.
          </Typography>
        )}
        {problems.map(entry => (
          <Alert key={entry.id} severity="warning" sx={{ mt: 1 }}>
            <strong>{entry.label}</strong>: {entry.problem} It is listed here but left out of the charts.
          </Alert>
        ))}
        {missing.length > 0 && (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1 }}>
            No stats file yet in {missing.length === 1 ? 'this ETL repository' : 'these ETL repositories'}{' '}
            from the ecosystem:{' '}
            {missing.map((repo, i) => (
              <React.Fragment key={repo.githubRepo}>
                {i > 0 && ', '}
                <ExternalLink href={githubRepoUrl(repo.githubRepo)}>{repo.name}</ExternalLink>
              </React.Fragment>
            ))}
            .
          </Typography>
        )}
      </Box>

      <DatasetLocations
        {...SECTIONS.locations}
        config={data.locations ?? NO_LOCATIONS}
        labels={shownLabels}
      />

      <ChartSection
        {...SECTIONS.size}
        description={`Events (rows) and distinct codes in each dataset, side by side, with the most events first. ${valueAxisSentence(isLog('size', size))} The table below also lists each dataset's subjects.`}
        controls={scaleToggles('size', size)}
        skipped={size.skipped}
        table={size.table}
      >
        {size.figure && (
          <Plot
            figure={size.figure}
            label="Events and unique codes per dataset, grouped bars, most events first"
          />
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.depth}
        description={`One bubble per dataset. Across is its breadth: the number of ${across.noun} it has. Up is its depth: the median number of events per subject. The bubble's area shows the number of ${sizedBy.noun}${bubbleSize === breadth ? ', as the horizontal axis does' : ''}. ${axesSentence({ x: isLog('depth', depth, 'x'), y: isLog('depth', depth, 'y') })} Datasets further right are broader, and those higher up are deeper.`}
        controls={
          depth.figure && [
            <MetricToggle
              key="breadth"
              label="Breadth"
              options={BREADTH_MEASURES}
              value={breadth}
              onChange={setBreadth}
            />,
            <MetricToggle
              key="size"
              label="Bubble size"
              options={BREADTH_MEASURES}
              value={bubbleSize}
              onChange={setBubbleSize}
            />,
            ...scaleToggles('depth', depth),
          ]
        }
        skipped={depth.skipped}
        table={depth.table}
      >
        {depth.figure && (
          <>
            <Plot
              figure={depth.figure}
              label={`${across.label} against median events per subject, one bubble per dataset, sized by ${sizedBy.noun}`}
            />
            <BubbleKey model={depth} />
          </>
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.perSubject}
        description={`The spread across subjects: each box runs from the 25th to the 75th percentile with the median marked inside, and the whiskers reach the 5th and 95th percentiles. The stats files publish no minimum or maximum, by design. ${valueAxisSentence(isLog('perSubject', perSubject))}`}
        controls={[
          <MetricToggle
            key="metric"
            label="Per-subject measure"
            options={PER_SUBJECT_METRICS}
            value={perSubjectMetric}
            onChange={setPerSubjectMetric}
          />,
          ...scaleToggles('perSubject', perSubject),
        ]}
        notes={perSubject.notes}
        skipped={perSubject.skipped}
        table={perSubject.table}
      >
        {perSubject.figure && (
          <Plot
            figure={perSubject.figure}
            label={`${(PER_SUBJECT_METRICS.find(m => m.key === perSubjectMetric) as { axis: string }).axis}, box chart per dataset`}
          />
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.pace}
        description={
          <>
            How densely each dataset records data: each subject&apos;s own rate, their timed events divided by
            the days from their earliest to their latest one, as <code>per_subject.measurements_per_day</code>{' '}
            in a stats file gives it. <code>meds_summary_stats</code> writes this from version 0.0.4 (stats
            schema version 2) on, so files written by earlier versions don&apos;t have it. Birth and death
            records are left out, so that birth dates and registry deaths don&apos;t stretch the span, and
            subjects with fewer than two distinct timestamps have no rate and aren&apos;t counted. Each box
            runs from the 25th to the 75th percentile of subjects, with the median marked inside, and the
            whiskers reach the 5th and 95th percentiles. Very short records give very large rates, so the
            chart shows these percentiles rather than the mean. The datasets are ranked by their median.
            {pace.figure ? ` ${valueAxisSentence(isLog('pace', pace))}` : ''}
          </>
        }
        controls={scaleToggles('pace', pace)}
        notes={pace.notes}
        skipped={pace.skipped}
        table={pace.table}
      >
        {pace.figure && <Plot figure={pace.figure} label={`${PACE_LABEL}, box chart per dataset`} />}
      </ChartSection>

      <ChartSection
        {...SECTIONS.coverage}
        description="Birth, Death and Static: the share of subjects with a birth record, a death record and static (time-less) data. Numeric: the share of events that carry a numeric value. Darker cells are higher shares."
        skipped={coverage.skipped}
      >
        {coverage.figure && <Plot figure={coverage.figure} label="Record coverage per dataset, heatmap" />}
      </ChartSection>

      <ChartSection
        {...SECTIONS.tail}
        description={
          <>
            For each dataset, the share of events whose code is not among its N most frequent codes (up),
            against N (across). {axesSentence(tailLog)}{' '}
            {tailLog.x && tailLog.y
              ? "As in a power-law plot, a curve that falls in a straight line means that code frequencies fall off as a power of their rank, as in Zipf's law. The steeper a curve falls, the faster its tail thins out. One that drops a labelled gridline (ten times fewer events outside) for every labelled gridline across (ten times as many codes) has a slope of −1; a flatter one has a longer tail of rarer codes. Curves bend down as they near a dataset's number of codes, where the tail runs out."
              : 'With both axes logarithmic, the chart is a power-law plot, on which a straight curve means that code frequencies fall off as a power of their rank.'}{' '}
            No line is fitted: the points are the published figures, joined by lines. They are the shares of
            the top 10, 100 and 1,000 codes, and how many codes it takes to cover 50%, 90% and 99% of events
            (leaving 50%, 10% and 1% outside).{' '}
            {tailLog.y
              ? "A point that leaves nothing outside, such as all of a dataset's codes, can't go on a logarithmic axis and is left out. "
              : ''}
            Each dataset has its own colour, line style and marker; click a legend entry to hide that dataset,
            double-click it to show only that one, or highlight one to compare it against the rest.
          </>
        }
        controls={
          codeTail.options.length > 0 && [
            <DatasetSelect
              key="highlight"
              label="Highlight"
              emptyOption="None"
              options={codeTail.options}
              value={codeTail.highlighted ?? ''}
              onChange={value => setHighlight(value || null)}
            />,
            ...scaleToggles('tail', codeTail),
          ]
        }
        skipped={codeTail.skipped}
        table={codeTail.table}
      >
        {codeTail.figure && (
          <Plot
            figure={codeTail.figure}
            label={`Share of events outside the most frequent codes against the number of codes, ${tailAxes}, one curve per dataset${
              codeTail.highlighted
                ? `, ${codeTail.highlighted} highlighted`
                : ', each in its own colour and line style'
            }`}
          />
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.vocabularies}
        description={
          <>
            How each dataset&apos;s codes map to vocabularies such as LOINC or ICD-10, through the parent
            codes in its code metadata. Every cell is a share, printed and shaded on a logarithmic scale
            (darker is larger) so that small shares still show. The first two columns count each event and
            code once: <strong>{MAPPING_COLUMNS[0].label}</strong> is the share of events whose code maps to
            any vocabulary, de-duplicated, and <strong>{MAPPING_COLUMNS[1].label}</strong> the share of the
            distinct codes in the data that have a parent code. After the gap, each column is one vocabulary
            {vocabularies.icdVocabularies.length > 0 ? ` (${ICD_GROUP} groups several, see below)` : ''}: the
            share of events whose code has a parent in it. A code can map into several vocabularies, so a
            row&apos;s vocabulary shares can add up to more than its {MAPPING_COLUMNS[0].label} share.
            Vocabularies used by the most datasets come first, and a blank grey cell means the dataset
            doesn&apos;t use that vocabulary. Datasets whose code metadata maps no codes show 0% and &ldquo;
            {NO_MAPPING}&rdquo;.
          </>
        }
        skipped={vocabularies.skipped}
      >
        {vocabularies.figure && (
          <>
            {/* Its width is queried, so that the hint shows only when the heatmap is wider than the space. */}
            <Box sx={{ containerType: 'inline-size' }}>
              <Typography
                variant="body2"
                color="text.secondary"
                component="p"
                sx={{
                  display: 'none',
                  mt: 0,
                  mb: 1,
                  [`@container (max-width: ${vocabularies.rowLabels.width + vocabularies.minWidth - 1}px)`]: {
                    display: 'block',
                  },
                }}
              >
                Scroll the heatmap sideways to see every vocabulary.
              </Typography>
              <Box sx={{ display: 'flex' }}>
                <RowLabels {...vocabularies.rowLabels} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Plot
                    figure={vocabularies.figure}
                    minWidth={vocabularies.minWidth}
                    label="Share of events mapped to any vocabulary and to each vocabulary, per dataset, heatmap"
                  />
                </Box>
              </Box>
            </Box>
            {vocabularies.anyRecognized && (
              <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
                {OMOP_MARK} A standard OMOP CDM vocabulary, as recognised by <code>meds_summary_stats</code>.
              </Typography>
            )}
            {vocabularies.icdVocabularies.length > 0 && (
              <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
                <strong>{ICD_GROUP}</strong> groups the vocabularies whose names start with ICD:{' '}
                {listOf(vocabularies.icdVocabularies)}. Its cell is the share of events whose code has a
                parent in at least one of them. Where the stats file reports that no code has parents in more
                than one vocabulary, that is the sum of their shares. Otherwise a code can count in several,
                and the file only bounds the share: from below by the largest ICD share, and by the share
                mapped to any vocabulary minus the shares of all other vocabularies (including suppressed
                ones, and parent codes that name none, where the file gives these); from above by the sum of
                the ICD shares, and by the share mapped to any vocabulary. The cell gives one value where the
                bounds round alike, and the range otherwise
                {vocabularies.icdRanges.length > 0 ? ` (${listOf(vocabularies.icdRanges)})` : ''}.
                {vocabularies.icdWithSuppressed
                  ? ' Suppressed vocabularies are not named, so none of them is counted as ICD.'
                  : ''}{' '}
                Hover over a cell for each ICD vocabulary&apos;s own share.
              </Typography>
            )}
          </>
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.health}
        description={`Invariants every MEDS dataset should meet, from each stats file. A check mark means the check passes, a warning sign that it needs a look, and a question mark that the stats file doesn't report it. Codes with a description pass at ${formatPercent(DESCRIPTION_THRESHOLD)} or more. The versions, and codes listed in codes.parquet but not used, are information without a verdict.`}
        controls={
          health.anyMissingCodes && (
            <MetricToggle
              label="Missing codes"
              options={MISSING_CODES_VIEWS}
              value={missingCodes}
              onChange={setMissingCodes}
            />
          )
        }
        skipped={health.skipped}
      >
        <HealthTable model={health} />
      </ChartSection>
    </div>
  );
}
