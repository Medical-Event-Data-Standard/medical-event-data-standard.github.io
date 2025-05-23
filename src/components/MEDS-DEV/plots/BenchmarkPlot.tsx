import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { CircularProgress, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { Data } from 'plotly.js';

import { loadMedsDevResults } from '@site/src/lib/MEDS-DEV/load';
import { BenchmarkEntryWithId, Result } from '@site/src/lib/MEDS-DEV/types';

interface BenchmarkInnerProps {
  datasetFilter?: string;
  modelFilter?: string;
  taskFilter?: string;
}

interface BenchmarkPlotProps {
  datasetFilter?: string;
  modelFilter?: string;
  taskFilter?: string;
}

function BenchmarkInner({ datasetFilter, modelFilter, taskFilter }: BenchmarkInnerProps): React.JSX.Element {
  const [results, setResults] = useState<BenchmarkEntryWithId[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataset, setDataset] = useState<string>(datasetFilter || '');
  const [task, setTask] = useState<string>(taskFilter || '');
  const [model, setModel] = useState<string>(modelFilter || '');
  const [metricSet, setMetricSet] = useState<string>('samples_equally_weighted');

  useEffect(() => {
    loadMedsDevResults()
      .then(setResults)
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) return <CircularProgress />;

  const allDatasets = [...new Set(results.map(r => r.dataset))].sort();
  const filteredByDataset = dataset ? results.filter(r => r.dataset === dataset) : results;

  const allTasks = [...new Set(filteredByDataset.map(r => r.task))].sort();
  const filteredByTask = task ? filteredByDataset.filter(r => r.task === task) : filteredByDataset;

  const allModels = [...new Set(filteredByTask.map(r => r.model))].sort();
  const filtered = model ? filteredByTask.filter(r => r.model === model) : filteredByTask;

  const plotData: Data[] = filtered.map(r => {
    const metrics = r.result?.[metricSet as keyof Result] || {};
    return {
      x: ['ROC AUC', 'Avg Precision', 'F1 Score'],
      y: [
        (metrics as any).roc_auc_score ?? 0,
        (metrics as any).average_precision_score ?? 0,
        (metrics as any).f1_score ?? 0,
      ],
      type: 'bar',
      name: r.model,
      hovertext: `Issue: ${r.id}<br>Dataset: ${r.dataset}<br>Task: ${r.task}<br>Model: ${r.model}<br>Version: ${r.version}<br>${metricSet}`,
    };
  });

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        MEDS-DEV Benchmark Leaderboard
      </Typography>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Dataset</InputLabel>
          <Select
            value={dataset}
            label="Dataset"
            onChange={e => {
              setDataset(e.target.value);
              setTask('');
            }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {allDatasets.map(d => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Task</InputLabel>
          <Select value={task} label="Task" onChange={e => setTask(e.target.value)}>
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {allTasks.map(t => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Model</InputLabel>
          <Select value={model} label="Model" onChange={e => setModel(e.target.value)}>
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {allModels.map(m => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>Metric Set</InputLabel>
          <Select value={metricSet} label="Metric Set" onChange={e => setMetricSet(e.target.value)}>
            <MenuItem value="samples_equally_weighted">Samples Weighted</MenuItem>
            <MenuItem value="subjects_equally_weighted">Subjects Weighted</MenuItem>
          </Select>
        </FormControl>
      </div>

      <Plot
        data={plotData}
        layout={{
          barmode: 'group',
          title: { text: `Metric Scores${dataset ? ` for ${dataset}` : ''}${task ? ` – ${task}` : ''}` },
          xaxis: { title: { text: 'Metric' } },
          yaxis: { title: { text: 'Score' }, range: [0, 1] },
          autosize: true,
        }}
        style={{ width: '100%', height: '600px' }}
        useResizeHandler
        config={{ responsive: true }}
      />
    </div>
  );
}

export default function BenchmarkPlot({
  datasetFilter,
  modelFilter,
  taskFilter,
}: BenchmarkPlotProps): React.JSX.Element {
  return (
    <BrowserOnly fallback={<div>Loading client-side plot...</div>}>
      {() => (
        <BenchmarkInner datasetFilter={datasetFilter} modelFilter={modelFilter} taskFilter={taskFilter} />
      )}
    </BrowserOnly>
  );
}
