import React, { useMemo, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Switch, Typography, useMediaQuery } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import {
  DESCRIPTION_THRESHOLD,
  OMOP_MARK,
  PACE_METRICS,
  type PaceMetric,
  type PerSubjectMetric,
  PER_SUBJECT_METRICS,
  SIZE_SORT_OPTIONS,
  type SizeOrder,
  type SizeSortKey,
  type SortDirection,
  codeCoverageChart,
  coverageChart,
  datasetName,
  defaultDirection,
  depthBreadthChart,
  formatDate,
  formatPercent,
  githubRepoUrl,
  healthCheck,
  ontologyChart,
  orderDatasets,
  paceChart,
  perSubjectChart,
  schemaDescription,
  sizeChart,
  sortDirectionOptions,
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
  LabelledToggle,
  MetricToggle,
  Plot,
} from './parts';

// The "Dataset statistics" page: charts of the `meds_summary_stats` files that dataset ETLs publish, collected at
// build time by plugins/etlSummaryStats.ts. One filter (include demo datasets) above everything it scopes, then a
// summary table with each file's provenance, then one section per chart.

/** Screens up to this width get the bubble chart's phone layout (smaller bubbles, labels for a narrow plot). */
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
  const [sizeOrder, setSizeOrder] = useState<SizeOrder>({ key: 'measurements', direction: 'desc' });
  const [perSubjectMetric, setPerSubjectMetric] = useState<PerSubjectMetric>('measurements');
  const [paceMetric, setPaceMetric] = useState<PaceMetric>('perDay');
  const [highlight, setHighlight] = useState<string | null>(null);
  const narrow = useMediaQuery(NARROW_SCREEN);

  const allEntries = useMemo(() => orderDatasets(data?.datasets ?? []), [data]);
  const entries = useMemo(
    () => allEntries.filter(entry => includeDemo || entry.variant !== 'demo'),
    [allEntries, includeDemo]
  );
  const size = useMemo(() => sizeChart(entries, sizeOrder), [entries, sizeOrder]);
  const sortLabel = (SIZE_SORT_OPTIONS.find(option => option.key === sizeOrder.key) as { label: string })
    .label;
  const depth = useMemo(() => depthBreadthChart(entries, { narrow }), [entries, narrow]);
  const perSubject = useMemo(() => perSubjectChart(entries, perSubjectMetric), [entries, perSubjectMetric]);
  const pace = useMemo(() => paceChart(entries, paceMetric), [entries, paceMetric]);
  const coverage = useMemo(() => coverageChart(entries), [entries]);
  const datasetLabels = useMemo(() => allEntries.map(entry => entry.label), [allEntries]);
  const codeCoverage = useMemo(
    () => codeCoverageChart(entries, highlight, datasetLabels),
    [entries, highlight, datasetLabels]
  );
  const vocabularies = useMemo(() => vocabularyChart(entries), [entries]);
  const ontology = useMemo(() => ontologyChart(entries), [entries]);
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
        description="Events (distinct subject and time pairs), measurements (rows) and distinct codes in each dataset, side by side. The axis is logarithmic: each gridline is ten times the last. Sort the datasets by any count or by name; the table below also lists each dataset's subjects."
        controls={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5 }}>
            <LabelledToggle label="Sort by">
              <MetricToggle
                label="Sort by"
                options={SIZE_SORT_OPTIONS}
                value={sizeOrder.key}
                onChange={(key: SizeSortKey) => setSizeOrder({ key, direction: defaultDirection(key) })}
              />
            </LabelledToggle>
            <LabelledToggle label="Order">
              <MetricToggle
                label="Order"
                options={sortDirectionOptions(sizeOrder.key)}
                value={sizeOrder.direction}
                onChange={(direction: SortDirection) => setSizeOrder({ ...sizeOrder, direction })}
              />
            </LabelledToggle>
          </Box>
        }
        skipped={size.skipped}
        table={size.table}
      >
        {size.figure && (
          <Plot
            figure={size.figure}
            label={`Events, measurements and unique codes per dataset, grouped bars, sorted by ${sortLabel.toLowerCase()}`}
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
            <strong>Measurements per day of record</strong>: the mean number of measurements per subject
            divided by the mean record span in days. This is a ratio of two averages, not the rate of a
            typical subject. A record spans a subject&apos;s first to last event, including a birth record
            where there is one, so for datasets that record births the span covers most of a lifetime and the
            ratio is low. Logarithmic axis. <strong>Measurements per event</strong>: all measurements divided
            by all events (distinct subject and time pairs), an exact figure for the whole dataset. Largest
            first.
          </>
        }
        controls={
          <MetricToggle
            label="Pace measure"
            options={PACE_METRICS}
            value={paceMetric}
            onChange={setPaceMetric}
          />
        }
        skipped={pace.skipped}
        table={pace.table}
      >
        {pace.figure && (
          <Plot
            figure={pace.figure}
            label={`${(PACE_METRICS.find(m => m.key === paceMetric) as { full: string }).full}, one bar per dataset`}
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
        id="code-coverage"
        title="Coverage of the most common codes"
        description="The share of all measurements (up) that a dataset's most frequent codes cover, against how many of them are taken (across, logarithmic). A curve that climbs steeply means that a few codes, often high-frequency vitals, make up most of the data; one that climbs slowly means the data is spread over many codes. Each curve ends where all of the dataset's codes cover 100%. The points are the published figures (the shares of the top 10, 100 and 1,000 codes, and how many codes cover 50%, 90% and 99%), joined by lines. Each dataset has its own colour, line style and marker (see the legend); click a legend entry to hide that dataset, or double-click it to show only that one. To compare one dataset against the rest, highlight it."
        controls={
          codeCoverage.options.length > 0 && (
            <DatasetSelect
              label="Highlight"
              emptyOption="None"
              options={codeCoverage.options}
              value={codeCoverage.highlighted ?? ''}
              onChange={value => setHighlight(value || null)}
            />
          )
        }
        skipped={codeCoverage.skipped}
        table={codeCoverage.table}
      >
        {codeCoverage.figure && (
          <Plot
            figure={codeCoverage.figure}
            label={`Share of measurements covered by the most frequent codes, one curve per dataset${
              codeCoverage.highlighted
                ? `, ${codeCoverage.highlighted} highlighted`
                : ', each in its own colour and line style'
            }`}
          />
        )}
      </ChartSection>

      <ChartSection
        id="vocabularies-used"
        title="Vocabularies used"
        description="The share of each dataset's measurements whose code has a parent code in each vocabulary, through the parent codes in its code metadata. A code can map into several vocabularies, so a row's shares can add up to more than the share of measurements that are mapped at all (next chart). Vocabularies used by the most datasets come first. Darker cells are larger shares, shaded on a logarithmic scale so that small vocabularies still show; a blank grey cell means the dataset doesn't use that vocabulary."
        skipped={vocabularies.skipped}
      >
        {vocabularies.figure && (
          <>
            <Plot
              figure={vocabularies.figure}
              minWidth={vocabularies.minWidth}
              label="Share of measurements per vocabulary and dataset, heatmap"
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
        id="vocabularies"
        title="Mapping to standard vocabularies"
        description="Where the code metadata links codes to parent codes in standard vocabularies such as LOINC or ICD-10: the share of measurements whose code is mapped to any vocabulary, and the share of the distinct codes in the data that are. Unlike the shares above, each measurement and code counts once."
        skipped={ontology.skipped}
        table={ontology.table}
      >
        {ontology.figure && (
          <Plot figure={ontology.figure} label="Vocabulary mapping coverage, grouped bars" />
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
