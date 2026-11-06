import React from 'react';
import { Card, CardContent, Typography, CardActions, Button } from '@mui/material';
import { usePluginData } from '@docusaurus/useGlobalData';
import { EcosystemMetadata, Package } from '@site/src/lib/ecosystem/types';
import { ECOSYSTEM_METADATA_PLUGIN } from '@site/src/lib/ecosystem/githubMetadata';
import { attachPackageMetadata } from '@site/src/lib/ecosystem/packageMetadata';

export default function PackageCard({ pkg }: { pkg: Package }): React.JSX.Element {
  const metadata = usePluginData(ECOSYSTEM_METADATA_PLUGIN) as EcosystemMetadata | undefined;
  const data = attachPackageMetadata(pkg, metadata);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">{data.name}</Typography>
        {data.warn && <Typography color="warning.main">{data.warn}</Typography>}
        {data.demoAvailable && <Typography variant="body2">🚀 Demo Available</Typography>}
        {data.stars !== null && <Typography variant="body2">⭐ {data.stars} stars</Typography>}
        {data.release && <Typography variant="body2">📦 {data.release}</Typography>}
      </CardContent>
      <CardActions>
        {data.githubRepo && (
          <Button href={`https://github.com/${data.githubRepo}`} target="_blank">
            GitHub
          </Button>
        )}
        {data.docsUrl && (
          <Button href={data.docsUrl} target="_blank">
            Docs
          </Button>
        )}
        {data.paperUrl && (
          <Button href={data.paperUrl} target="_blank">
            Paper
          </Button>
        )}
        {data.pypiName && (
          <Button href={`https://pypi.org/project/${data.pypiName}`} target="_blank">
            PyPI
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
