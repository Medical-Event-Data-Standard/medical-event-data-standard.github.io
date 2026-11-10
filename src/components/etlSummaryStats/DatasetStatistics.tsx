import React, { useMemo, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Switch, Typography, useMediaQuery } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import Heading from '@theme/Heading';
import {
  type Axis,
  type AxisScale,
  type AxisScales,
  BUBBLE_SIZES,
  type BubbleSize,
  type ChartModel,
  DESCRIPTION_THRESHOLD,
  MAPPING_COLUMNS,
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
  orderDatasets,
  paceChart,
  perSubjectChart,
  schemaDescription,
  sizeChart,
  statsFileUrl,
  vocabularyChart,
} from '@site/src/lib/etlSummaryStats/charts';
import {
  ETL_SUMMARY_STATS_PLUGIN,
  type EtlStatsData,
  type EtlStatsEntry,
} from '@site/src/lib/etlSummaryStats/types';
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
  const minorTicks = 'with small ticks at 2 to 9 times each power of ten';
  if (log.x && log.y) return `Both axes are logarithmic, ${minorTicks}.`;
  if (!log.x && !log.y) return 'Both axes are linear.';
  return log.x
    ? `The horizontal axis is logarithmic, ${minorTicks}, and the vertical axis linear.`
    : `The vertical axis is logarithmic, ${minorTicks}, and the horizontal axis linear.`;
}

/** What the value axis of a bar or box chart is, for its description. */
const valueAxisSentence = (log: boolean): string =>
  log
    ? 'The axis is logarithmic: each labelled gridline is ten times the last, and the small ticks between them mark 2 to 9 times.'
    : 'The axis is linear, from zero.';

/** The charts whose logarithmic axes can be switched to linear. */
type ScaledChart = 'size' | 'depth' | 'perSubject' | 'pace' | 'tail';

/** Which ETL and file each dataset's numbers come from, and when they were extracted. */
function SummaryTable({ entries }: { entries: EtlStatsEntry[] }): React.JSX.Element {
  const headers = [
    'Dataset',
    'ETL repository',
    'Stats file',
    'Extracted',
    'Dataset name and version',
    'Schema',
  ];
  return (
    <Box sx={COMPACT_TABLE}>
      <table>
        <thead>
          <tr>
            {headers.map(header => (
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
              <td>
                {entry.host === 'site' ? (
                  '—'
                ) : (
                  <ExternalLink href={githubRepoUrl(entry.githubRepo)}>{entry.githubRepo}</ExternalLink>
                )}
              </td>
              <td title={entry.path}>
                <ExternalLink href={statsFileUrl(entry)}>{entry.path.split('/').pop()}</ExternalLink>
              </td>
              <td>{formatDate(entry.extractedAt)}</td>
              {/* Wide enough that a long name takes a few lines, not one per word; the table scrolls instead. */}
              <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: '24em' }}>
                {datasetName(entry)}
              </td>
              <td>{schemaDescription(entry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

export default function DatasetStatistics(): React.JSX.Element {
  const data = usePluginData(ETL_SUMMARY_STATS_PLUGIN) as EtlStatsData | undefined;
  const [includeDemo, setIncludeDemo] = useState(true);
  const [perSubjectMetric, setPerSubjectMetric] = useState<PerSubjectMetric>('events');
  const [bubbleSize, setBubbleSize] = useState<BubbleSize>('uniqueCodes');
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
    () => depthBreadthChart(entries, { narrow, size: bubbleSize, scales: scales.depth }),
    [entries, narrow, bubbleSize, scales.depth]
  );
  const perSubject = useMemo(
    () => perSubjectChart(entries, perSubjectMetric, scales.perSubject?.x),
    [entries, perSubjectMetric, scales.perSubject]
  );
  const pace = useMemo(() => paceChart(entries, scales.pace?.x), [entries, scales.pace]);
  const coverage = useMemo(() => coverageChart(entries), [entries]);
  const datasetLabels = useMemo(() => allEntries.map(entry => entry.label), [allEntries]);
  const codeTail = useMemo(
    () => codeTailChart(entries, highlight, datasetLabels, { narrow, scales: scales.tail }),
    [entries, highlight, datasetLabels, narrow, scales.tail]
  );
  const vocabularies = useMemo(() => vocabularyChart(entries), [entries]);
  const health = useMemo(() => healthCheck(entries), [entries]);

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
  const hostedHere = entries.filter(entry => entry.host === 'site').map(entry => entry.label);
  const sizedBy = BUBBLE_SIZES.find(option => option.key === bubbleSize) as (typeof BUBBLE_SIZES)[number];
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
        {hostedHere.length > 0 && (
          <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1 }}>
            The stats {hostedHere.length === 1 ? 'file' : 'files'} of {listOf(hostedHere)}{' '}
            {hostedHere.length === 1 ? 'is' : 'are'} committed to this site&apos;s repository, so{' '}
            {hostedHere.length === 1 ? 'it has' : 'they have'} no ETL repository in the table.
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
        description={`One bubble per dataset: how many subjects it covers (across) against how much data a typical subject has, the median number of events per subject (up). The bubble's area shows ${bubbleSize === 'subjects' ? 'how many subjects the dataset has, as the horizontal axis does' : 'how many distinct codes the dataset uses'}. ${axesSentence({ x: isLog('depth', depth, 'x'), y: isLog('depth', depth, 'y') })} Datasets further right are broader, and those higher up are deeper.`}
        controls={
          depth.figure && [
            <MetricToggle
              key="size"
              label="Bubble size"
              options={BUBBLE_SIZES}
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
              label={`Subjects against median events per subject, one bubble per dataset, sized by ${sizedBy.noun}`}
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
            in a stats file gives it. Birth and death records are left out, so that birth dates and registry
            deaths don&apos;t stretch the span, and subjects with fewer than two distinct timestamps have no
            rate and aren&apos;t counted. Each box runs from the 25th to the 75th percentile of subjects, with
            the median marked inside, and the whiskers reach the 5th and 95th percentiles. Very short records
            give very large rates, so the chart shows these percentiles rather than the mean. The datasets are
            ranked by their median.{pace.figure ? ` ${valueAxisSentence(isLog('pace', pace))}` : ''}
          </>
        }
        controls={scaleToggles('pace', pace)}
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
              ? "As in a power-law plot, a curve that falls in a straight line means that code frequencies fall off as a power of their rank, as in Zipf's law. The steeper a curve falls, the faster its tail thins out. One that drops a gridline (ten times fewer events outside) for every gridline across (ten times as many codes) has a slope of −1; a flatter one has a longer tail of rarer codes. Curves bend down as they near a dataset's number of codes, where the tail runs out."
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
            distinct codes in the data that have a parent code. After the gap, each column is one vocabulary:
            the share of events whose code has a parent in it. A code can map into several vocabularies, so a
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
            <Plot
              figure={vocabularies.figure}
              minWidth={vocabularies.minWidth}
              label="Share of events mapped to any vocabulary and to each vocabulary, per dataset, heatmap"
            />
            <Typography
              variant="body2"
              color="text.secondary"
              component="p"
              sx={{ mt: 1, mb: 0, display: { xs: 'block', md: 'none' } }}
            >
              Swipe sideways to see every vocabulary.
            </Typography>
            {vocabularies.anyRecognized && (
              <Typography variant="body2" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
                {OMOP_MARK} A standard OMOP CDM vocabulary, as recognised by <code>meds_summary_stats</code>.
              </Typography>
            )}
          </>
        )}
      </ChartSection>

      <ChartSection
        {...SECTIONS.health}
        description={`Invariants every MEDS dataset should meet, from each stats file. A check mark means the check passes, a warning sign that it needs a look, and a question mark that the stats file doesn't report it. Codes with a description pass at ${formatPercent(DESCRIPTION_THRESHOLD)} or more. The versions, and codes listed in codes.parquet but not used, are information without a verdict.`}
        skipped={health.skipped}
      >
        <HealthTable model={health} />
      </ChartSection>
    </div>
  );
}
