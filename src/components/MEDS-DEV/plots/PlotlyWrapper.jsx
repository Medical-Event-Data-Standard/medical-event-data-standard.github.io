import React, { useEffect, useState } from 'react';
import { CircularProgress } from '@mui/material';
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

export default function PlotlyWrapper(props) {
  const [Plot, setPlot] = useState(null);

  useEffect(() => {
    if (ExecutionEnvironment.canUseDOM) {
      // Import Plotly only on the client-side
      import('react-plotly.js').then(module => {
        setPlot(() => module.default); // Set the Plot component
      });
    }
  }, []);

  if (!Plot) {
    return <CircularProgress />;
  }

  return <Plot {...props} />;
}
