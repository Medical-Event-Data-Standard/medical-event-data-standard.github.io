import React from 'react';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExtensionIcon from '@mui/icons-material/Extension';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import StorageIcon from '@mui/icons-material/Storage';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import TableRowsIcon from '@mui/icons-material/TableRows';
import TuneIcon from '@mui/icons-material/Tune';
import type { Stage } from '@site/src/lib/ecosystem/workflow';

// The visual language that the MEDS workflow is drawn in, shared by the quick start visual guide at the top of
// "Welcome to MEDS" (WorkflowOverview.tsx) and the flowchart of the "Which tool do I use for what?" page
// (EcosystemFlowchart.tsx): a timeline, top to bottom, whose entries each have an icon on a line that connects them,
// a small upper-case label (such as "Step 1") and a title. The steps of the workflow have filled icons; the
// milestones between them, which say where the data stands (raw, then in MEDS), have grey icons and dashed boxes.
//
// The icons are Material Icons, from @mui/icons-material. This site uses MUI's default theme, which does not follow
// Docusaurus's dark mode, so the colors here come from Infima's variables, which do.

/** The icon of each stage of the workflow, and of the groups of tools shown apart from its steps. */
export const STAGE_ICONS: Record<Stage['id'], SvgIconComponent> = {
  convert: SyncAltIcon,
  explore: QueryStatsIcon,
  preprocess: TuneIcon,
  task: AssignmentIcon,
  model: ModelTrainingIcon,
  evaluate: AssessmentIcon,
  benchmark: LeaderboardIcon,
  general: AllInclusiveIcon,
  other: ExtensionIcon,
};

/** The milestone before the first step: the raw data. */
export const RAW_DATA = {
  icon: StorageIcon,
  label: 'Start',
  title: 'Your raw EHR data',
  description: 'Your health records, in whatever tables, files or data standard they come in.',
};

/** The milestone after the first step: the data in MEDS. */
export const MEDS_DATA = {
  icon: TableRowsIcon,
  label: 'Milestone',
  title: 'Your data in MEDS',
  description: 'One row per event, in just four columns, ready for the tools of every step below:',
};

/** The columns that every MEDS dataset has. */
export const MEDS_COLUMNS = ['subject_id', 'time', 'code', 'numeric_value'];

/** The size of the icons on the timeline, and the space between its entries, in pixels. */
export const MARKER_SIZE = 36;
export const ENTRY_GAP = 12;

export const SECONDARY_TEXT = 'var(--ifm-color-emphasis-700)';

/**
 * Removes the list styling that the surrounding Markdown page gives `ol`, `ul` and `li` elements. `&&` outranks
 * its `.markdown li + li { margin-top }` rule, which would otherwise push all but the first item down.
 */
export const UNSTYLED_LIST = { listStyle: 'none', m: 0, p: 0, '&& > li': { m: 0 } } as const;

/**
 * How an icon on the timeline looks: filled in the primary color for a step, grey with a dashed border for a
 * milestone, and plain grey for a group of tools shown apart from the steps.
 */
export type MarkerVariant = 'step' | 'milestone' | 'muted';

/** An icon in a circle, on the timeline or beside a heading. Hidden from screen readers, as its entry's text says it all. */
export function TimelineMarker({
  icon: Icon,
  variant = 'step',
  size = MARKER_SIZE,
}: {
  icon: SvgIconComponent;
  variant?: MarkerVariant;
  size?: number;
}): React.JSX.Element {
  const colors = {
    step: { bgcolor: 'var(--ifm-color-primary)', color: 'var(--ifm-color-white)' },
    milestone: {
      bgcolor: 'var(--ifm-color-emphasis-200)',
      color: 'var(--ifm-color-emphasis-800)',
      border: '1px dashed var(--ifm-color-emphasis-500)',
    },
    muted: { bgcolor: 'var(--ifm-color-emphasis-200)', color: 'var(--ifm-color-emphasis-800)' },
  }[variant];
  return (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...colors,
      }}
    >
      <Icon sx={{ fontSize: Math.round(size * 0.56) }} />
    </Box>
  );
}

/** The small upper-case label above an entry's title, such as "Step 1". */
export function TimelineLabel({ children }: React.PropsWithChildren): React.JSX.Element {
  return (
    <Box
      component="p"
      sx={{
        m: 0,
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        lineHeight: 1.6,
        textTransform: 'uppercase',
        color: SECONDARY_TEXT,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * The styles of an entry of the timeline: its icon in a narrow first column, its content in the second and, if it
 * `connects` to the next entry, a line from its icon down to the next one's.
 */
export function timelineEntrySx(connects: boolean) {
  return {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: `${MARKER_SIZE}px minmax(0, 1fr)`,
    columnGap: 1.5,
    ...(connects && {
      '&::before': {
        content: '""',
        position: 'absolute',
        left: MARKER_SIZE / 2 - 1,
        top: MARKER_SIZE,
        bottom: -ENTRY_GAP,
        width: 2,
        bgcolor: 'var(--ifm-color-emphasis-300)',
      },
    }),
  } as const;
}

/** The dashed box around a milestone's content. */
export const MILESTONE_BOX_SX = {
  p: 1.25,
  border: '1px dashed var(--ifm-color-emphasis-400)',
  borderRadius: 'var(--ifm-global-radius)',
  bgcolor: 'var(--ifm-color-emphasis-100)',
} as const;

/** The four columns of MEDS data, as code. */
export function MedsColumns(): React.JSX.Element {
  return (
    <Box
      component="ul"
      aria-label="The columns of MEDS data"
      sx={{ ...UNSTYLED_LIST, mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
    >
      {MEDS_COLUMNS.map(column => (
        <li key={column}>
          <code>{column}</code>
        </li>
      ))}
    </Box>
  );
}
