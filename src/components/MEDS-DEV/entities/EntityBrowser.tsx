import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Grid } from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { loadEntities } from '@site/src/lib/MEDS-DEV/load';
import { parseTree } from '@site/src/lib/MEDS-DEV/parse_tree';
import {
  SharedEntityData,
  MedsEntityType,
  MedsEntityNestedTree,
  MedsEntityFlatTree,
  MedsEntityNestedTreeNode,
} from '@site/src/lib/MEDS-DEV/types';

import EntityNode from './EntityNode';

export default function EntityBrowser<T extends SharedEntityData>({
  target,
}: {
  target: MedsEntityType;
}): React.JSX.Element {
  const [nestedData, setNestedData] = useState<MedsEntityNestedTree<T> | null>(null);
  const [flatData, setFlatData] = useState<MedsEntityFlatTree<T> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    loadEntities<T>(target)
      .then((res: MedsEntityFlatTree<T> | null) => {
        if (res) {
          setFlatData(res);
          setNestedData(parseTree<T>(res));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [target]);

  const handleItemSelectionToggle = (
    event: React.SyntheticEvent | null,
    itemId: string,
    isSelected: boolean
  ) => {
    if (isSelected) {
      setSelected(itemId);
    } else {
      setSelected(null);
    }
  };

  if (loading) return <CircularProgress />;
  if (!nestedData || !flatData) return <Typography>No {target} entities found.</Typography>;

  const renderTree = (name: string, entity: MedsEntityNestedTreeNode<T>) => (
    <TreeItem key={name} itemId={name} label={name}>
      {entity.children &&
        Object.entries(entity.children).map(([childName, childEntity]) => renderTree(childName, childEntity))}
    </TreeItem>
  );

  return (
    <Grid container spacing={2}>
      <Grid size={3}>
        <Typography variant="h5" gutterBottom>
          {target}
        </Typography>
        <SimpleTreeView onItemSelectionToggle={handleItemSelectionToggle}>
          {Object.entries(nestedData).map(([name, entity]) => renderTree(name, entity))}
        </SimpleTreeView>
      </Grid>

      <Grid size={9}>
        {selected && flatData[selected] ? (
          <EntityNode<T> name={selected} data={flatData[selected].data} type={target} />
        ) : (
          <Typography variant="h6">
            {selected ? 'Select a valid entity.' : 'Select an entity from the tree.'}
          </Typography>
        )}
      </Grid>
    </Grid>
  );
}
