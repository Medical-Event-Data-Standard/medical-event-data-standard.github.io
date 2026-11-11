import React, { useEffect, useState } from 'react';
import { Grid, TextField, Chip, Box, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useHistory, useLocation } from '@docusaurus/router';
import Heading from '@theme/Heading';
import { Category, Package, Topic } from '@site/src/lib/ecosystem/types';
import { packageMatchesSearch } from '@site/src/lib/ecosystem/search';
import { TypeGroup, groupByType } from '@site/src/lib/ecosystem/typeGroups';
import PackageCard from './PackageCard';

// The tiles of the ecosystem page, below a search box and topic chips that filter them. By default, the tiles are
// grouped by the category of static/data/ecosystem.yaml that lists them, under a heading per category and
// subcategory; a toggle shows them in one grid instead. The search, the selected topics and the layout are kept in
// the URL's query string (`search`, `topics` and, for the single grid, `view=flat`), so that they can be shared.

/** How the tiles are laid out: grouped by category, or in one grid. */
export type PackageGridView = 'grouped' | 'flat';

function viewFromParams(params: URLSearchParams): PackageGridView {
  return params.get('view') === 'flat' ? 'flat' : 'grouped';
}

/** Styles the layout toggle with Infima's colors, so that it is legible in the site's light and dark modes. */
const VIEW_TOGGLE_SX = {
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    py: 0.25,
    color: 'var(--ifm-color-emphasis-700)',
    borderColor: 'var(--ifm-color-emphasis-400)',
    '&:hover': { bgcolor: 'var(--ifm-color-emphasis-100)' },
    '&.Mui-selected, &.Mui-selected:hover': {
      color: 'var(--ifm-font-color-base)',
      bgcolor: 'var(--ifm-color-emphasis-200)',
      fontWeight: 'var(--ifm-font-weight-semibold)',
    },
    '&.Mui-focusVisible': { outline: '2px solid var(--ifm-color-primary)', outlineOffset: -2 },
  },
};

function PackageTiles({ packages }: { packages: Package[] }): React.JSX.Element {
  return (
    <Grid container spacing={2}>
      {packages.map(pkg => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={pkg.name}>
          <PackageCard pkg={pkg} />
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * A category's heading, the description of a top-level category, its tiles and then its subcategories. Top-level
 * categories get an h2 (below the page's h1), their subcategories an h3, and so on. The headings link to themselves
 * like the page's Markdown headings, but are not in the page's table of contents, as they change with the filters.
 */
function TypeSection({ group }: { group: TypeGroup }): React.JSX.Element {
  const { category, id, packages, subgroups } = group;
  const level = Math.min(category.depth + 2, 6) as 2 | 3 | 4 | 5 | 6;
  return (
    <Box component="section" aria-labelledby={id} sx={{ mt: category.depth === 0 ? 4 : 3 }}>
      <Heading as={`h${level}`} id={id}>
        {category.name}
      </Heading>
      {category.depth === 0 && category.description && <p>{category.description}</p>}
      {packages.length > 0 && <PackageTiles packages={packages} />}
      {subgroups.map(subgroup => (
        <TypeSection key={subgroup.id} group={subgroup} />
      ))}
    </Box>
  );
}

export default function PackageGrid({
  packages,
  topics,
  topicPackages,
  categories,
}: {
  packages: Record<string, Package>;
  topics: Record<string, Topic>;
  topicPackages: Record<string, string[]>;
  /** The categories that the grouped view shows the packages by, as `parseCategoryMap` returns them. */
  categories: Category[];
}): React.JSX.Element {
  const location = useLocation();
  const history = useHistory();

  const searchParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [search, setSearch] = useState<string>(searchParams.get('search') ?? '');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    () => new Set((searchParams.get('topics') ?? '').split(',').filter(t => t))
  );
  const [view, setView] = useState<PackageGridView>(() => viewFromParams(searchParams));

  useEffect(() => {
    const newParams = new URLSearchParams();
    if (search) {
      newParams.set('search', search);
    }
    if (selectedTopics.size > 0) {
      newParams.set('topics', Array.from(selectedTopics).join(','));
    }
    if (view === 'flat') {
      newParams.set('view', 'flat');
    }
    history.replace({ ...location, search: newParams.toString() });
  }, [search, selectedTopics, view]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get('search') ?? '');
    setSelectedTopics(new Set((params.get('topics') ?? '').split(',').filter(t => t)));
    setView(viewFromParams(params));
  }, [location.search]);

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics(prev => {
      const copy = new Set(prev);
      if (copy.has(topic)) {
        copy.delete(topic);
      } else {
        copy.add(topic);
      }
      return new Set(copy);
    });
  };

  const isShown = (pkg: Package): boolean => {
    const matchesSearch = packageMatchesSearch(pkg, search);
    if (selectedTopics.size === 0) {
      return matchesSearch;
    }
    const matchesTopics = [...selectedTopics].some(tag => topicPackages[tag]?.includes(pkg.name));
    return matchesSearch && matchesTopics;
  };

  return (
    <Box>
      <TextField
        label="Search by name or description"
        variant="outlined"
        fullWidth
        sx={{ mb: 2 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Box sx={{ mb: 2 }}>
        {Object.values(topics).map(topic => (
          <Chip
            key={topic.name}
            label={topic.name}
            onClick={() => handleToggleTopic(topic.name)}
            color={selectedTopics.has(topic.name) ? 'primary' : 'default'}
            sx={{ mr: 1, mb: 1 }}
          />
        ))}
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Layout of the tiles"
        value={view}
        onChange={(_event, next: PackageGridView | null) => next && setView(next)}
        sx={{ mb: 2, ...VIEW_TOGGLE_SX }}
      >
        <ToggleButton value="grouped">Grouped by type</ToggleButton>
        <ToggleButton value="flat">All in one grid</ToggleButton>
      </ToggleButtonGroup>

      {view === 'grouped' ? (
        groupByType({ categories, packages }, isShown).map(group => (
          <TypeSection key={group.id} group={group} />
        ))
      ) : (
        <PackageTiles packages={Object.values(packages).filter(isShown)} />
      )}
    </Box>
  );
}
