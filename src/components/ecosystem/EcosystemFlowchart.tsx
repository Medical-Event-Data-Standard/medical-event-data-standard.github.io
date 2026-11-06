import React from 'react';
import { Box, Chip, Paper, Typography } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { Package, RawCategory } from '@site/src/lib/ecosystem/types';
import { StageGroup, groupByStage, packageLink } from '@site/src/lib/ecosystem/workflow';

// A "Which tool do I use for what?" flowchart: the steps of the MEDS workflow, top to bottom, each listing the
// packages of the static/data/ecosystem.yaml categories whose `stage` is that step (see
// src/lib/ecosystem/workflow.ts). Stacking the steps keeps it readable at any width; on wide screens each step's
// description sits beside its tools.

/**
 * Removes the list styling that the surrounding Markdown page gives `ol`, `ul` and `li` elements. `&&` outranks
 * its `.markdown li + li { margin-top }` rule, which would otherwise push all but the first item down.
 */
const UNSTYLED_LIST = { listStyle: 'none', m: 0, p: 0, '&& > li': { m: 0 } } as const;

function Arrow(): React.JSX.Element {
  return (
    <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <ArrowDownwardIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    </Box>
  );
}

function ToolChip({ pkg }: { pkg: Package }): React.JSX.Element {
  const link = packageLink(pkg);
  if (!link) {
    return <Chip label={pkg.name} size="small" variant="outlined" />;
  }
  return (
    <Chip
      component="a"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${pkg.name} (${link.label})`}
      label={pkg.name}
      size="small"
      variant="outlined"
      clickable
      // Keep the page's link styles (color and underline on hover) off the chip.
      sx={{ color: 'text.primary', '&:hover': { color: 'text.primary', textDecoration: 'none' } }}
    />
  );
}

function StageBox({ group, step }: { group: StageGroup; step?: number }): React.JSX.Element {
  const { stage, categories } = group;
  // Name the categories only where a stage has more than one, e.g. "Public Datasets" among the dataset ETLs.
  const showCategoryNames = categories.length > 1;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 3fr)' },
        gap: { xs: 1.5, md: 3 },
        borderStyle: step ? 'solid' : 'dashed',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {step && (
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              typography: 'subtitle2',
            }}
          >
            {step}
          </Box>
        )}
        <Box>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.4, m: 0 }}>
            {stage.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {stage.description}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'center' }}>
        {categories.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No tools listed yet.
          </Typography>
        )}
        {categories.map(({ category, packages }) => (
          <Box key={category.topic}>
            {showCategoryNames && (
              <Typography variant="caption" component="p" color="text.secondary" sx={{ mb: 0.5 }}>
                {category.name}
              </Typography>
            )}
            <Box
              component="ul"
              aria-label={`${stage.title}: ${category.name}`}
              sx={{ ...UNSTYLED_LIST, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
            >
              {packages.map(pkg => (
                <li key={pkg.name}>
                  <ToolChip pkg={pkg} />
                </li>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function EcosystemFlowchart({
  data,
}: {
  data: Record<string, RawCategory>;
}): React.JSX.Element {
  const groups = groupByStage(parseCategoryMap(data));
  const steps = groups.filter(group => group.stage.step);
  // Tools used at any step, and those in categories without a stage, are shown apart from the steps.
  const others = groups.filter(group => !group.stage.step && group.categories.length > 0);

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Typography
          variant="body2"
          sx={{ px: 2, py: 0.5, borderRadius: 4, bgcolor: 'action.hover', fontWeight: 600 }}
        >
          Start: your raw EHR data
        </Typography>
      </Box>
      <Box component="ol" aria-label="Steps of the MEDS workflow" sx={UNSTYLED_LIST}>
        {steps.map((group, index) => (
          <li key={group.stage.id}>
            <Arrow />
            <StageBox group={group} step={index + 1} />
          </li>
        ))}
      </Box>
      {others.map(group => (
        <Box key={group.stage.id} sx={{ mt: 3 }}>
          <StageBox group={group} />
        </Box>
      ))}
    </Box>
  );
}
