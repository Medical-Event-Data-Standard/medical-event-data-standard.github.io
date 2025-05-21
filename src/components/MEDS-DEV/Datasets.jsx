import React from 'react';

import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';
import Dataset from './Dataset';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsEntityType.DATASETS} Entity={Dataset} />;
}
