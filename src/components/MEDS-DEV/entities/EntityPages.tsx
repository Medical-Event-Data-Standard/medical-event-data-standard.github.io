import React from 'react';

import {
  MedsEntityType,
  DatasetEntityData,
  TaskEntityData,
  ModelEntityData,
} from '@site/src/lib/MEDS-DEV/types';
import EntityBrowser from './EntityBrowser';

export function Datasets(): React.JSX.Element {
  return <EntityBrowser<DatasetEntityData> target={MedsEntityType.DATASET} />;
}

export function Tasks(): React.JSX.Element {
  return <EntityBrowser<TaskEntityData> target={MedsEntityType.TASK} />;
}

export function Models(): React.JSX.Element {
  return <EntityBrowser<ModelEntityData> target={MedsEntityType.MODEL} />;
}
