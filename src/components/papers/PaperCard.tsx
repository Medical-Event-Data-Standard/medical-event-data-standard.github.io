import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import Link from '@docusaurus/Link';
import { formatAuthors } from '@site/src/lib/papers/display';
import type { Paper } from '@site/src/lib/papers/types';
import InstitutionIcon from './InstitutionIcon';

/**
 * A paper's title (linked), authors, venue and year, and optionally its institutions (with their icons) and a label
 * chip.
 */
export default function PaperCard({
  paper,
  institutions = [],
  icons = {},
  label,
}: {
  paper: Paper;
  institutions?: readonly string[];
  /** URL path of each institution's icon, by name. */
  icons?: Readonly<Record<string, string>>;
  /** Short name of a core MEDS paper, e.g. "ACES". */
  label?: string;
}): React.JSX.Element {
  const details = [paper.venue, paper.year].filter(item => item !== null && item !== '');

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.35, mb: 0.5 }}>
          <Link href={paper.url}>{paper.title}</Link>
        </Typography>
        {paper.authors.length > 0 && (
          <Typography variant="body2" color="text.secondary" title={paper.authors.join(', ')}>
            {formatAuthors(paper.authors)}
          </Typography>
        )}
        {details.length > 0 && <Typography variant="body2">{details.join(' · ')}</Typography>}
        {institutions.length > 0 && (
          <Box
            component="ul"
            aria-label="Institutions"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              columnGap: 2,
              rowGap: 0.5,
              listStyle: 'none',
              p: 0,
              m: 0,
              mt: 0.75,
              color: 'text.secondary',
              fontSize: '0.8125rem',
            }}
          >
            {institutions.map(name => (
              <Box component="li" key={name} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <InstitutionIcon name={name} icon={icons[name]} size={16} />
                {name}
              </Box>
            ))}
          </Box>
        )}
        {label && <Chip size="small" variant="outlined" color="primary" label={label} sx={{ mt: 1 }} />}
      </CardContent>
    </Card>
  );
}
