import React, { useEffect, useState } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  Paper,
  Link,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { load_MEDS_DEV, DATASETS } from '@site/src/MEDS-DEV/load.js';
import Dataset from './Dataset';


export default function Datasets() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load_MEDS_DEV(DATASETS)
    .then((res => { setData(res); }))
    .finally(() => { setLoading(false); })
  }, []);

  if (loading) return <CircularProgress />;
  if (!data) return <Typography>No datasets found.</Typography>;

  //data is an object mapping dataset names to their metadata
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Datasets
      </Typography>

      {Object.entries(data).map(([datasetName, dataset]) => (
        <Accordion key={datasetName}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${datasetName}-content`}
            id={`${datasetName}-header`}
          >
            <Typography variant="h5">{datasetName}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Dataset key={datasetName} name={datasetName} data={dataset} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
