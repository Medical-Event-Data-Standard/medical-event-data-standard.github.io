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
import EntityBrowser from './EntityBrowser';

export function Datasets(): React.JSX.Element {
  return <EntityBrowser<DatasetEntityData> target={MedsEntityType.DATASETS} Entity={Dataset} />;
}

export function Tasks(): React.JSX.Element {
  return <EntityBrowser<TaskEntityData> target={MedsEntityType.TASKS} Entity={Task} />;
}

export function Models(): React.JSX.Element {
  return <EntityBrowser<ModelEntityData> target={MedsEntityType.MODELS} Entity={Model} />;
}
