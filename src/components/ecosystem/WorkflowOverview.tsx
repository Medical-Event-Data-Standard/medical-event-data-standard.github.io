import React, { useMemo } from 'react';
import Link from '@docusaurus/Link';
import { Box } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import BuildIcon from '@mui/icons-material/Build';
import DatasetIcon from '@mui/icons-material/Dataset';
import SchoolIcon from '@mui/icons-material/School';
import { Package, RawCategory, StageId } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import {
  WorkflowSection,
  examplePackages,
  groupByStage,
  stagePackages,
  toolAnchorIds,
  workflowSections,
} from '@site/src/lib/ecosystem/workflow';
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

// The quick start visual guide at the top of "Welcome to MEDS" (docs/intro_pages/1_intro.mdx): the MEDS workflow
// as a timeline, top to bottom, from raw EHR data to a benchmark result. After the first step, converting the data,
// a milestone shows the data in MEDS, with its four columns. Each step gives its tutorial pages, if the tutorial
// has any; how many tools static/data/ecosystem.yaml lists for it, naming a few (those in `STAGE_FEATURED_TOOLS`,
// or else the first of its categories); and any other pages of the site for it, such as the Datasets tab for
// converting data. Each tool named links to its tile on the "Which tool do I use for what?" page, which selects it,
// and a line under the timeline links to that page, which lists every tool by step.
//
// The timeline's look (icons, markers, labels and milestones) is shared with that page's flowchart; see
// timeline.tsx.

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

/** A tool to name at a step, by its name in static/data/ecosystem.yaml, and the name to show, if different. */
export interface FeaturedTool {
  name: string;
  label?: string;
}

/**
 * The tools to name at a step, instead of the first few of its categories (see `examplePackages`). Tools that the
 * step doesn't list are skipped.
 */
export const STAGE_FEATURED_TOOLS: Partial<Record<StageId, FeaturedTool[]>> = {
  convert: [
    { name: 'ETL Template', label: 'ETL_MEDS_Template' },
    { name: 'OMOP (via dedicated OMOP_MEDS)', label: 'OMOP_MEDS' },
    { name: 'FHIR', label: 'FHIR_MEDS' },
  ],
};

/** Another page of the site for a step, linked to as "<text> <title>". */
export interface PageLink {
  text: string;
  title: string;
  to: string;
}

/** Other pages of the site for each step, besides its tutorials and tools. */
export const STAGE_PAGES: Partial<Record<StageId, PageLink[]>> = {
  convert: [{ text: 'Public datasets already in MEDS: see the', title: 'Datasets tab', to: '/datasets' }],
};

/** How many of a step's tools to name. */
const EXAMPLE_COUNT = 3;

/**
 * Applies its styles where the guide is wide enough to put a step's tutorials and tools beside its description.
 * The guide is a CSS container, so this follows its own width rather than the window's.
 */
const CONTAINER = 'workflow-overview';
const WIDE = `@container ${CONTAINER} (min-width: 40rem)`;

/** The site's link color is a dark blue in both modes, so links here use its primary color in dark mode instead. */
const DARK_MODE_LINK = { '[data-theme="dark"] &': { color: 'var(--ifm-color-primary)' } } as const;
const SMALL_TEXT = { fontSize: '0.8rem', lineHeight: 1.4 } as const;

/** Items with the separators of an English list between them: [A], [A, " and ", B], [A, ", ", B, " and ", C]. */
function listParts<T>(items: T[]): (T | string)[] {
  return items.flatMap((item, index) =>
    index === 0 ? [item] : [index === items.length - 1 ? ' and ' : ', ', item]
  );
}

/** The tools to name at a step, with the names to show: its featured tools, if any, else the first few. */
function namedTools(section: WorkflowSection): { pkg: Package; label: string }[] {
  const packages = stagePackages(section);
  const featured = (STAGE_FEATURED_TOOLS[section.stage.id as StageId] ?? []).flatMap(({ name, label }) => {
    const pkg = packages.find(candidate => candidate.name === name);
    return pkg ? [{ pkg, label: label ?? pkg.name }] : [];
  });
  return featured.length > 0
    ? featured
    : examplePackages(section, EXAMPLE_COUNT).map(pkg => ({ pkg, label: pkg.name }));
}

/**
 * What a step's tools are: their number and the names of a few, such as "25 tools, such as A, B and C", with the
 * names rendered by `name`.
 */
function summarize<T>(section: WorkflowSection, name: (pkg: Package, label: string) => T): (T | string)[] {
  const total = stagePackages(section).length;
  if (total === 0) return ['No tools listed yet'];
  const named = namedTools(section);
  const count = `${total} ${total === 1 ? 'tool' : 'tools'}`;
  return [
    count,
    total > named.length ? ', such as ' : ': ',
    ...listParts(named.map(({ pkg, label }) => name(pkg, label))),
  ];
}

/** What a step's tools are, as text, such as "25 tools, such as A, B and C". */
export function toolSummary(section: WorkflowSection): string {
  return summarize(section, (_, label) => label).join('');
}

/**
 * What a step's tools are, with each tool named linking to its tile on the "Which tool do I use for what?" page,
 * which selects it. `toolIds` gives the tiles' ids, by package name (see `toolAnchorIds`).
 */
function ToolSummary({
  section,
  toolIds,
}: {
  section: WorkflowSection;
  toolIds: Map<string, string>;
}): React.JSX.Element {
  return (
    <>
      {summarize(section, (pkg, label) => (
        <Box
          key={pkg.name}
          component={Link}
          to={`${WORKFLOW_PAGE_PATH}#${toolIds.get(pkg.name)}`}
          sx={DARK_MODE_LINK}
        >
          {label}
        </Box>
      ))}
    </>
  );
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

function PageLine({ page }: { page: PageLink }): React.JSX.Element {
  return (
    <IconLine icon={DatasetIcon}>
      {page.text}{' '}
      <Box component={Link} to={page.to} sx={{ fontWeight: 600, ...DARK_MODE_LINK }}>
        {page.title}
      </Box>
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
  /** The step's tools (see `ToolSummary`). */
  tools?: React.ReactNode;
  /** Other pages of the site for the step, listed after its tools. */
  pages?: PageLink[];
  /** Whether a line connects the entry's icon to the next entry's; every entry's but the last. */
  connects?: boolean;
}

/**
 * An entry of the timeline: an icon on the line, then the entry's label, title and description, and its tutorials,
 * tools and other pages, which sit beside the description where the guide is wide enough.
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
  pages = [],
  connects = true,
}: EntryProps): React.JSX.Element {
  const hasLinks = tutorials.length > 0 || tools !== undefined || pages.length > 0;
  return (
    <Box component="li" sx={timelineEntrySx(connects)}>
      <TimelineMarker icon={Icon} variant={milestone ? 'milestone' : 'step'} />
      <Box
        sx={{
          minWidth: 0,
          pb: 0.5,
          ...(milestone && MILESTONE_BOX_SX),
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 0.75,
          [WIDE]: hasLinks ? { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 17rem)', columnGap: 2 } : {},
        }}
      >
        <div>
          <TimelineLabel>{label}</TimelineLabel>
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
            {pages.map(page => (
              <PageLine key={page.to} page={page} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** The quick start visual guide, from the categories of static/data/ecosystem.yaml. */
export default function WorkflowOverview({ data }: { data: Record<string, RawCategory> }): React.JSX.Element {
  const { steps, toolIds, toolCount } = useMemo(() => {
    const sections = workflowSections(groupByStage(parseCategoryMap(data)));
    return {
      steps: sections.filter(section => section.step),
      // The same ids as the tiles of the "Which tool do I use for what?" page, which are made from the same data.
      toolIds: toolAnchorIds(sections),
      // Tools listed at several steps are counted once.
      toolCount: new Set(sections.flatMap(section => stagePackages(section).map(pkg => pkg.name))).size,
    };
  }, [data]);

  const stepEntry = (section: WorkflowSection): React.JSX.Element => {
    const id = section.stage.id as StageId;
    return (
      <Entry
        key={id}
        icon={STAGE_ICONS[id]}
        // The first step connects to the data in MEDS, which follows it; the last connects to nothing.
        connects={section === steps[0] || section !== steps[steps.length - 1]}
        label={`Step ${section.step}`}
        title={section.stage.title}
        description={section.stage.description}
        tutorials={STAGE_TUTORIALS[id]}
        pages={STAGE_PAGES[id]}
        tools={<ToolSummary section={section} toolIds={toolIds} />}
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
        <Entry {...RAW_DATA} milestone />
        {first && stepEntry(first)}
        <Entry
          {...MEDS_DATA}
          milestone
          connects={rest.length > 0}
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
