import { useEffect, useState } from 'react';
import { CircularProgress, Typography, Box } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { loadEntities } from '@site/src/lib/MEDS-DEV/load';
import {
  MedsEntityType,
  MedsEntityNestedTreeNode,
  MedsEntityNestedTree,
  MedsEntityFlatTree,
} from '@site/src/lib/MEDS-DEV/types';
import { parseTree } from '@site/src/lib/MEDS-DEV/parse_tree';

interface RecursiveTreeItemProps<T> {
  name: string;
  entity: MedsEntityNestedTreeNode<T>;
}

function RecursiveTreeItem<T>({ name, entity }: RecursiveTreeItemProps<T>): React.JSX.Element {
  return (
    <TreeItem key={name} itemId={name} label={name}>
      {entity.children &&
        Object.entries(entity.children).map(([childName, childEntity]) => (
          <RecursiveTreeItem key={childName} name={childName} entity={childEntity} />
        ))}
    </TreeItem>
  );
}

interface EntityPageProps {
  target: MedsEntityType;
}

export default function EntityTreeMenu<T>({ target }: EntityPageProps): React.JSX.Element {
  const [data, setData] = useState<MedsEntityNestedTree<T> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadEntities<T>(target)
      .then((res: MedsEntityFlatTree<T> | null) => {
        setData(res ? parseTree<T>(res) : null);
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
          <RecursiveTreeItem<T> key={name} name={name} entity={entity} />
        ))}
      </SimpleTreeView>
    </Box>
  );
}
