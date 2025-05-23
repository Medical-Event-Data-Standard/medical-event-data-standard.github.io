import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, CardActions, Button } from '@mui/material';
import { Package, PackageWithMetadata } from '@site/src/lib/ecosystem/types';
import { loadPackageMetadata } from '@site/src/lib/ecosystem/loadPackageMetadata';

export default function PackageCard({ pkg }: { pkg: Package }): React.JSX.Element | null {
  const [data, setData] = useState<PackageWithMetadata | null>(null);

  useEffect(() => {
    loadPackageMetadata(pkg).then(setData);
  }, [pkg]);

  if (!data) return null;

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
