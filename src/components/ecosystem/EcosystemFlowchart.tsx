import React from 'react';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import { Box, Chip, Typography } from '@mui/material';
import { Package } from '@site/src/lib/ecosystem/types';
import { WorkflowSection, stageAnchorId } from '@site/src/lib/ecosystem/workflow';
import {
  ENTRY_GAP,
  MEDS_DATA,
  MILESTONE_BOX_SX,
  MedsColumns,
  RAW_DATA,
  SECONDARY_TEXT,
  STAGE_ICONS,
  TimelineLabel,
  TimelineMarker,
  UNSTYLED_LIST,
  timelineEntrySx,
} from './timeline';

// The flowchart of the "Which tool do I use for what?" page (see EcosystemWorkflow.tsx), drawn as a timeline like
// the quick start visual guide on "Welcome to MEDS" (see timeline.tsx): the raw data, the first step, the data in
// MEDS, then the other steps of the MEDS workflow, top to bottom. Each step lists the packages of the
// static/data/ecosystem.yaml categories whose `stage` is that step (see src/lib/ecosystem/workflow.ts) as chips
// that link to the packages' tiles; where the flowchart is wide enough, they sit beside the step's description.
// The tools used at any step, and those of categories without a stage, follow the timeline. Each step has an id
// (see `stageAnchorId`), so that other pages can link to it.

export { UNSTYLED_LIST };

/** Space to leave above an element scrolled to the top of the window, which the navbar sticks to. */
export const NAVBAR_CLEARANCE = 'calc(var(--ifm-navbar-height) + 0.75rem)';

/**
 * Applies its styles where the flowchart is wide enough to put each step's description beside its tools. The
 * flowchart is a CSS container, so this follows its own width, which beside the tool tiles is well below the
 * window's.
 */
const WIDE_FLOWCHART = '@container ecosystem-flowchart (min-width: 36rem)';

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

/** The tools of a step, as chips, by category. */
function StageTools({
  section,
  ...selection
}: ToolSelection & { section: WorkflowSection }): React.JSX.Element {
  const { stage, categories } = section;
  // Name the categories only where a stage has more than one, e.g. "Public Datasets" among the dataset ETLs.
  const showCategoryNames = categories.length > 1;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, [WIDE_FLOWCHART]: { pt: 2.5 } }}>
      {categories.length === 0 && (
        <Typography variant="body2" sx={{ color: SECONDARY_TEXT }}>
          No tools listed yet.
        </Typography>
      )}
      {categories.map(({ category, packages }) => (
        <Box key={category.topic}>
          {showCategoryNames && (
            <Typography variant="caption" component="p" sx={{ mb: 0.5, color: SECONDARY_TEXT }}>
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
  );
}

/**
 * A step of the workflow, or a group of tools shown apart from its steps, as an entry of the timeline: its icon,
 * its label ("Step 1", or "At any step" or "More tools" for the groups), title and description, and its tools.
 */
function StageEntry({
  section,
  connects,
  ...selection
}: ToolSelection & { section: WorkflowSection; connects: boolean }): React.JSX.Element {
  const { stage, step } = section;
  const id = stageAnchorId(stage.id);
  // Lets Docusaurus's check for broken links know that links to this step, from other pages, have a target.
  useBrokenLinks().collectAnchor(id);
  const label = step ? `Step ${step}` : stage.id === 'general' ? 'At any step' : 'More tools';
  return (
    <Box
      id={id}
      sx={{
        ...timelineEntrySx(connects),
        // When a link to the step scrolls it to the top of the window, keeps it clear of the navbar.
        scrollMarginTop: NAVBAR_CLEARANCE,
      }}
    >
      <TimelineMarker icon={STAGE_ICONS[stage.id]} variant={step ? 'step' : 'muted'} />
      <Box
        sx={{
          minWidth: 0,
          pb: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1,
          [WIDE_FLOWCHART]: { gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', columnGap: 3 },
        }}
      >
        <div>
          <TimelineLabel>{label}</TimelineLabel>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.3, m: 0 }}>
            {stage.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, color: SECONDARY_TEXT }}>
            {stage.description}
          </Typography>
        </div>
        <StageTools section={section} {...selection} />
      </Box>
    </Box>
  );
}

/** A milestone of the timeline: where the data stands, in a dashed box. */
function Milestone({
  milestone,
  connects,
  children,
}: React.PropsWithChildren<{ milestone: typeof RAW_DATA; connects: boolean }>): React.JSX.Element {
  return (
    <Box sx={timelineEntrySx(connects)}>
      <TimelineMarker icon={milestone.icon} variant="milestone" />
      <Box sx={{ ...MILESTONE_BOX_SX, minWidth: 0 }}>
        <TimelineLabel>{milestone.label}</TimelineLabel>
        <Box component="p" sx={{ m: 0, fontWeight: 600, lineHeight: 1.3 }}>
          {milestone.title}
        </Box>
        <Typography variant="body2" sx={{ mt: 0.25, color: SECONDARY_TEXT }}>
          {milestone.description}
        </Typography>
        {children}
      </Box>
    </Box>
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
  const gap = { display: 'grid', gap: `${ENTRY_GAP}px` } as const;

  return (
    <Box sx={{ container: 'ecosystem-flowchart / inline-size', ...gap }}>
      <Milestone milestone={RAW_DATA} connects={steps.length > 0} />
      <Box component="ol" aria-label="Steps of the MEDS workflow" sx={{ ...UNSTYLED_LIST, ...gap }}>
        {steps.map((section, index) => (
          <Box component="li" key={section.stage.id} sx={gap}>
            <StageEntry section={section} connects={index < steps.length - 1 || index === 0} {...selection} />
            {/* The first step leaves the data in MEDS. */}
            {index === 0 && (
              <Milestone milestone={MEDS_DATA} connects={steps.length > 1}>
                <MedsColumns />
              </Milestone>
            )}
          </Box>
        ))}
      </Box>
      {others.length > 0 && (
        <Box sx={{ ...gap, mt: 2 }}>
          {others.map(section => (
            <StageEntry key={section.stage.id} section={section} connects={false} {...selection} />
          ))}
        </Box>
      )}
    </Box>
  );
}
