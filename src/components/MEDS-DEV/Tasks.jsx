import React from 'react';

import { MedsTarget } from '@site/src/lib/load';
import Task from './Task';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsTarget.TASKS} Entity={Task} />;
}
