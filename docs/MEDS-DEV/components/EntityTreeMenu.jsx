
import React, { useEffect, useState } from 'react';
import {
  CircularProgress,
  Typography,
  Box,
  Paper,
  Link,
  Chip,
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';


import { load_MEDS_DEV } from '@site/src/MEDS-DEV/load.js';
import { parse_tree } from '@site/src/MEDS-DEV/parse_tree.js';

function RecursiveTreeItem({ name, entity }) {
  return (
    <TreeItem key={name} itemId={name} label={name}>
      {entity.children && Object.entries(entity.children).map(([childName, childEntity]) => (
        <RecursiveTreeItem key={childName} name={childName} entity={childEntity} />
      ))}
    </TreeItem>
  );
}

export default function EntityPage({ target, Entity }) {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load_MEDS_DEV(target)
    .then((res => { setData(parse_tree(res)); }))
    .finally(() => { setLoading(false); })
  }, []);

  if (loading) return <CircularProgress />;
  if (!data) return <Typography>{`No ${target} entities found.`}</Typography>;

  //data is an object mapping dataset names to their metadata
  return (
    <Box>
      <Typography variant="h4" gutterBottom> {target} </Typography>

      <SimpleTreeView>
        {Object.entries(data).map(([name, entity]) => (
          <RecursiveTreeItem key={name} name={name} entity={entity} />
        ))}
      </SimpleTreeView>
    </Box>
  );
}
