import React, { useMemo, useState } from 'react';
import { Alert, Box, FormControlLabel, Paper, Switch, Typography } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import {
  type PerSubjectMetric,
  PER_SUBJECT_METRICS,
  type SizeMetric,
  SIZE_METRICS,
  type YearMetric,
  concentrationChart,
  coverageChart,
  datasetName,
  formatDate,
  githubRepoUrl,
  ontologyChart,
  orderDatasets,
  perSubjectChart,
  schemaDescription,
  sizeChart,
  splitChart,
  statsFileUrl,
  yearPanels,
} from '@site/src/lib/etlSummaryStats/charts';
import {
  ETL_SUMMARY_STATS_PLUGIN,
  type EtlStatsData,
  type EtlStatsEntry,
} from '@site/src/lib/etlSummaryStats/types';
import { COMPACT_TABLE, ChartSection, ExternalLink, MetricToggle, Plot } from './parts';

// The "Dataset statistics" page: charts of the `meds_summary_stats` files that dataset ETLs publish, collected at
// build time by plugins/etlSummaryStats.ts. One filter (include demo datasets) above everything it scopes, then a
// summary table with each file's provenance, then one section per chart.

const YEAR_METRICS: { key: YearMetric; label: string }[] = [
  { key: 'measurements', label: 'Measurements' },
  { key: 'subjects', label: 'Subjects' },
];

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
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('subjects');
  const [perSubjectMetric, setPerSubjectMetric] = useState<PerSubjectMetric>('measurements');
  const [yearMetric, setYearMetric] = useState<YearMetric>('measurements');

  const allEntries = useMemo(() => orderDatasets(data?.datasets ?? []), [data]);
  const entries = useMemo(
    () => allEntries.filter(entry => includeDemo || entry.variant !== 'demo'),
    [allEntries, includeDemo]
  );
  const size = useMemo(() => sizeChart(entries, sizeMetric), [entries, sizeMetric]);
  const perSubject = useMemo(() => perSubjectChart(entries, perSubjectMetric), [entries, perSubjectMetric]);
  const years = useMemo(() => yearPanels(entries, yearMetric), [entries, yearMetric]);
  const splits = useMemo(() => splitChart(entries), [entries]);
  const coverage = useMemo(() => coverageChart(entries), [entries]);
  const concentration = useMemo(() => concentrationChart(entries), [entries]);
  const ontology = useMemo(() => ontologyChart(entries), [entries]);

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
        description="Subjects, events (distinct subject and time pairs), measurements (rows) and distinct codes in each dataset. The axis is logarithmic: each gridline is ten times the last."
        controls={
          <MetricToggle
            label="Size measure"
            options={SIZE_METRICS}
            value={sizeMetric}
            onChange={setSizeMetric}
          />
        }
        skipped={size.skipped}
        table={size.table}
      >
        {size.figure && <Plot figure={size.figure} label={`${sizeMetric} per dataset, bar chart`} />}
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
        id="calendar-years"
        title="Data over calendar years"
        description="Measurements (or subjects with data) in each calendar year. Many datasets shift dates to de-identify them, so these are often not real years: MIMIC-IV's lie in the 22nd century, for example. Birth records reach back decades. A year that isn't reported, because it has no data or was suppressed, has no column. Each chart has its own axes."
        controls={
          <MetricToggle
            label="Yearly measure"
            options={YEAR_METRICS}
            value={yearMetric}
            onChange={setYearMetric}
          />
        }
        skipped={years.skipped}
        table={years.table}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
            gap: 2,
          }}
        >
          {years.panels.map(panel => (
            <div key={panel.label}>
              <Typography variant="subtitle2" component="h3" sx={{ m: 0 }}>
                {panel.label}
              </Typography>
              <Plot figure={panel.figure} label={`${yearMetric} per calendar year in ${panel.label}`} />
              {panel.note && (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
                  {panel.note}
                </Typography>
              )}
            </div>
          ))}
        </Box>
      </ChartSection>

      <ChartSection
        id="splits"
        title="Train, tuning and held-out splits"
        description="How each dataset's subjects are divided between the MEDS splits, as a share of the subjects in its splits."
        skipped={splits.skipped}
        table={splits.table}
      >
        {splits.figure && <Plot figure={splits.figure} label="Share of subjects per split, stacked bars" />}
      </ChartSection>

      <ChartSection
        id="record-coverage"
        title="Record coverage"
        description="Birth, Death and Static: the share of subjects with a birth record, a death record and static (time-less) data. Numeric: the share of measurements that carry a numeric value. Darker cells are higher shares."
        skipped={coverage.skipped}
        table={coverage.table}
      >
        {coverage.figure && <Plot figure={coverage.figure} label="Record coverage per dataset, heatmap" />}
      </ChartSection>

      <ChartSection
        id="code-concentration"
        title="Code concentration"
        description="The share of all measurements whose code is among the dataset's 10, 100 and 1,000 most frequent codes. Dots far to the right mean that a few codes, often high-frequency vitals, make up most of the data."
        skipped={concentration.skipped}
        table={concentration.table}
      >
        {concentration.figure && (
          <Plot
            figure={concentration.figure}
            label="Share of measurements in the most frequent codes, dot plot"
          />
        )}
      </ChartSection>

      <ChartSection
        id="vocabularies"
        title="Mapping to standard vocabularies"
        description="Where the code metadata links codes to parent codes in standard vocabularies such as LOINC or ICD-10: the share of measurements whose code is mapped, and the share of the distinct codes in the data that are. The table lists the vocabularies."
        skipped={ontology.skipped}
        table={ontology.table}
      >
        {ontology.figure && (
          <Plot figure={ontology.figure} label="Vocabulary mapping coverage, grouped bars" />
        )}
      </ChartSection>
    </div>
  );
}
