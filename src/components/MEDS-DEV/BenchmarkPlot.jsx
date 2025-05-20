import React, { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';
import { CircularProgress, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { loadMedsDev, MedsTarget } from '@site/src/lib/load';
import BrowserOnly from '@docusaurus/BrowserOnly';

function BenchmarkInner({ datasetFilter, modelFilter, taskFilter }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState(datasetFilter || '');
  const [task, setTask] = useState(taskFilter || '');
  const [model, setModel] = useState(modelFilter || '');
  const [metricSet, setMetricSet] = useState('samples_equally_weighted');

  useEffect(() => {
    loadMedsDev(MedsTarget.RESULTS)
      .then(res => {
        setResults(res);
      })
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

  const plotData = filtered.map(r => {
    const metrics = r.result?.[metricSet] || {};
    return {
      x: ['ROC AUC', 'Avg Precision', 'F1 Score'],
      y: [metrics.roc_auc_score ?? 0, metrics.average_precision_score ?? 0, metrics.f1_score ?? 0],
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
          title: `Metric Scores${dataset ? ` for ${dataset}` : ''}${task ? ` – ${task}` : ''}`,
          xaxis: { title: 'Metric' },
          yaxis: { title: 'Score', range: [0, 1] },
          autosize: true,
        }}
        style={{ width: '100%', height: '600px' }}
        useResizeHandler
        config={{ responsive: true }}
      />
    </div>
  );
}

export default function BenchmarkPlot({ datasetFilter, modelFilter, taskFilter }) {
  return (
    <BrowserOnly fallback={<div>Loading client-side plot...</div>}>
      {() => (
        <BenchmarkInner datasetFilter={datasetFilter} modelFilter={modelFilter} taskFilter={taskFilter} />
      )}
    </BrowserOnly>
  );
}
