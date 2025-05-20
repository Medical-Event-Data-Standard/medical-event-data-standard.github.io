import React, { useEffect, useState } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { loadMedsDev } from '@site/src/lib/load';

export default function EntityPage({ target, Entity }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedsDev(target)
      .then(res => {
        setData(res);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [target]);

  if (loading) return <CircularProgress />;
  if (!data) return <Typography>{`No ${target} entities found.`}</Typography>;

  //data is an object mapping dataset names to their metadata
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {' '}
        {target}{' '}
      </Typography>

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
