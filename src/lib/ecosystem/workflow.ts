import type { Category, Package, ParsedEcosystem, StageId } from './types';

// The stages of the MEDS workflow, as shown by the flowchart on the "Which tool do I use for what?" page
// (src/components/ecosystem/EcosystemWorkflow.tsx). Which packages each stage lists is not decided here: every
// category in static/data/ecosystem.yaml names its stage with a `stage` key (or inherits its parent's), so a
// package added to a category shows up in that category's stage automatically.

export interface Stage {
  id: StageId | 'other';
  title: string;
  description: string;
  /** Whether this is a step of the workflow, rather than a group of tools shown apart from its steps. */
  step: boolean;
}

/** In flowchart order. Typed as a record so that every `StageId` must be described here. */
const STAGE_INFO: Record<StageId, Omit<Stage, 'id'>> = {
  convert: {
    title: 'Convert your data to MEDS',
    description:
      'Run a ready-made ETL for a public dataset or another data standard (such as OMOP), or build your own ' +
      'from a template.',
    step: true,
  },
  explore: {
    title: 'Explore and inspect',
    description: 'See what is in a MEDS dataset with summary statistics, plots and interactive dashboards.',
    step: true,
  },
  preprocess: {
    title: 'Pre-process and load',
    description: 'Filter, normalize and tokenize MEDS data, and load it efficiently for model training.',
    step: true,
  },
  task: {
    title: 'Define a prediction task',
    description: 'Describe a cohort and its labels once, then extract them from any MEDS dataset.',
    step: true,
  },
  model: {
    title: 'Build models',
    description:
      'Train tabular baselines or neural and foundation models, with a modeling library or a published, ' +
      'reproducible recipe.',
    step: true,
  },
  evaluate: {
    title: 'Evaluate',
    description: "Score a model's predictions with standardized metrics.",
    step: true,
  },
  benchmark: {
    title: 'Benchmark and share',
    description:
      'Compare against published results, and share your tasks, models and results with the community.',
    step: true,
  },
  general: {
    title: 'Across the workflow',
    description: 'The MEDS schema itself, and utilities that are useful at any step.',
    step: false,
  },
};

export const STAGES: Stage[] = (Object.keys(STAGE_INFO) as StageId[]).map(id => ({ id, ...STAGE_INFO[id] }));

export const STAGE_IDS: StageId[] = STAGES.map(stage => stage.id as StageId);

/** Where the flowchart lists the packages of categories that have no stage. */
export const OTHER_STAGE: Stage = {
  id: 'other',
  title: 'Other tools',
  description: 'More tools that work with MEDS data.',
  step: false,
};

export function isStageId(value: unknown): value is StageId {
  return (STAGE_IDS as unknown[]).includes(value);
}

export interface CategoryGroup {
  category: Category;
  packages: Package[];
}

export interface StageGroup {
  stage: Stage;
  /** The categories in this stage that list packages, in YAML order. */
  categories: CategoryGroup[];
}

/**
 * Groups the packages of an ecosystem by workflow stage, and within a stage by category.
 *
 * Returns every stage, in flowchart order, even if it has no packages, followed by `OTHER_STAGE` for the
 * categories that have no stage. Categories without packages of their own (such as "Tools") are left out.
 */
export function groupByStage({
  categories,
  packages,
}: Pick<ParsedEcosystem, 'categories' | 'packages'>): StageGroup[] {
  const groups = new Map<Stage['id'], StageGroup>(
    [...STAGES, OTHER_STAGE].map(stage => [stage.id, { stage, categories: [] }])
  );
  for (const category of categories) {
    if (category.packages.length > 0) {
      groups.get(category.stage ?? 'other')!.categories.push({
        category,
        packages: category.packages.map(name => packages[name]),
      });
    }
  }
  return [...groups.values()];
}

/** A group of tools as the flowchart shows it: a numbered step of the workflow, or a group apart from the steps. */
export interface WorkflowSection extends StageGroup {
  /** The step's number, counting from 1; undefined for a group shown apart from the steps. */
  step?: number;
}

/**
 * The sections of the flowchart, in order: every step of the workflow, numbered, even if it has no tools, and
 * then the groups apart from the steps (tools used at any step, and those of categories without a stage) that
 * have tools.
 */
export function workflowSections(groups: StageGroup[]): WorkflowSection[] {
  const steps = groups
    .filter(group => group.stage.step)
    .map((group, index) => ({ ...group, step: index + 1 }));
  const others = groups.filter(group => !group.stage.step && group.categories.length > 0);
  return [...steps, ...others];
}

/**
 * Gives every tool in the flowchart the id of its tile, which the tool's chips link to as `#<id>`: "tool-" and its
 * name in lower case, with each run of characters other than letters and digits replaced by a dash, e.g.
 * `tool-aces` or `tool-omop-via-meds-etl`. A tool listed at several steps gets one id, and tools whose names give
 * the same id are told apart by a number, e.g. `tool-meds-etl-2`.
 *
 * Returns a map from package name to id.
 */
export function toolAnchorIds(sections: WorkflowSection[]): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const pkg of sections.flatMap(({ categories }) => categories.flatMap(({ packages }) => packages))) {
    if (ids.has(pkg.name)) continue;
    const slug = pkg.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const base = slug ? `tool-${slug}` : 'tool';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    ids.set(pkg.name, id);
  }
  return ids;
}

/**
 * The sections of the tool tiles shown beside the flowchart: those of the flowchart, but with each tool only in
 * the first section that lists it, so that every tool has one tile. Categories and sections left without tools
 * (such as steps without any) are left out.
 */
export function tileSections(sections: WorkflowSection[]): WorkflowSection[] {
  const placed = new Set<string>();
  const isFirst = (pkg: Package): boolean => {
    if (placed.has(pkg.name)) return false;
    placed.add(pkg.name);
    return true;
  };
  return sections
    .map(section => ({
      ...section,
      categories: section.categories
        .map(({ category, packages }) => ({ category, packages: packages.filter(isFirst) }))
        .filter(({ packages }) => packages.length > 0),
    }))
    .filter(({ categories }) => categories.length > 0);
}
