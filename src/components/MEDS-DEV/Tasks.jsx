import React from 'react';

import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';
import Task from './Task';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsEntityType.TASKS} Entity={Task} />;
}
