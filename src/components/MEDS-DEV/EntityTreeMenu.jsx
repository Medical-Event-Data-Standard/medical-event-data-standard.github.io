import React, { useEffect, useState } from 'react';
import { CircularProgress, Typography, Box } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

import { loadMedsDev } from '@site/src/lib/load';
import { parse_tree } from '@site/src/lib/parse_tree';

function RecursiveTreeItem({ name, entity }) {
  return (
    <TreeItem key={name} itemId={name} label={name}>
      {entity.children &&
        Object.entries(entity.children).map(([childName, childEntity]) => (
          <RecursiveTreeItem key={childName} name={childName} entity={childEntity} />
        ))}
    </TreeItem>
  );
}

export default function EntityPage({ target }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedsDev(target)
      .then(res => {
        setData(parse_tree(res));
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

      <SimpleTreeView>
        {Object.entries(data).map(([name, entity]) => (
          <RecursiveTreeItem key={name} name={name} entity={entity} />
        ))}
      </SimpleTreeView>
    </Box>
  );
}
