import React, { useMemo, useState } from 'react';
import { Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { matchesQuery, sortPapers, type SortOrder } from '@site/src/lib/papers/display';
import type { CitingPaper, SeedPaper } from '@site/src/lib/papers/types';
import PaperCard from './PaperCard';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title (A–Z)' },
];

/**
 * Searchable, sortable list of the papers citing or using MEDS, filtered by how they were found and by an
 * institution (chosen with `InstitutionList`, whose state the page holds).
 */
export default function PaperBrowser({
  papers,
  seeds,
  institution,
  onInstitutionChange,
}: {
  papers: CitingPaper[];
  seeds: SeedPaper[];
  institution: string | null;
  onInstitutionChange: (name: string | null) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  // Why a paper is listed: 'all', a seed's id (it cites that seed), or 'manual' (it was added by hand).
  const [source, setSource] = useState('all');
  const [order, setOrder] = useState<SortOrder>('newest');

  const sourceOptions = useMemo(() => {
    const options = seeds.map(seed => ({
      value: seed.id,
      label: `Cites ${seed.label}`,
      count: papers.filter(paper => paper.cites.includes(seed.id)).length,
    }));
    options.push({
      value: 'manual',
      label: 'Added by hand',
      count: papers.filter(paper => paper.manual).length,
    });
    return options.filter(option => option.count > 0);
  }, [papers, seeds]);

  const shown = useMemo(
    () =>
      sortPapers(papers, order).filter(
        paper =>
          (source === 'all' || (source === 'manual' ? !!paper.manual : paper.cites.includes(source))) &&
          (!institution || paper.institutions.includes(institution)) &&
          matchesQuery(paper, query)
      ),
    [papers, order, source, institution, query]
  );

  if (papers.length === 0) {
    return <Typography color="text.secondary">No citing papers have been found yet.</Typography>;
  }

  const filtered = query.trim() !== '' || source !== 'all' || institution !== null;
  const clearFilters = (): void => {
    setQuery('');
    setSource('all');
    onInstitutionChange(null);
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Search papers"
          placeholder="Title, author, venue or institution"
          type="search"
          fullWidth
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <TextField
          select
          label="Why listed"
          value={source}
          onChange={event => setSource(event.target.value)}
          sx={{ minWidth: { sm: 240 } }}
        >
          <MenuItem value="all">Any reason</MenuItem>
          {sourceOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label} ({option.count})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Sort by"
          value={order}
          onChange={event => setOrder(event.target.value as SortOrder)}
          sx={{ minWidth: { sm: 170 } }}
        >
          {SORT_OPTIONS.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" aria-live="polite">
          {filtered ? `${shown.length} of ${papers.length} papers` : `${papers.length} papers`}
        </Typography>
        {institution && (
          <Chip
            size="small"
            color="primary"
            label={institution}
            onDelete={() => onInstitutionChange(null)}
            aria-label={`Institution: ${institution}`}
          />
        )}
        {filtered && (
          <Button size="small" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Box>

      {shown.length === 0 ? (
        <Typography sx={{ py: 4, textAlign: 'center' }}>No papers match these filters.</Typography>
      ) : (
        <Stack spacing={1.5}>
          {shown.map(paper => (
            <PaperCard key={paper.id} paper={paper} institutions={paper.institutions} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
