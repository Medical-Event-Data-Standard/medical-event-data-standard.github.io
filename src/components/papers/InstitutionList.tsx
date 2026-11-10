import React, { useMemo, useState } from 'react';
import { Avatar, Box, Button, Chip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useBaseUrlUtils } from '@docusaurus/useBaseUrl';
import type { InstitutionCount } from '@site/src/lib/papers/display';

/** How many institutions are shown before "Show all". */
export const COLLAPSED_COUNT = 24;

type InstitutionOrder = 'papers' | 'name';

/**
 * The institutions of the listed papers as chips with their icons and paper counts, by number of papers or by
 * name. Selecting a chip filters the list to that institution's papers; selecting it again clears the filter.
 */
export default function InstitutionList({
  institutions,
  icons,
  selected,
  onSelect,
}: {
  /** Most papers first. */
  institutions: readonly InstitutionCount[];
  /** URL path of each institution's icon, by name. */
  icons: Readonly<Record<string, string>>;
  selected: string | null;
  onSelect: (name: string | null) => void;
}): React.JSX.Element {
  const { withBaseUrl } = useBaseUrlUtils();
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState<InstitutionOrder>('papers');
  const sorted = useMemo(
    () => (order === 'name' ? [...institutions].sort((a, b) => a.name.localeCompare(b.name)) : institutions),
    [institutions, order]
  );
  const collapsible = sorted.length > COLLAPSED_COUNT;
  // The selected institution stays visible when the list is collapsed.
  const shown =
    expanded || !collapsible
      ? sorted
      : sorted.filter((institution, i) => i < COLLAPSED_COUNT || institution.name === selected);

  return (
    <Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={order}
        onChange={(_, value: InstitutionOrder | null) => value && setOrder(value)}
        aria-label="Sort institutions"
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="papers">Most papers</ToggleButton>
        <ToggleButton value="name">A–Z</ToggleButton>
      </ToggleButtonGroup>
      <Box component="ul" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, listStyle: 'none', p: 0, m: 0 }}>
        {shown.map(({ name, papers }) => {
          const active = name === selected;
          const icon = icons[name];
          return (
            <li key={name}>
              <Chip
                avatar={
                  icon ? (
                    <Avatar
                      variant="rounded"
                      alt=""
                      src={withBaseUrl(icon)}
                      sx={{ bgcolor: 'transparent', '& img': { objectFit: 'contain' } }}
                    />
                  ) : (
                    <Avatar aria-hidden>{name.charAt(0)}</Avatar>
                  )
                }
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
          {expanded ? 'Show fewer' : `Show all ${sorted.length} institutions`}
        </Button>
      )}
    </Box>
  );
}
