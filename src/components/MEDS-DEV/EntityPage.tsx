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
import { MedsEntityType, MedsEntityFlatTree, MedsEntityFlatTreeNode } from '@site/src/lib/MEDS-DEV/types';

interface EntityProps<T> {
  name: string;
  data: MedsEntityFlatTreeNode<T>;
}

interface EntityPageProps<T> {
  target: MedsEntityType;
  Entity: React.ComponentType<EntityProps<T>>;
}

export default function EntityPage<T>({ target, Entity }: EntityPageProps<T>): React.JSX.Element {
  const [data, setData] = useState<MedsEntityFlatTree<T> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadEntities<T>(target)
      .then((res: MedsEntityFlatTree<T> | null) => {
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
