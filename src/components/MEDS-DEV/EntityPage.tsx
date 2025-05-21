import { useEffect, useState } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { loadEntities } from '@site/src/lib/MEDS-DEV/load';
import { MedsDatasets, MedsTasks, MedsModels, MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

interface EntityProps {
  name: string;
  data: any;
}

interface EntityPageProps {
  target: MedsEntityType;
  Entity: React.ComponentType<EntityProps>;
}

export default function EntityPage<T = MedsDatasets | MedsTasks | MedsModels>({
  target,
  Entity,
}: EntityPageProps): React.JSX.Element {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadEntities<T>(target)
      .then((res: T | null) => {
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
        {target}
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
