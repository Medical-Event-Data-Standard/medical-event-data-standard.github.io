import React, { useMemo } from 'react';
import Link from '@docusaurus/Link';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BuildIcon from '@mui/icons-material/Build';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import ModelTrainingIcon from '@mui/icons-material/ModelTraining';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SchoolIcon from '@mui/icons-material/School';
import StorageIcon from '@mui/icons-material/Storage';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import TableRowsIcon from '@mui/icons-material/TableRows';
import TuneIcon from '@mui/icons-material/Tune';
import { RawCategory, StageId } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import {
  WorkflowSection,
  examplePackages,
  groupByStage,
  stagePackages,
  workflowSections,
} from '@site/src/lib/ecosystem/workflow';
import { UNSTYLED_LIST } from './EcosystemFlowchart';

// The quick start visual guide at the top of "Welcome to MEDS" (docs/intro_pages/1_intro.mdx): the MEDS workflow
// as a timeline, top to bottom, from raw EHR data to a benchmark result. After the first step, converting the data,
// a milestone shows the data in MEDS, with its four columns. Each step gives its tutorial pages, if the tutorial
// has any, and how many tools static/data/ecosystem.yaml lists for it, naming a few. A line under the timeline
// links to the "Which tool do I use for what?" page, which lists every tool by step.
//
// The icons are Material Icons, from @mui/icons-material. This site uses MUI's default theme, which does not follow
// Docusaurus's dark mode, so the colors here come from Infima's variables, which do.

/** The "Which tool do I use for what?" page (docs/intro_pages/3_ecosystem_workflow.mdx). */
export const WORKFLOW_PAGE_PATH = '/docs/intro_pages/ecosystem_workflow';

const TUTORIAL_PATH = '/docs/tutorials/ml4h2025';

/** A page of the tutorial (docs/tutorials/ml4h2025), and the part of it that a step links to, if not all of it. */
export interface TutorialLink {
  title: string;
  to: string;
  section?: string;
}

/** The tutorial pages for each step of the workflow; steps without any are left out. */
export const STAGE_TUTORIALS: Partial<Record<StageId, TutorialLink[]>> = {
  convert: [{ title: 'Converting to MEDS', to: `${TUTORIAL_PATH}/converting_to_MEDS` }],
  preprocess: [{ title: 'Pre-processing MEDS Data', to: `${TUTORIAL_PATH}/preprocessing_MEDS_data` }],
  task: [{ title: 'Extracting a Prediction Task', to: `${TUTORIAL_PATH}/extracting_prediction_tasks` }],
  model: [
    { title: 'Build a Tabular Baseline', to: `${TUTORIAL_PATH}/build_a_model_tabular` },
    { title: 'Build a Neural Network', to: `${TUTORIAL_PATH}/build_a_model_NN` },
  ],
  evaluate: [
    {
      title: 'Build a Tabular Baseline',
      to: `${TUTORIAL_PATH}/build_a_model_tabular`,
      section: 'Evaluating the Model',
    },
  ],
  benchmark: [{ title: 'Compare with MEDS-DEV', to: `${TUTORIAL_PATH}/compare_with_meds_dev` }],
};

/** The tutorial page that introduces data in MEDS, for the milestone after the first step. */
export const MEDS_DATA_TUTORIAL: TutorialLink = {
  title: 'Getting Familiar with MEDS',
  to: `${TUTORIAL_PATH}/MEDS_intro`,
};

/** The icon of each step of the workflow. */
const STAGE_ICONS: Partial<Record<StageId, SvgIconComponent>> = {
  convert: SyncAltIcon,
  explore: QueryStatsIcon,
  preprocess: TuneIcon,
  task: AssignmentIcon,
  model: ModelTrainingIcon,
  evaluate: AssessmentIcon,
  benchmark: LeaderboardIcon,
};

/** The columns that every MEDS dataset has, as listed in the introduction's prose. */
const MEDS_COLUMNS = ['subject_id', 'time', 'code', 'numeric_value'];

/** How many of a step's tools to name. */
const EXAMPLE_COUNT = 3;

/**
 * Applies its styles where the guide is wide enough to put a step's tutorials and tools beside its description.
 * The guide is a CSS container, so this follows its own width rather than the window's.
 */
const CONTAINER = 'workflow-overview';
const WIDE = `@container ${CONTAINER} (min-width: 40rem)`;

/** The size of the icons in the timeline, and the spacing between its entries, in pixels. */
const MARKER_SIZE = 36;
const ENTRY_GAP = 12;

const SECONDARY_TEXT = 'var(--ifm-color-emphasis-700)';
const SMALL_TEXT = { fontSize: '0.8rem', lineHeight: 1.4 } as const;

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  return names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What a step's tools are: their number and the names of a few, such as "25 tools, such as A, B and C". */
export function toolSummary(section: WorkflowSection): string {
  const total = stagePackages(section).length;
  if (total === 0) return 'No tools listed yet';
  const names = joinNames(examplePackages(section, EXAMPLE_COUNT).map(pkg => pkg.name));
  const count = `${total} ${total === 1 ? 'tool' : 'tools'}`;
  return total > EXAMPLE_COUNT ? `${count}, such as ${names}` : `${count}: ${names}`;
}

/** A line of small text after an icon, such as a tutorial link or a step's tools. */
function IconLine({ icon: Icon, children }: React.PropsWithChildren<{ icon: SvgIconComponent }>) {
  return (
    <Box component="li" sx={{ ...SMALL_TEXT, display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
      <Icon aria-hidden sx={{ fontSize: '1rem', mt: '0.1rem', flexShrink: 0, color: SECONDARY_TEXT }} />
      <span>{children}</span>
    </Box>
  );
}

/** The site's link color is a dark blue in both modes, so links here use its primary color in dark mode instead. */
const DARK_MODE_LINK = { '[data-theme="dark"] &': { color: 'var(--ifm-color-primary)' } } as const;

function TutorialLine({ tutorial }: { tutorial: TutorialLink }): React.JSX.Element {
  return (
    <IconLine icon={SchoolIcon}>
      Tutorial:{' '}
      <Box component={Link} to={tutorial.to} sx={{ fontWeight: 600, ...DARK_MODE_LINK }}>
        {tutorial.title}
      </Box>
      {tutorial.section && ` (${tutorial.section})`}
    </IconLine>
  );
}

interface EntryProps {
  icon: SvgIconComponent;
  /** What the entry is, shown above its title, such as "Step 1". */
  label: string;
  title: string;
  description: string;
  /** A milestone (where the data stands) is set apart from the steps (what you do). */
  milestone?: boolean;
  /** Shown under the description. */
  extra?: React.ReactNode;
  tutorials?: TutorialLink[];
  /** The step's tools, as given by `toolSummary`. */
  tools?: string;
}

/**
 * An entry of the timeline: an icon on the line, then the entry's label, title and description, and its tutorials
 * and tools, which sit beside the description where the guide is wide enough.
 */
function Entry({
  icon: Icon,
  label,
  title,
  description,
  milestone = false,
  extra,
  tutorials = [],
  tools,
}: EntryProps): React.JSX.Element {
  const hasLinks = tutorials.length > 0 || tools !== undefined;
  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `${MARKER_SIZE}px minmax(0, 1fr)`,
        columnGap: 1.5,
        // The line from this entry's icon down to the next entry's.
        '&:not(:last-of-type)::before': {
          content: '""',
          position: 'absolute',
          left: MARKER_SIZE / 2 - 1,
          top: MARKER_SIZE,
          bottom: -ENTRY_GAP,
          width: 2,
          bgcolor: 'var(--ifm-color-emphasis-300)',
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...(milestone
            ? {
                bgcolor: 'var(--ifm-color-emphasis-200)',
                color: 'var(--ifm-color-emphasis-800)',
                border: '1px dashed var(--ifm-color-emphasis-500)',
              }
            : { bgcolor: 'var(--ifm-color-primary)', color: 'var(--ifm-color-white)' }),
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Box
        sx={{
          minWidth: 0,
          pb: 0.5,
          ...(milestone && {
            p: 1.25,
            border: '1px dashed var(--ifm-color-emphasis-400)',
            borderRadius: 'var(--ifm-global-radius)',
            bgcolor: 'var(--ifm-color-emphasis-100)',
          }),
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 0.75,
          [WIDE]: hasLinks ? { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 17rem)', columnGap: 2 } : {},
        }}
      >
        <div>
          <Box
            component="p"
            sx={{
              m: 0,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: SECONDARY_TEXT,
            }}
          >
            {label}
          </Box>
          <Box component="p" sx={{ m: 0, fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </Box>
          <Box component="p" sx={{ ...SMALL_TEXT, m: 0, mt: 0.25, color: SECONDARY_TEXT }}>
            {description}
          </Box>
          {extra}
        </div>
        {hasLinks && (
          <Box
            component="ul"
            sx={{ ...UNSTYLED_LIST, display: 'grid', gap: 0.5, alignContent: 'start', [WIDE]: { pt: 2 } }}
          >
            {tutorials.map(tutorial => (
              <TutorialLine key={`${tutorial.to}#${tutorial.section ?? ''}`} tutorial={tutorial} />
            ))}
            {tools !== undefined && <IconLine icon={BuildIcon}>{tools}</IconLine>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** The four columns of MEDS data. */
function MedsColumns(): React.JSX.Element {
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

/** The quick start visual guide, from the categories of static/data/ecosystem.yaml. */
export default function WorkflowOverview({ data }: { data: Record<string, RawCategory> }): React.JSX.Element {
  const { steps, toolCount } = useMemo(() => {
    const sections = workflowSections(groupByStage(parseCategoryMap(data)));
    return {
      steps: sections.filter(section => section.step),
      // Tools listed at several steps are counted once.
      toolCount: new Set(sections.flatMap(section => stagePackages(section).map(pkg => pkg.name))).size,
    };
  }, [data]);

  const stepEntry = (section: WorkflowSection): React.JSX.Element => {
    const id = section.stage.id as StageId;
    return (
      <Entry
        key={id}
        icon={STAGE_ICONS[id] ?? BuildIcon}
        label={`Step ${section.step}`}
        title={section.stage.title}
        description={section.stage.description}
        tutorials={STAGE_TUTORIALS[id]}
        tools={toolSummary(section)}
      />
    );
  };
  const [first, ...rest] = steps;

  return (
    <Box sx={{ container: `${CONTAINER} / inline-size`, mb: 'var(--ifm-paragraph-margin-bottom)' }}>
      <Box
        component="ol"
        aria-label="The MEDS workflow, from raw EHR data to a benchmark result"
        sx={{ ...UNSTYLED_LIST, display: 'grid', gap: `${ENTRY_GAP}px` }}
      >
        <Entry
          icon={StorageIcon}
          label="Start"
          title="Your raw EHR data"
          description="Your health records, in whatever tables, files or data standard they come in."
          milestone
        />
        {first && stepEntry(first)}
        <Entry
          icon={TableRowsIcon}
          label="Milestone"
          title="Your data in MEDS"
          description="One row per event, in just four columns, ready for the tools of every step below:"
          milestone
          extra={<MedsColumns />}
          tutorials={[MEDS_DATA_TUTORIAL]}
        />
        {rest.map(stepEntry)}
      </Box>
      <Box component="p" sx={{ m: 0, mt: 1.5, fontSize: '0.9rem' }}>
        <strong>{toolCount} tools</strong> in all, across the workflow.{' '}
        <Box component={Link} to={WORKFLOW_PAGE_PATH} sx={DARK_MODE_LINK}>
          See which tool to use for what
        </Box>
        .
      </Box>
    </Box>
  );
}
