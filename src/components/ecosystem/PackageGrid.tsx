import React, { useEffect, useState } from 'react';
import { Grid, TextField, Chip, Box } from '@mui/material';
import { useHistory, useLocation } from '@docusaurus/router';
import { Package, Topic } from '@site/src/lib/ecosystem/types';
import PackageCard from './PackageCard';

export default function PackageGrid({
  packages,
  topics,
  topicPackages,
}: {
  packages: Record<string, Package>;
  topics: Record<string, Topic>;
  topicPackages: Record<string, string[]>;
}): React.JSX.Element {
  const location = useLocation();
  const history = useHistory();

  const searchParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [search, setSearch] = useState<string>(searchParams.get('search') ?? '');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(
    () => new Set((searchParams.get('topics') ?? '').split(',').filter(t => t))
  );

  useEffect(() => {
    const newParams = new URLSearchParams();
    if (search) {
      newParams.set('search', search);
    }
    if (selectedTopics.size > 0) {
      newParams.set('topics', Array.from(selectedTopics).join(','));
    }
    history.replace({ ...location, search: newParams.toString() });
  }, [search, selectedTopics, history, location]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearch(params.get('search') ?? '');
    setSelectedTopics(new Set((params.get('topics') ?? '').split(',').filter(t => t)));
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

  const packageList = Object.values(packages);

  const filtered = packageList.filter(pkg => {
    const matchesSearch = pkg.name.toLowerCase().includes(search.toLowerCase());
    if (selectedTopics.size === 0) {
      return matchesSearch;
    }
    const matchesTopics = [...selectedTopics].some(tag => topicPackages[tag]?.includes(pkg.name));
    return matchesSearch && matchesTopics;
  });

  return (
    <Box>
      <TextField
        label="Search packages"
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

      <Grid container spacing={2}>
        {filtered.map(pkg => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={pkg.name}>
            <PackageCard pkg={pkg} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
