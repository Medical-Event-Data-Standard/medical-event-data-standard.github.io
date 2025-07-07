import React, { useState } from 'react';
import { Grid, TextField, Chip, Box } from '@mui/material';
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
  const [search, setSearch] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

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
