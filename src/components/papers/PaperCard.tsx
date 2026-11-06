import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import Link from '@docusaurus/Link';
import { formatAuthors } from '@site/src/lib/papers/display';
import type { Paper } from '@site/src/lib/papers/types';

/** A paper's title (linked), authors, and venue, year and citation count, with optional chips underneath. */
export default function PaperCard({
  paper,
  chips,
  chipsLabel,
}: {
  paper: Paper;
  chips: { label: string; title?: string; color?: 'primary' | 'default' }[];
  /** Text before the chips, e.g. "Cites". */
  chipsLabel?: string;
}): React.JSX.Element {
  const details = [
    paper.venue,
    paper.year,
    paper.citationCount === null
      ? null
      : `${paper.citationCount} citation${paper.citationCount === 1 ? '' : 's'}`,
  ].filter(item => item !== null && item !== '');

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
        {chips.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1 }}>
            {chipsLabel && (
              <Typography variant="caption" color="text.secondary">
                {chipsLabel}
              </Typography>
            )}
            {chips.map(chip => (
              <Chip
                key={chip.label}
                size="small"
                variant="outlined"
                color={chip.color ?? 'default'}
                label={chip.label}
                title={chip.title}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
