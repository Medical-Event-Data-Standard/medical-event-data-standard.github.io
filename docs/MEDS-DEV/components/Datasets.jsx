import React from 'react';

import { MedsTarget } from '@site/src/lib/load';
import Dataset from './Dataset';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsTarget.DATASETS} Entity={Dataset} />;
}
