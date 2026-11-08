import React, { useMemo, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Switch, Typography, useMediaQuery } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import {
  DESCRIPTION_THRESHOLD,
  MAPPING_COLUMNS,
  NO_MAPPING,
  OMOP_MARK,
  PACE_METRICS,
  type PaceMetric,
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
} from './parts';

// The "Dataset statistics" page: charts of the `meds_summary_stats` files that dataset ETLs publish, collected at
// build time by plugins/etlSummaryStats.ts. One filter (include demo datasets) above everything it scopes, then a
// summary table with each file's provenance, then one section per chart.

/**
 * Screens up to this width get the phone layouts: smaller bubbles and labels laid out for a narrow plot in the
 * bubble chart, and a taller tail plot, whose legend takes a line per dataset.
 */
const NARROW_SCREEN = '(max-width: 760px)';

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
                <ExternalLink href={githubRepoUrl(entry.githubRepo)}>{entry.githubRepo}</ExternalLink>
              </td>
              <td title={entry.path}>
                <ExternalLink href={statsFileUrl(entry)}>{entry.path.split('/').pop()}</ExternalLink>
              </td>
              <td>{formatDate(entry.extractedAt)}</td>
              <td style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{datasetName(entry)}</td>
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
  const [perSubjectMetric, setPerSubjectMetric] = useState<PerSubjectMetric>('measurements');
  const [paceMetric, setPaceMetric] = useState<PaceMetric>('perDay');
  const [highlight, setHighlight] = useState<string | null>(null);
  const narrow = useMediaQuery(NARROW_SCREEN);

  const allEntries = useMemo(() => orderDatasets(data?.datasets ?? []), [data]);
  const entries = useMemo(
    () => allEntries.filter(entry => includeDemo || entry.variant !== 'demo'),
    [allEntries, includeDemo]
  );
  const size = useMemo(() => sizeChart(entries), [entries]);
  const depth = useMemo(() => depthBreadthChart(entries, { narrow }), [entries, narrow]);
  const perSubject = useMemo(() => perSubjectChart(entries, perSubjectMetric), [entries, perSubjectMetric]);
  const perDay = useMemo(() => paceChart(entries, 'perDay'), [entries]);
  const perEvent = useMemo(() => paceChart(entries, 'perEvent'), [entries]);
  // The per-subject rate needs a newer meds_summary_stats; until a file in view has it, only the per-event ratio
  // is shown, with a note.
  const hasPerDay = perDay.figure !== null;
  const shownPace: PaceMetric = hasPerDay ? paceMetric : 'perEvent';
  const pace = shownPace === 'perDay' ? perDay : perEvent;
  const paceLabel = (PACE_METRICS.find(m => m.key === shownPace) as { full: string }).full;
  const coverage = useMemo(() => coverageChart(entries), [entries]);
  const datasetLabels = useMemo(() => allEntries.map(entry => entry.label), [allEntries]);
  const codeTail = useMemo(
    () => codeTailChart(entries, highlight, datasetLabels, { narrow }),
    [entries, highlight, datasetLabels, narrow]
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

  const hasDemo = allEntries.some(entry => entry.variant === 'demo');
  const minCellSizes = [...new Set(allEntries.map(entry => entry.minCellSize).filter(n => n !== null))];
  const problems = entries.filter(entry => entry.problem);
  const missing = data.reposWithoutStats;

  return (
    <div>
      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        Every number here comes from the stats file that an ETL&apos;s maintainers computed on their own copy
        of the data and published in their repository; the table links to each file and gives the date it was
        extracted.
        {data.updatedAt ? ` This site collected the files on ${formatDate(data.updatedAt)}.` : ''} Cells
        backed by
        {minCellSizes.length === 1 ? ` fewer than ${minCellSizes[0]} subjects` : ' too few subjects'} are
        suppressed by <code>meds_summary_stats</code>, and are shown as suppressed, never filled in.
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

      <Box component="section" aria-labelledby="stats-files" sx={{ mb: 5 }}>
        <h2 id="stats-files">Datasets and their stats files</h2>
        <SummaryTable entries={entries} />
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
        id="dataset-size"
        title="Dataset size"
        description="Events (distinct subject and time pairs), measurements (rows) and distinct codes in each dataset, side by side, with the most measurements first. The axis is logarithmic: each gridline is ten times the last. The table below also lists each dataset's subjects."
        skipped={size.skipped}
        table={size.table}
      >
        {size.figure && (
          <Plot
            figure={size.figure}
            label="Events, measurements and unique codes per dataset, grouped bars, most measurements first"
          />
        )}
      </ChartSection>

      <ChartSection
        id="depth-breadth"
        title="Depth vs. breadth"
        description="One bubble per dataset: how many subjects it covers (across) against how much data a typical subject has, the median number of measurements per subject (up). The bubble's area shows how many distinct codes the dataset uses. Both axes are logarithmic. Datasets further right are broader, and those higher up are deeper."
        skipped={depth.skipped}
        table={depth.table}
      >
        {depth.figure && (
          <>
            <Plot
              figure={depth.figure}
              label="Subjects against median measurements per subject, one bubble per dataset, sized by unique codes"
            />
            <BubbleKey model={depth} />
          </>
        )}
      </ChartSection>

      <ChartSection
        id="per-subject"
        title="How much data each subject has"
        description="The spread across subjects: each box runs from the 25th to the 75th percentile with the median marked inside, and the whiskers reach the 5th and 95th percentiles. The stats files publish no minimum or maximum, by design. Logarithmic axis."
        controls={
          <MetricToggle
            label="Per-subject measure"
            options={PER_SUBJECT_METRICS}
            value={perSubjectMetric}
            onChange={setPerSubjectMetric}
          />
        }
        skipped={perSubject.skipped}
        table={perSubject.table}
      >
        {perSubject.figure && (
          <Plot figure={perSubject.figure} label={`${perSubjectMetric} per subject, box chart per dataset`} />
        )}
      </ChartSection>

      <ChartSection
        id="pace"
        title="Pace of measurements"
        description={
          <>
            How densely each dataset records data, largest first.{' '}
            {shownPace === 'perDay' ? (
              <>
                <strong>Per day, per subject</strong>: each subject&apos;s own rate, their timed measurements
                divided by the days from their earliest to their latest one. Birth and death records are left
                out, so that birth dates and registry deaths don&apos;t stretch the span, and subjects with
                fewer than two distinct timestamps have no rate and aren&apos;t counted. Each box runs from
                the 25th to the 75th percentile of subjects, with the median marked inside, and the whiskers
                reach the 5th and 95th percentiles. Very short records give very large rates, so the chart
                shows these percentiles rather than the mean. The datasets are ranked by their median, on a
                logarithmic axis.
              </>
            ) : (
              <>
                <strong>Per event</strong>: all measurements divided by all events (distinct subject and time
                pairs), an exact figure for the whole dataset.
              </>
            )}{' '}
            {hasPerDay ? (
              'Switch measures with the buttons.'
            ) : (
              <>
                The rate per subject, measurements per day of each subject&apos;s record, will appear here
                once the ETLs publish it with a newer release of <code>meds_summary_stats</code>.
              </>
            )}
          </>
        }
        controls={
          hasPerDay && (
            <MetricToggle
              label="Pace measure"
              options={PACE_METRICS}
              value={shownPace}
              onChange={setPaceMetric}
            />
          )
        }
        skipped={pace.skipped}
        table={pace.table}
      >
        {pace.figure && (
          <Plot
            figure={pace.figure}
            label={`${paceLabel}, ${shownPace === 'perDay' ? 'box chart' : 'one bar'} per dataset`}
          />
        )}
      </ChartSection>

      <ChartSection
        id="record-coverage"
        title="Record coverage"
        description="Birth, Death and Static: the share of subjects with a birth record, a death record and static (time-less) data. Numeric: the share of measurements that carry a numeric value. Darker cells are higher shares."
        skipped={coverage.skipped}
      >
        {coverage.figure && <Plot figure={coverage.figure} label="Record coverage per dataset, heatmap" />}
      </ChartSection>

      <ChartSection
        id="code-tail"
        title="How long the tail of codes is"
        description="For each dataset, the share of measurements whose code is not among its N most frequent codes (up), against N (across). Both axes are logarithmic, as in a power-law plot: a curve that falls in a straight line means that code frequencies fall off as a power of their rank, as in Zipf's law. The steeper a curve falls, the faster its tail thins out. One that drops a gridline (ten times fewer measurements outside) for every gridline across (ten times as many codes) has a slope of −1; a flatter one has a longer tail of rarer codes. Curves bend down as they near a dataset's number of codes, where the tail runs out. No line is fitted: the points are the published figures, joined by lines. They are the shares of the top 10, 100 and 1,000 codes, and how many codes it takes to cover 50%, 90% and 99% of measurements (leaving 50%, 10% and 1% outside). A point that leaves nothing outside, such as all of a dataset's codes, can't go on a logarithmic axis and is left out. Each dataset has its own colour, line style and marker; click a legend entry to hide that dataset, double-click it to show only that one, or highlight one to compare it against the rest."
        controls={
          codeTail.options.length > 0 && (
            <DatasetSelect
              label="Highlight"
              emptyOption="None"
              options={codeTail.options}
              value={codeTail.highlighted ?? ''}
              onChange={value => setHighlight(value || null)}
            />
          )
        }
        skipped={codeTail.skipped}
        table={codeTail.table}
      >
        {codeTail.figure && (
          <Plot
            figure={codeTail.figure}
            label={`Share of measurements outside the most frequent codes against the number of codes, both logarithmic, one curve per dataset${
              codeTail.highlighted
                ? `, ${codeTail.highlighted} highlighted`
                : ', each in its own colour and line style'
            }`}
          />
        )}
      </ChartSection>

      <ChartSection
        id="vocabularies"
        title="Mapping to vocabularies"
        description={
          <>
            How each dataset&apos;s codes map to vocabularies such as LOINC or ICD-10, through the parent
            codes in its code metadata. Every cell is a share, printed and shaded on a logarithmic scale
            (darker is larger) so that small shares still show. The first two columns count each measurement
            and code once: <strong>{MAPPING_COLUMNS[0].label}</strong> is the share of measurements whose code
            maps to any vocabulary, de-duplicated, and <strong>{MAPPING_COLUMNS[1].label}</strong> the share
            of the distinct codes in the data that have a parent code. After the gap, each column is one
            vocabulary: the share of measurements whose code has a parent in it. A code can map into several
            vocabularies, so a row&apos;s vocabulary shares can add up to more than its{' '}
            {MAPPING_COLUMNS[0].label} share. Vocabularies used by the most datasets come first, and a blank
            grey cell means the dataset doesn&apos;t use that vocabulary. Datasets whose code metadata maps no
            codes show 0% and &ldquo;{NO_MAPPING}&rdquo;.
          </>
        }
        skipped={vocabularies.skipped}
      >
        {vocabularies.figure && (
          <>
            <Plot
              figure={vocabularies.figure}
              minWidth={vocabularies.minWidth}
              label="Share of measurements mapped to any vocabulary and to each vocabulary, per dataset, heatmap"
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
        id="health-check"
        title="Health check"
        description={`Invariants every MEDS dataset should meet, from each stats file. A check mark means the check passes, a warning sign that it needs a look, and a question mark that the stats file doesn't report it. Codes with a description pass at ${formatPercent(DESCRIPTION_THRESHOLD)} or more. The versions, and codes listed in codes.parquet but not used, are information without a verdict.`}
        skipped={health.skipped}
      >
        <HealthTable model={health} />
      </ChartSection>
    </div>
  );
}
