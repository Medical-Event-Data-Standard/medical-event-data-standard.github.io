import React, { useState } from 'react';
import { Box, Button, Chip } from '@mui/material';
import type { InstitutionCount } from '@site/src/lib/papers/display';

/** How many institutions are shown before "Show all". */
export const COLLAPSED_COUNT = 24;

/**
 * The institutions of the listed papers as chips with their paper counts, most papers first. Selecting a chip
 * filters the list to that institution's papers; selecting it again clears the filter.
 */
export default function InstitutionList({
  institutions,
  selected,
  onSelect,
}: {
  institutions: readonly InstitutionCount[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const collapsible = institutions.length > COLLAPSED_COUNT;
  // The selected institution stays visible when the list is collapsed.
  const shown =
    expanded || !collapsible
      ? institutions
      : institutions.filter((institution, i) => i < COLLAPSED_COUNT || institution.name === selected);

  return (
    <Box>
      <Box component="ul" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, listStyle: 'none', p: 0, m: 0 }}>
        {shown.map(({ name, papers }) => {
          const active = name === selected;
          return (
            <li key={name}>
              <Chip
                label={
                  <>
                    {name}
                    <Box component="span" sx={{ ml: 0.75, opacity: 0.7 }}>
                      {papers}
                    </Box>
                  </>
                }
                aria-label={`${name}: ${papers} paper${papers === 1 ? '' : 's'}`}
                aria-pressed={active}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => onSelect(active ? null : name)}
              />
            </li>
          );
        })}
      </Box>
      {collapsible && (
        <Button size="small" sx={{ mt: 1 }} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${institutions.length} institutions`}
        </Button>
      )}
    </Box>
  );
}
