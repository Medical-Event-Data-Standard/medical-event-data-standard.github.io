import { loadEntities } from './load';
import { parseTree } from './parse_tree';

import {
  MedsEntityNestedTree,
  DatasetEntityData,
  ModelEntityData,
  TaskEntityData,
  MedsEntityType,
} from './types';

export interface allEntityTrees {
  [MedsEntityType.DATASET]: MedsEntityNestedTree<DatasetEntityData> | null;
  [MedsEntityType.TASK]: MedsEntityNestedTree<TaskEntityData> | null;
  [MedsEntityType.MODEL]: MedsEntityNestedTree<ModelEntityData> | null;
}

export async function getEntitiesTrees(): Promise<allEntityTrees> {
  const datasets_flat = await loadEntities<DatasetEntityData>(MedsEntityType.DATASET);
  const tasks_flat = await loadEntities<TaskEntityData>(MedsEntityType.TASK);
  const models_flat = await loadEntities<ModelEntityData>(MedsEntityType.MODEL);

  const datasets = datasets_flat ? parseTree<DatasetEntityData>(datasets_flat) : null;
  const tasks = tasks_flat ? parseTree<TaskEntityData>(tasks_flat) : null;
  const models = models_flat ? parseTree<ModelEntityData>(models_flat) : null;

  return {
    [MedsEntityType.DATASET]: datasets,
    [MedsEntityType.TASK]: tasks,
    [MedsEntityType.MODEL]: models,
  };
}
