import React from 'react';
import { Box } from '@mui/material';
import BenchmarkPlot from '../plots/BenchmarkPlot';

import { MedsEntityType, SharedEntityData } from '@site/src/lib/MEDS-DEV/types';

import {
  HeaderBlock,
  ReadmeBlock,
  ContactsBlock,
  LinksBlock,
  CitationBlock,
  InstallBlock,
} from './EntityBlocks';

import { parseReadme } from '@site/src/lib/parseMarkdown';

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

      <Box mt={5}>
        <BenchmarkPlot {...{ [`${type}Filter`]: name }} />
      </Box>
    </Box>
  );
}
