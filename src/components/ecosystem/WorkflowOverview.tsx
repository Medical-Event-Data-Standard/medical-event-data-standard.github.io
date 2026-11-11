import React, { useMemo } from 'react';
import Link from '@docusaurus/Link';
import { Box } from '@mui/material';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import {
  WorkflowSection,
  examplePackages,
  groupByStage,
  stageAnchorId,
  stagePackages,
  workflowSections,
} from '@site/src/lib/ecosystem/workflow';
import { StepNumber, UNSTYLED_LIST } from './EcosystemFlowchart';

// The MEDS workflow at a glance, at the top of "Welcome to MEDS" (docs/intro_pages/1_intro.mdx): a compact form of
// the flowchart on the "Which tool do I use for what?" page (EcosystemFlowchart.tsx). It shows the steps from raw
// EHR data to a benchmark result; that the first of them, converting the data, leaves it in a simple format of
// four columns; and how many tools static/data/ecosystem.yaml lists for each step, naming a few. Each step links to
// its box in the flowchart.
//
// This site uses MUI's default theme, which does not follow Docusaurus's dark mode, so the colors here come from
// Infima's variables, which do.

/** The "Which tool do I use for what?" page (docs/intro_pages/3_ecosystem_workflow.mdx). */
export const WORKFLOW_PAGE_PATH = '/docs/intro_pages/ecosystem_workflow';

/** The columns that every MEDS dataset has, as listed in the introduction's prose. */
const MEDS_COLUMNS = ['subject_id', 'time', 'code', 'numeric_value'];

/** How many of a step's tools to name. */
const EXAMPLE_COUNT = 3;

/**
 * Apply their styles where the overview is wide enough for the first step to sit in one row with the raw data and
 * the MEDS data on either side of it, and for the other steps to sit two, three or six to a row. The overview is a
 * CSS container, so these follow its own width rather than the window's.
 */
const CONTAINER = 'workflow-overview';
const WIDE = `@container ${CONTAINER} (min-width: 38rem)`;
const TWO_COLUMNS = `@container ${CONTAINER} (min-width: 18rem)`;
const THREE_COLUMNS = `@container ${CONTAINER} (min-width: 30rem)`;
const SIX_COLUMNS = `@container ${CONTAINER} (min-width: 60rem)`;

const BORDER = '1px solid var(--ifm-color-emphasis-300)';
const SECONDARY_TEXT = 'var(--ifm-color-emphasis-700)';

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

/** An arrow from one part of the first row to the next: down where they are stacked, and right beside each other. */
function Arrow(): React.JSX.Element {
  const icon = { display: 'block', color: 'var(--ifm-color-emphasis-500)' };
  return (
    <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', alignSelf: 'center' }}>
      <ArrowDownwardIcon fontSize="small" sx={{ ...icon, [WIDE]: { display: 'none' } }} />
      <ArrowForwardIcon fontSize="small" sx={{ ...icon, display: 'none', [WIDE]: { display: 'block' } }} />
    </Box>
  );
}

/**
 * A step of the workflow: its number, its title, which links to its box in the flowchart, and its tools. The link
 * covers the whole card, so that all of it can be clicked.
 */
function StepCard({ section }: { section: WorkflowSection }): React.JSX.Element {
  const { stage, step } = section;
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        p: 1.5,
        border: BORDER,
        borderRadius: 'var(--ifm-global-radius)',
        bgcolor: 'var(--ifm-background-surface-color)',
        transition: 'border-color 0.15s ease-in-out',
        '&:hover': { borderColor: 'var(--ifm-color-primary)' },
        '&:has(a:focus-visible)': { outline: '2px solid var(--ifm-color-primary)', outlineOffset: 2 },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <StepNumber step={step!} size={22} />
        <Box
          component={Link}
          to={`${WORKFLOW_PAGE_PATH}#${stageAnchorId(stage.id)}`}
          sx={{
            fontWeight: 600,
            lineHeight: 1.3,
            // The site's link color is a dark blue in both modes, so dark mode uses its primary color instead.
            '[data-theme="dark"] &': { color: 'var(--ifm-color-primary)' },
            // Covers the card.
            '&::after': { content: '""', position: 'absolute', inset: 0 },
            '&:focus-visible': { outline: 'none' },
          }}
        >
          {stage.title}
        </Box>
      </Box>
      <Box component="p" sx={{ m: 0, mt: 0.75, fontSize: '0.8rem', lineHeight: 1.4, color: SECONDARY_TEXT }}>
        {toolSummary(section)}
      </Box>
    </Box>
  );
}

/** Where the data stands after the first step: in MEDS, with its four columns. */
function MedsData(): React.JSX.Element {
  return (
    <Box
      sx={{
        p: 1.5,
        border: '1px dashed var(--ifm-color-emphasis-400)',
        borderRadius: 'var(--ifm-global-radius)',
        bgcolor: 'var(--ifm-color-emphasis-100)',
      }}
    >
      <Box component="p" sx={{ m: 0, fontWeight: 600, lineHeight: 1.3 }}>
        Your data in MEDS
      </Box>
      <Box component="p" sx={{ m: 0, mt: 0.5, fontSize: '0.8rem', lineHeight: 1.4, color: SECONDARY_TEXT }}>
        One row per event, in just four columns, ready for the tools of every step below:
      </Box>
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
    </Box>
  );
}

/** The MEDS workflow at a glance, from the categories of static/data/ecosystem.yaml. */
export default function WorkflowOverview({ data }: { data: Record<string, RawCategory> }): React.JSX.Element {
  const { steps, toolCount } = useMemo(() => {
    const sections = workflowSections(groupByStage(parseCategoryMap(data)));
    return {
      steps: sections.filter(section => section.step),
      // Tools listed at several steps are counted once.
      toolCount: new Set(sections.flatMap(section => stagePackages(section).map(pkg => pkg.name))).size,
    };
  }, [data]);
  const [first, ...rest] = steps;

  return (
    <Box sx={{ container: `${CONTAINER} / inline-size`, mb: 'var(--ifm-paragraph-margin-bottom)' }}>
      <Box
        component="ol"
        aria-label="The MEDS workflow, from raw EHR data to a benchmark result"
        sx={{
          ...UNSTYLED_LIST,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 1.5,
          [TWO_COLUMNS]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          [THREE_COLUMNS]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          [SIX_COLUMNS]: { gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' },
        }}
      >
        {/* The first step spans a row of its own, between the raw data and the MEDS data. */}
        <Box
          component="li"
          sx={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 0.75,
            [WIDE]: {
              gridTemplateColumns: 'auto auto minmax(0, 1fr) auto minmax(0, 1.25fr)',
              alignItems: 'stretch',
              gap: 1,
            },
          }}
        >
          <Box
            component="p"
            sx={{
              m: 0,
              justifySelf: 'center',
              alignSelf: 'center',
              px: 2,
              py: 0.5,
              borderRadius: 4,
              bgcolor: 'var(--ifm-color-emphasis-200)',
              fontSize: '0.875rem',
              fontWeight: 600,
              textAlign: 'center',
              [WIDE]: { maxWidth: '8rem' },
            }}
          >
            Start: your raw EHR data
          </Box>
          <Arrow />
          <StepCard section={first} />
          <Arrow />
          <MedsData />
        </Box>
        {rest.map(section => (
          <li key={section.stage.id}>
            <StepCard section={section} />
          </li>
        ))}
      </Box>
      <Box component="p" sx={{ m: 0, mt: 1.5, fontSize: '0.9rem' }}>
        <strong>{toolCount} tools</strong> in all, across the workflow.{' '}
        <Link to={WORKFLOW_PAGE_PATH}>See which tool to use for what</Link>.
      </Box>
    </Box>
  );
}
