import React from 'react';

import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';
import Model from './Model';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsEntityType.MODELS} Entity={Model} />;
}
