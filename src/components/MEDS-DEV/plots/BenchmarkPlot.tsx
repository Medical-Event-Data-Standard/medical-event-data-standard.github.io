import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { Data, Layout } from 'plotly.js';

import { loadMedsDevResults } from '@site/src/lib/MEDS-DEV/load';
import { BenchmarkEntryWithId, Metrics, Result } from '@site/src/lib/MEDS-DEV/types';
import PlotlyWrapper from '@site/src/components/MEDS-DEV/plots/PlotlyWrapper';

// ─── Constants & Types ───────────────────────────────────────────

const METRIC_OPTIONS: { key: keyof Metrics; label: string; description: string }[] = [
  { key: 'roc_auc_score', label: 'AUROC', description: 'Area under ROC curve' },
  {
    key: 'average_precision_score',
    label: 'Avg Precision',
    description: 'Average precision (area under PR curve)',
  },
  { key: 'f1_score', label: 'F1 Score', description: 'F1 score at default threshold' },
  { key: 'binary_accuracy', label: 'Accuracy', description: 'Binary classification accuracy' },
];

const METRIC_SET_OPTIONS = [
  { key: 'samples_equally_weighted', label: 'Sample-weighted' },
  { key: 'subjects_equally_weighted', label: 'Subject-weighted' },
];

// Color palette for models (colorblind-friendly)
const MODEL_COLORS: Record<string, string> = {};
const PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#be185d',
  '#65a30d',
  '#7c3aed',
  '#d97706',
];

function getModelColor(model: string): string {
  if (!MODEL_COLORS[model]) {
    const idx = Object.keys(MODEL_COLORS).length % PALETTE.length;
    MODEL_COLORS[model] = PALETTE[idx];
  }
  return MODEL_COLORS[model];
}

// ─── Utility Functions ───────────────────────────────────────────

/** Extract short task name from full path, e.g. "mortality/in_icu/first_24h" → "In ICU (24h)" */
function shortTaskName(task: string): string {
  const parts = task.split('/');
  // Remove common suffixes like "first_24h"
  const timeframe = parts[parts.length - 1];
  const core = parts.slice(0, -1).join('/');
  const timeSuffix = timeframe === 'first_24h' ? '24h' : timeframe.replace(/_/g, ' ');
  const coreName = core
    .split('/')
    .slice(1)
    .map(p => p.replace(/_/g, ' '))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' → ');
  return `${coreName} (${timeSuffix})`;
}

/** Extract task family from full task path */
function taskFamily(task: string): string {
  return task
    .split('/')[0]
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getMetricValue(
  entry: BenchmarkEntryWithId,
  metricSet: string,
  metricKey: keyof Metrics
): number | null {
  const metrics = entry.result?.[metricSet as keyof Result];
  if (!metrics) return null;
  const val = (metrics as Metrics)[metricKey];
  return val ?? null;
}

/** Get cell background color for a value given the range [0, 1], relative to the best in the row */
function cellColor(value: number | null, bestInRow: number | null): string {
  if (value === null) return 'transparent';
  if (bestInRow !== null && value === bestInRow) return 'rgba(22, 163, 74, 0.15)';
  if (value >= 0.7) return 'rgba(22, 163, 74, 0.07)';
  if (value >= 0.5) return 'rgba(234, 179, 8, 0.07)';
  return 'rgba(220, 38, 38, 0.05)';
}

// ─── Shared Filter Bar ──────────────────────────────────────────

interface FilterBarProps {
  allDatasets: string[];
  dataset: string;
  setDataset: (v: string) => void;
  metricSet: string;
  setMetricSet: (v: string) => void;
  metricKey: keyof Metrics;
  setMetricKey: (v: keyof Metrics) => void;
  showMetricSelector?: boolean;
}

function FilterBar({
  allDatasets,
  dataset,
  setDataset,
  metricSet,
  setMetricSet,
  metricKey,
  setMetricKey,
  showMetricSelector = true,
}: FilterBarProps) {
  return (
    <Box sx={{ display: 'flex', gap: '1rem', mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel>Dataset</InputLabel>
        <Select value={dataset} label="Dataset" onChange={e => setDataset(e.target.value)}>
          {allDatasets.length === 1 ? (
            <MenuItem value={allDatasets[0]}>{allDatasets[0]}</MenuItem>
          ) : (
            [
              <MenuItem key="__all" value="">
                <em>All</em>
              </MenuItem>,
              ...allDatasets.map(d => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              )),
            ]
          )}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel>Weighting</InputLabel>
        <Select value={metricSet} label="Weighting" onChange={e => setMetricSet(e.target.value)}>
          {METRIC_SET_OPTIONS.map(m => (
            <MenuItem key={m.key} value={m.key}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {showMetricSelector && (
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Metric</InputLabel>
          <Select
            value={metricKey}
            label="Metric"
            onChange={e => setMetricKey(e.target.value as keyof Metrics)}
          >
            {METRIC_OPTIONS.map(m => (
              <MenuItem key={m.key} value={m.key}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
}

// ─── View 1: Leaderboard Table ──────────────────────────────────

interface LeaderboardViewProps {
  results: BenchmarkEntryWithId[];
  metricSet: string;
  metricKey: keyof Metrics;
}

function LeaderboardView({ results, metricSet, metricKey }: LeaderboardViewProps) {
  const models = useMemo(() => [...new Set(results.map(r => r.model))].sort(), [results]);
  const tasks = useMemo(() => [...new Set(results.map(r => r.task))].sort(), [results]);
  const families = useMemo(() => [...new Set(tasks.map(taskFamily))], [tasks]);

  // Build lookup: task → model → value
  const lookup = useMemo(() => {
    const m = new Map<string, Map<string, number | null>>();
    for (const r of results) {
      if (!m.has(r.task)) m.set(r.task, new Map());
      m.get(r.task)!.set(r.model, getMetricValue(r, metricSet, metricKey));
    }
    return m;
  }, [results, metricSet, metricKey]);

  if (tasks.length === 0) {
    return <Typography color="textSecondary">No results match current filters.</Typography>;
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Task</TableCell>
            {models.map(m => (
              <TableCell key={m} align="center" sx={{ fontWeight: 700, minWidth: 100 }}>
                <Chip
                  label={m}
                  size="small"
                  sx={{
                    backgroundColor: getModelColor(m),
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                  }}
                />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {families.map(family => {
            const familyTasks = tasks.filter(t => taskFamily(t) === family);
            return (
              <React.Fragment key={family}>
                <TableRow>
                  <TableCell
                    colSpan={models.length + 1}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      backgroundColor: 'rgba(0,0,0,0.03)',
                      color: 'text.secondary',
                      py: 0.75,
                    }}
                  >
                    {family}
                  </TableCell>
                </TableRow>
                {familyTasks.map(task => {
                  const taskRow = lookup.get(task);
                  const values = models.map(m => taskRow?.get(m) ?? null);
                  const validValues = values.filter((v): v is number => v !== null);
                  const best = validValues.length > 0 ? Math.max(...validValues) : null;

                  return (
                    <TableRow key={task} hover>
                      <TableCell sx={{ fontSize: '0.82rem', pl: 3 }}>
                        <Tooltip title={task} placement="right" arrow>
                          <span>{shortTaskName(task)}</span>
                        </Tooltip>
                      </TableCell>
                      {models.map((m, i) => {
                        const val = values[i];
                        const isBest = val !== null && best !== null && val === best;
                        return (
                          <TableCell
                            key={m}
                            align="center"
                            sx={{
                              backgroundColor: cellColor(val, best),
                              fontWeight: isBest ? 700 : 400,
                              fontSize: '0.82rem',
                              fontFamily: 'monospace',
                              transition: 'background-color 0.2s',
                            }}
                          >
                            {val !== null ? val.toFixed(3) : '—'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── View 2: Heatmap ────────────────────────────────────────────

interface HeatmapViewProps {
  results: BenchmarkEntryWithId[];
  metricSet: string;
  metricKey: keyof Metrics;
}

function HeatmapView({ results, metricSet, metricKey }: HeatmapViewProps) {
  const models = useMemo(() => [...new Set(results.map(r => r.model))].sort(), [results]);
  const tasks = useMemo(() => [...new Set(results.map(r => r.task))].sort(), [results]);

  const z = useMemo(() => {
    const zArr: (number | typeof NaN)[][] = [];
    for (const task of tasks) {
      const row: (number | typeof NaN)[] = [];
      for (const model of models) {
        const entry = results.find(r => r.task === task && r.model === model);
        const val = entry ? getMetricValue(entry, metricSet, metricKey) : null;
        row.push(val ?? NaN);
      }
      zArr.push(row);
    }
    return zArr;
  }, [results, models, tasks, metricSet, metricKey]);

  if (tasks.length === 0) {
    return <Typography color="textSecondary">No results match current filters.</Typography>;
  }

  const metricLabel = METRIC_OPTIONS.find(m => m.key === metricKey)?.label || metricKey;

  const plotData: Data[] = [
    {
      z,
      x: models,
      y: tasks.map(shortTaskName),
      texttemplate: '%{z:.3f}',
      type: 'heatmap',
      colorscale: [
        [0, '#fee2e2'],
        [0.5, '#fef9c3'],
        [1, '#bbf7d0'],
      ],
      zmin: 0,
      zmax: 1,
      hoverongaps: false,
      colorbar: { title: { text: metricLabel } },
    } as Data,
  ];

  const layout: Partial<Layout> = {
    title: { text: `${metricLabel} by Task × Model` },
    xaxis: { title: { text: 'Model' }, side: 'bottom' },
    yaxis: { automargin: true },
    margin: { l: 250, r: 80, t: 60, b: 60 },
    autosize: true,
  };

  return (
    <PlotlyWrapper
      data={plotData}
      layout={layout}
      style={{ width: '100%', height: Math.max(400, tasks.length * 50 + 120) + 'px' }}
      useResizeHandler
      config={{ responsive: true }}
    />
  );
}

// ─── View 3: Model Rankings ─────────────────────────────────────

interface RankingsViewProps {
  results: BenchmarkEntryWithId[];
  metricSet: string;
  metricKey: keyof Metrics;
}

function RankingsView({ results, metricSet, metricKey }: RankingsViewProps) {
  const models = useMemo(() => [...new Set(results.map(r => r.model))].sort(), [results]);
  const tasks = useMemo(() => [...new Set(results.map(r => r.task))].sort(), [results]);

  const { winCounts, avgRanks } = useMemo(() => {
    const wins: Record<string, number> = {};
    const rankSums: Record<string, number> = {};
    const rankCounts: Record<string, number> = {};

    for (const m of models) {
      wins[m] = 0;
      rankSums[m] = 0;
      rankCounts[m] = 0;
    }

    for (const task of tasks) {
      const taskResults = results.filter(r => r.task === task);
      const scored = taskResults
        .map(r => ({ model: r.model, score: getMetricValue(r, metricSet, metricKey) }))
        .filter(s => s.score !== null)
        .sort((a, b) => (b.score as number) - (a.score as number));

      scored.forEach((s, idx) => {
        const rank = idx + 1;
        rankSums[s.model] = (rankSums[s.model] || 0) + rank;
        rankCounts[s.model] = (rankCounts[s.model] || 0) + 1;
        if (rank === 1) wins[s.model] = (wins[s.model] || 0) + 1;
      });
    }

    const avg: Record<string, number> = {};
    for (const m of models) {
      avg[m] = rankCounts[m] > 0 ? rankSums[m] / rankCounts[m] : models.length;
    }

    return { winCounts: wins, avgRanks: avg };
  }, [results, models, tasks, metricSet, metricKey]);

  if (tasks.length === 0 || models.length === 0) {
    return <Typography color="textSecondary">No results match current filters.</Typography>;
  }

  const metricLabel = METRIC_OPTIONS.find(m => m.key === metricKey)?.label || metricKey;
  const sortedModels = [...models].sort((a, b) => avgRanks[a] - avgRanks[b]);

  const plotData: Data[] = [
    {
      x: sortedModels,
      y: sortedModels.map(m => winCounts[m]),
      type: 'bar',
      marker: { color: sortedModels.map(getModelColor) },
      text: sortedModels.map(m => `${winCounts[m]}/${tasks.length}`),
      textposition: 'auto',
      hovertemplate: '%{x}<br>Wins: %{y}/' + tasks.length + '<br>Avg Rank: %{customdata:.2f}<extra></extra>',
      customdata: sortedModels.map(m => avgRanks[m]),
    } as Data,
  ];

  const layout: Partial<Layout> = {
    title: { text: `Win Count by ${metricLabel} (across ${tasks.length} tasks)` },
    xaxis: { title: { text: 'Model' } },
    yaxis: { title: { text: 'Tasks Won' }, dtick: 1, range: [0, tasks.length + 0.5] },
    autosize: true,
    margin: { t: 60, b: 60 },
    showlegend: false,
  };

  return (
    <Box>
      <PlotlyWrapper
        data={plotData}
        layout={layout}
        style={{ width: '100%', height: '400px' }}
        useResizeHandler
        config={{ responsive: true }}
      />

      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, maxWidth: 500 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Wins
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Avg Rank
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedModels.map(m => (
              <TableRow key={m}>
                <TableCell>
                  <Chip
                    label={m}
                    size="small"
                    sx={{ backgroundColor: getModelColor(m), color: '#fff', fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="center" sx={{ fontFamily: 'monospace' }}>
                  {winCounts[m]} / {tasks.length}
                </TableCell>
                <TableCell align="center" sx={{ fontFamily: 'monospace' }}>
                  {avgRanks[m].toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── View 4: Per-Task Detail ────────────────────────────────────

interface PerTaskViewProps {
  results: BenchmarkEntryWithId[];
  metricSet: string;
}

function PerTaskView({ results, metricSet }: PerTaskViewProps) {
  const tasks = useMemo(() => [...new Set(results.map(r => r.task))].sort(), [results]);
  const [selectedTask, setSelectedTask] = useState<string>(tasks[0] || '');

  useEffect(() => {
    if (tasks.length > 0 && !tasks.includes(selectedTask)) {
      setSelectedTask(tasks[0]);
    }
  }, [tasks, selectedTask]);

  const taskResults = useMemo(() => results.filter(r => r.task === selectedTask), [results, selectedTask]);

  if (tasks.length === 0) {
    return <Typography color="textSecondary">No results match current filters.</Typography>;
  }

  const models = taskResults.map(r => r.model).sort();

  const plotData: Data[] = METRIC_OPTIONS.map(metric => ({
    x: models,
    y: models.map(m => {
      const entry = taskResults.find(r => r.model === m);
      return entry ? (getMetricValue(entry, metricSet, metric.key) ?? 0) : 0;
    }),
    type: 'bar',
    name: metric.label,
    hovertemplate: `%{x}<br>${metric.label}: %{y:.3f}<extra></extra>`,
  })) as Data[];

  const layout: Partial<Layout> = {
    barmode: 'group',
    title: { text: shortTaskName(selectedTask) },
    xaxis: { title: { text: 'Model' } },
    yaxis: { title: { text: 'Score' }, range: [0, 1] },
    autosize: true,
    margin: { t: 60, b: 80 },
    legend: { orientation: 'h', y: -0.2 },
  };

  return (
    <Box>
      <FormControl size="small" sx={{ minWidth: 400, mb: 2 }}>
        <InputLabel>Task</InputLabel>
        <Select value={selectedTask} label="Task" onChange={e => setSelectedTask(e.target.value)}>
          {tasks.map(t => (
            <MenuItem key={t} value={t}>
              {shortTaskName(t)}
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({taskFamily(t)})
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <PlotlyWrapper
        data={plotData}
        layout={layout}
        style={{ width: '100%', height: '450px' }}
        useResizeHandler
        config={{ responsive: true }}
      />
    </Box>
  );
}

// ─── Main Component ─────────────────────────────────────────────

interface BenchmarkPlotProps {
  datasetFilter?: string;
  modelFilter?: string;
  taskFilter?: string;
}

function BenchmarkInner({ datasetFilter, modelFilter, taskFilter }: BenchmarkPlotProps) {
  const [allResults, setAllResults] = useState<BenchmarkEntryWithId[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tab, setTab] = useState<number>(0);

  // Filters
  const [dataset, setDataset] = useState<string>(datasetFilter || '');
  const [metricSet, setMetricSet] = useState<string>('samples_equally_weighted');
  const [metricKey, setMetricKey] = useState<keyof Metrics>('roc_auc_score');

  useEffect(() => {
    loadMedsDevResults()
      .then(setAllResults)
      .finally(() => setLoading(false));
  }, []);

  // Auto-select single dataset
  const allDatasets = useMemo(() => [...new Set(allResults.map(r => r.dataset))].sort(), [allResults]);
  useEffect(() => {
    if (allDatasets.length === 1 && !dataset) {
      setDataset(allDatasets[0]);
    }
  }, [allDatasets, dataset]);

  // Apply filters
  const filtered = useMemo(() => {
    let r = allResults;
    if (dataset) r = r.filter(x => x.dataset === dataset);
    if (modelFilter) r = r.filter(x => x.model === modelFilter);
    if (taskFilter) r = r.filter(x => x.task === taskFilter);
    return r;
  }, [allResults, dataset, modelFilter, taskFilter]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const resultCount = filtered.length;
  const modelCount = new Set(filtered.map(r => r.model)).size;
  const taskCount = new Set(filtered.map(r => r.task)).size;

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        MEDS-DEV Benchmark
      </Typography>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        {resultCount} results across {modelCount} models and {taskCount} tasks
        {dataset ? ` on ${dataset}` : ''}
      </Typography>

      <FilterBar
        allDatasets={allDatasets}
        dataset={dataset}
        setDataset={setDataset}
        metricSet={metricSet}
        setMetricSet={setMetricSet}
        metricKey={metricKey}
        setMetricKey={setMetricKey}
        showMetricSelector={tab !== 3} // Per-task view shows all metrics
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="Leaderboard" />
          <Tab label="Heatmap" />
          <Tab label="Model Rankings" />
          <Tab label="Per-Task Detail" />
        </Tabs>
      </Box>

      {tab === 0 && <LeaderboardView results={filtered} metricSet={metricSet} metricKey={metricKey} />}
      {tab === 1 && <HeatmapView results={filtered} metricSet={metricSet} metricKey={metricKey} />}
      {tab === 2 && <RankingsView results={filtered} metricSet={metricSet} metricKey={metricKey} />}
      {tab === 3 && <PerTaskView results={filtered} metricSet={metricSet} />}
    </Box>
  );
}

export default function BenchmarkPlot(props: BenchmarkPlotProps): React.JSX.Element {
  return (
    <BrowserOnly fallback={<div>Loading benchmark data...</div>}>
      {() => <BenchmarkInner {...props} />}
    </BrowserOnly>
  );
}
