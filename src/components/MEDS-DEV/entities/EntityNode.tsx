import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import BenchmarkPlot from '../plots/BenchmarkPlot';

import { MedsEntityType, SharedEntityData, BenchmarkEntryWithId } from '@site/src/lib/MEDS-DEV/types';

import {
  HeaderBlock,
  ReadmeBlock,
  ContactsBlock,
  LinksBlock,
  CitationBlock,
  InstallBlock,
} from './EntityBlocks';

import { parseReadme } from '@site/src/lib/parseMarkdown';
import { getFilteredResults } from '@site/src/lib/MEDS-DEV/benchmark';

interface EntityNodeProps<T extends SharedEntityData> {
  type: MedsEntityType;
  name: string;
  data: T;
}

export default function EntityNode<T extends SharedEntityData>({
  name,
  data,
  type,
}: EntityNodeProps<T>): React.JSX.Element {
  const [results, setResults] = useState<BenchmarkEntryWithId[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  let datasetFilter: string | null = null;
  let taskFilter: string | null = null;
  let modelFilter: string | null = null;

  switch (type) {
    case MedsEntityType.DATASET:
      datasetFilter = name;
      taskFilter = null;
      modelFilter = null;
      break;
    case MedsEntityType.TASK:
      datasetFilter = null;
      taskFilter = name;
      modelFilter = null;
      break;
    case MedsEntityType.MODEL:
      datasetFilter = null;
      taskFilter = null;
      modelFilter = name;
      break;
  }

  useEffect(() => {
    getFilteredResults(datasetFilter, taskFilter, modelFilter)
      .then(setResults)
      .finally(() => {
        setLoading(false);
      });
  }, [datasetFilter, taskFilter, modelFilter]);

  const { readme, refs, requirements } = data;

  const { metadata = {} } = data.entity || {};

  const { title, content } = parseReadme(readme || '', name);
  const subtitle = title !== name ? name : null;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <HeaderBlock title={title} subtitle={subtitle} abstract={metadata.description} />

      <ReadmeBlock content={content} />

      <LinksBlock links={metadata.links || []} />

      <ContactsBlock contacts={metadata.contacts || []} />

      {requirements && requirements.length > 0 && <InstallBlock requirements={requirements} />}

      {refs && <CitationBlock refs={refs} />}

      {loading && <CircularProgress />}
      {!loading && results && results.length > 0 && (
        <Box mt={5}>
          <BenchmarkPlot {...{ [`${type}Filter`]: name }} />
        </Box>
      )}
    </Box>
  );
}
