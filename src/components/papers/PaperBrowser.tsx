import React, { useMemo, useState } from 'react';
import { Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { matchesQuery, sortPapers, type SortOrder } from '@site/src/lib/papers/display';
import type { CitingPaper, SeedPaper } from '@site/src/lib/papers/types';
import PaperCard from './PaperCard';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'most-cited', label: 'Most cited' },
];

/** Searchable, sortable list of the papers citing the seeds. */
export default function PaperBrowser({
  papers,
  seeds,
}: {
  papers: CitingPaper[];
  seeds: SeedPaper[];
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<SortOrder>('newest');

  const seedsById = useMemo(() => new Map(seeds.map(seed => [seed.id, seed])), [seeds]);
  const shown = useMemo(
    () => sortPapers(papers, order).filter(paper => matchesQuery(paper, query)),
    [papers, order, query]
  );

  if (papers.length === 0) {
    return <Typography color="text.secondary">No citing papers have been found yet.</Typography>;
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Search papers"
          placeholder="Title, author or venue"
          type="search"
          fullWidth
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <TextField
          select
          label="Sort by"
          value={order}
          onChange={event => setOrder(event.target.value as SortOrder)}
          sx={{ minWidth: { sm: 180 } }}
        >
          {SORT_OPTIONS.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }} aria-live="polite">
        {shown.length === papers.length
          ? `${papers.length} papers`
          : `${shown.length} of ${papers.length} papers match your search`}
      </Typography>

      {shown.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ mb: 1 }}>No papers match &ldquo;{query.trim()}&rdquo;.</Typography>
          <Button variant="outlined" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {shown.map(paper => (
            <PaperCard
              key={paper.id}
              paper={paper}
              chipsLabel={paper.cites.length > 0 ? 'Cites' : undefined}
              chips={[
                ...paper.cites.flatMap(id => {
                  const seed = seedsById.get(id);
                  return seed ? [{ label: seed.label, title: seed.title, color: 'primary' as const }] : [];
                }),
                ...(paper.manual
                  ? [{ label: 'Added manually', title: 'Listed in static/data/papers.yaml' }]
                  : []),
              ]}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
