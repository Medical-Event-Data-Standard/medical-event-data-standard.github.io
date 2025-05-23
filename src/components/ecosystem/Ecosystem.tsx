import React from 'react';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import PackageGrid from './PackageGrid';

export default function Ecosystem({ data }: { data: Record<string, RawCategory> }): React.JSX.Element {
  const { packages, topics, topicPackages } = parseCategoryMap(data);
  return <PackageGrid packages={packages} topics={topics} topicPackages={topicPackages} />;
}
