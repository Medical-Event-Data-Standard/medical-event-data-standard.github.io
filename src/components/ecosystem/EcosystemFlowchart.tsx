import React from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import { Box, Chip, Paper, Typography } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { Package } from '@site/src/lib/ecosystem/types';
import { WorkflowSection, stageAnchorId } from '@site/src/lib/ecosystem/workflow';

// The flowchart of the "Which tool do I use for what?" page (see EcosystemWorkflow.tsx): the steps of the MEDS
// workflow, top to bottom, each listing the packages of the static/data/ecosystem.yaml categories whose `stage` is
// that step (see src/lib/ecosystem/workflow.ts) as chips that link to the packages' tiles. Stacking the steps
// keeps it readable at any width; where the flowchart is wide enough, each step's description sits beside its
// tools. Each step's box has an id (see `stageAnchorId`), so that other pages, such as the overview of the workflow
// at the top of "Welcome to MEDS" (WorkflowOverview.tsx), can link to it.

/**
 * Removes the list styling that the surrounding Markdown page gives `ol`, `ul` and `li` elements. `&&` outranks
 * its `.markdown li + li { margin-top }` rule, which would otherwise push all but the first item down.
 */
export const UNSTYLED_LIST = { listStyle: 'none', m: 0, p: 0, '&& > li': { m: 0 } } as const;

/** Space to leave above an element scrolled to the top of the window, which the navbar sticks to. */
export const NAVBAR_CLEARANCE = 'calc(var(--ifm-navbar-height) + 0.75rem)';

/**
 * Applies its styles where the flowchart is wide enough to put each step's description beside its tools. The
 * flowchart is a CSS container, so this follows its own width, which beside the tool tiles is well below the
 * window's.
 */
const WIDE_FLOWCHART = '@container ecosystem-flowchart (min-width: 36rem)';

/** The number of a step of the workflow, in a circle. */
export function StepNumber({ step, size = 28 }: { step: number; size?: number }): React.JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        typography: 'subtitle2',
        fontSize: size < 28 ? '0.75rem' : undefined,
      }}
    >
      {step}
    </Box>
  );
}

function Arrow(): React.JSX.Element {
  return (
    <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
      <ArrowDownwardIcon fontSize="small" sx={{ color: 'text.disabled' }} />
    </Box>
  );
}

interface ToolSelection {
  /** The id of each package's tile, by package name (see `toolAnchorIds`). */
  toolIds: Map<string, string>;
  /** The id of the selected package's tile, if any. */
  selectedId?: string;
  /** Called when a package's chip is clicked, with the id of the package's tile. */
  onSelectTool: (id: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
}

function ToolChip({
  pkg,
  toolIds,
  selectedId,
  onSelectTool,
}: ToolSelection & { pkg: Package }): React.JSX.Element {
  const id = toolIds.get(pkg.name)!;
  const selected = id === selectedId;
  // The chip's text, kept from turning into the page's link color (and underlined) on hover.
  const color = selected ? 'primary.contrastText' : 'text.primary';
  return (
    <Chip
      component="a"
      href={`#${id}`}
      onClick={(event: React.MouseEvent<HTMLAnchorElement>) => onSelectTool(id, event)}
      aria-current={selected ? 'true' : undefined}
      label={pkg.name}
      size="small"
      variant={selected ? 'filled' : 'outlined'}
      color={selected ? 'primary' : 'default'}
      clickable
      sx={{ color, '&:hover': { color, textDecoration: 'none' } }}
    />
  );
}

function StageBox({
  section,
  ...selection
}: ToolSelection & { section: WorkflowSection }): React.JSX.Element {
  const { stage, step, categories } = section;
  const id = stageAnchorId(stage.id);
  // Lets Docusaurus's check for broken links know that links to this box, from other pages, have a target.
  useBrokenLinks().collectAnchor(id);
  // Name the categories only where a stage has more than one, e.g. "Public Datasets" among the dataset ETLs.
  const showCategoryNames = categories.length > 1;
  return (
    <Paper
      id={id}
      variant="outlined"
      sx={{
        // When a link to the box scrolls it to the top of the window, keeps it clear of the navbar.
        scrollMarginTop: NAVBAR_CLEARANCE,
        p: 2,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 1.5,
        [WIDE_FLOWCHART]: { gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: 3 },
        borderStyle: step ? 'solid' : 'dashed',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        {step && <StepNumber step={step} />}
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
                  <ToolChip pkg={pkg} {...selection} />
                </li>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

/** The flowchart of the MEDS workflow: its `sections` (see `workflowSections`), with each tool as a chip. */
export default function EcosystemFlowchart({
  sections,
  ...selection
}: ToolSelection & { sections: WorkflowSection[] }): React.JSX.Element {
  const steps = sections.filter(section => section.step);
  // Tools used at any step, and those in categories without a stage, are shown apart from the steps.
  const others = sections.filter(section => !section.step);

  return (
    <Box sx={{ container: 'ecosystem-flowchart / inline-size' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Typography
          variant="body2"
          sx={{ px: 2, py: 0.5, borderRadius: 4, bgcolor: 'action.hover', fontWeight: 600 }}
        >
          Start: your raw EHR data
        </Typography>
      </Box>
      <Box component="ol" aria-label="Steps of the MEDS workflow" sx={UNSTYLED_LIST}>
        {steps.map(section => (
          <li key={section.stage.id}>
            <Arrow />
            <StageBox section={section} {...selection} />
          </li>
        ))}
      </Box>
      {others.map(section => (
        <Box key={section.stage.id} sx={{ mt: 3 }}>
          <StageBox section={section} {...selection} />
        </Box>
      ))}
    </Box>
  );
}
