import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import {
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { load_MEDS_DEV, RESULTS } from '@site/src/MEDS-DEV/load.js';
import BrowserOnly from '@docusaurus/BrowserOnly';


function BenchmarkInner() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState('');
  const [task, setTask] = useState('');
  const [metricSet, setMetricSet] = useState('samples_equally_weighted');

  useEffect(() => {
    load_MEDS_DEV(RESULTS)
    .then((res => { setResults(res); }))
    .finally(() => { setLoading(false); })
  }, []);

  if (loading) return <CircularProgress />;

  const allDatasets = [...new Set(results.map((r) => r.dataset))].sort();
  const filteredByDataset = dataset ? results.filter((r) => r.dataset === dataset) : results;
  const allTasks = [...new Set(filteredByDataset.map((r) => r.task))].sort();
  const filtered = task ? filteredByDataset.filter((r) => r.task === task) : filteredByDataset;

  const plotData = filtered.map((r) => {
    const metrics = r.result?.[metricSet] || {};
    return {
      x: ['ROC AUC', 'Avg Precision', 'F1 Score'],
      y: [
        metrics.roc_auc_score ?? 0,
        metrics.average_precision_score ?? 0,
        metrics.f1_score ?? 0,
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
          <Select value={dataset} label="Dataset" onChange={(e) => {
            setDataset(e.target.value);
            setTask('');
          }}>
            <MenuItem value=""><em>All</em></MenuItem>
            {allDatasets.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 300 }}>
          <InputLabel>Task</InputLabel>
          <Select value={task} label="Task" onChange={(e) => setTask(e.target.value)}>
            <MenuItem value=""><em>All</em></MenuItem>
            {allTasks.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>Metric Set</InputLabel>
          <Select value={metricSet} label="Metric Set" onChange={(e) => setMetricSet(e.target.value)}>
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

export default function BenchmarkPlot() {
  return (
    <BrowserOnly fallback={<div>Loading client-side plot...</div>}>
      {() => <BenchmarkInner />}
    </BrowserOnly>
  );
}
