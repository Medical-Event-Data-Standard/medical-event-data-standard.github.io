import React from 'react';
import { Card, CardContent, Chip, Typography } from '@mui/material';
import Link from '@docusaurus/Link';
import { formatAuthors } from '@site/src/lib/papers/display';
import type { Paper } from '@site/src/lib/papers/types';

/** A paper's title (linked), authors, venue and year, and optionally its institutions and a label chip. */
export default function PaperCard({
  paper,
  institutions = [],
  label,
}: {
  paper: Paper;
  institutions?: readonly string[];
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: '0.8125rem' }}>
            {institutions.join(' · ')}
          </Typography>
        )}
        {label && <Chip size="small" variant="outlined" color="primary" label={label} sx={{ mt: 1 }} />}
      </CardContent>
    </Card>
  );
}
