import React from 'react';
import { Box, Card, CardContent, Typography, CardActions, Button } from '@mui/material';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { usePluginData } from '@docusaurus/useGlobalData';
import { EcosystemPluginData, Package } from '@site/src/lib/ecosystem/types';
import { DEFAULT_PACKAGE_LOGO, ECOSYSTEM_METADATA_PLUGIN } from '@site/src/lib/ecosystem/githubMetadata';
import { attachPackageMetadata } from '@site/src/lib/ecosystem/packageMetadata';
import { medsDevPagePath } from '@site/src/lib/ecosystem/medsDev';

/** Props for buttons that open an external site in a new tab. */
const EXTERNAL_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const;

/** The width and height, in pixels, of the logo in the card's top right corner: one line of the name's height. */
const LOGO_SIZE = 32;

export default function PackageCard({ pkg }: { pkg: Package }): React.JSX.Element {
  const pluginData = usePluginData(ECOSYSTEM_METADATA_PLUGIN) as EcosystemPluginData | undefined;
  const data = attachPackageMetadata(pkg, pluginData);
  const logoUrl = useBaseUrl(data.logo ?? DEFAULT_PACKAGE_LOGO);

  return (
    // As tall as the other cards in its row of the grid, with the buttons at the bottom.
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* The name wraps before it reaches the logo. */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            {data.name}
          </Typography>
          <Box
            component="img"
            src={logoUrl}
            // Decorative: the name says which package the card is for.
            alt=""
            loading="lazy"
            sx={{ width: LOGO_SIZE, height: LOGO_SIZE, flexShrink: 0, objectFit: 'contain', borderRadius: 1 }}
          />
        </Box>
        {data.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            {data.description}
          </Typography>
        )}
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
        {data.dataRepositoryUrl && (
          <Button href={data.dataRepositoryUrl} {...EXTERNAL_LINK}>
            Data repository
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
