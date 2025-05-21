import React from 'react';

import {
  MedsEntityType,
  DatasetEntityData,
  TaskEntityData,
  ModelEntityData,
} from '@site/src/lib/MEDS-DEV/types';
import Dataset from './Dataset';
import Task from './Task';
import Model from './Model';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';

export function Datasets(): React.JSX.Element {
  return <EntityPage<DatasetEntityData> target={MedsEntityType.DATASETS} Entity={Dataset} />;
}

export function Tasks(): React.JSX.Element {
  return <EntityPage<TaskEntityData> target={MedsEntityType.TASKS} Entity={Task} />;
}

export function Models(): React.JSX.Element {
  return <EntityPage<ModelEntityData> target={MedsEntityType.MODELS} Entity={Model} />;
}
