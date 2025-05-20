import React from 'react';

import { MedsTarget } from '@site/src/lib/load';
import Model from './Model';
//import EntityPage from './EntityTreeMenu';
import EntityPage from './EntityPage';

export default function Datasets() {
  return <EntityPage target={MedsTarget.MODELS} Entity={Model} />;
}
