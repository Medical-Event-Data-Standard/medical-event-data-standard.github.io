import React from 'react';
import { Card, CardContent, Typography, CardActions, Button } from '@mui/material';
import Link from '@docusaurus/Link';
import { usePluginData } from '@docusaurus/useGlobalData';
import { EcosystemMetadata, Package } from '@site/src/lib/ecosystem/types';
import { ECOSYSTEM_METADATA_PLUGIN } from '@site/src/lib/ecosystem/githubMetadata';
import { attachPackageMetadata } from '@site/src/lib/ecosystem/packageMetadata';
import { medsDevPagePath } from '@site/src/lib/ecosystem/medsDev';

/** Props for buttons that open an external site in a new tab. */
const EXTERNAL_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;

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
      {/* Wrap, rather than overflow the card, when a package has many links. */}
      <CardActions disableSpacing sx={{ flexWrap: 'wrap', gap: 1 }}>
        {data.githubRepo && (
          <Button href={`https://github.com/${data.githubRepo}`} {...EXTERNAL_LINK}>
            GitHub
          </Button>
        )}
        {data.docsUrl && (
          <Button href={data.docsUrl} {...EXTERNAL_LINK}>
            Docs
          </Button>
        )}
        {data.paperUrl && (
          <Button href={data.paperUrl} {...EXTERNAL_LINK}>
            Paper
          </Button>
        )}
        {data.pypiName && (
          <Button href={`https://pypi.org/project/${data.pypiName}`} {...EXTERNAL_LINK}>
            PyPI
          </Button>
        )}
        {data.physionetUrl && (
          <Button href={data.physionetUrl} {...EXTERNAL_LINK}>
            PhysioNet
          </Button>
        )}
        {data.medsDev && (
          <Button
            component={Link}
            to={medsDevPagePath(data.medsDev)}
            title={`Select "${data.medsDev.name}" on the MEDS-DEV ${data.medsDev.entityType}s page`}
          >
            MEDS-DEV
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
