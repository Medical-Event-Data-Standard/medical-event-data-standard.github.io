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

import { load_MEDS_DEV } from '@site/src/lib/load';

export default function EntityPage({ target, Entity }) {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load_MEDS_DEV(target)
    .then((res => { setData(res); }))
    .finally(() => { setLoading(false); })
  }, []);

  if (loading) return <CircularProgress />;
  if (!data) return <Typography>{`No ${target} entities found.`}</Typography>;

  //data is an object mapping dataset names to their metadata
  return (
    <Box>
      <Typography variant="h4" gutterBottom> {target} </Typography>

      {Object.entries(data).map(([name, entity]) => (
        <Accordion key={name}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${name}-content`}
            id={`${name}-header`}
          >
            <Typography variant="h5">{name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Entity key={name} name={name} data={entity} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
