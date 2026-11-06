import type { Category, Package, ParsedEcosystem, StageId } from './types';

// The stages of the MEDS workflow, as shown by the "Which tool do I use for what?" flowchart on the ecosystem page
// (src/components/ecosystem/EcosystemFlowchart.tsx). Which packages each stage lists is not decided here: every
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

export interface PackageLink {
  href: string;
  /** What the link points to, e.g. "GitHub". */
  label: string;
}

/** The page the flowchart links a package to: its GitHub repository if it has one, or else its best other link. */
export function packageLink(pkg: Package): PackageLink | undefined {
  if (pkg.githubRepo) return { href: `https://github.com/${pkg.githubRepo}`, label: 'GitHub' };
  if (pkg.docsUrl) return { href: pkg.docsUrl, label: 'documentation' };
  if (pkg.physionetUrl) return { href: pkg.physionetUrl, label: 'PhysioNet' };
  if (pkg.pypiName) return { href: `https://pypi.org/project/${pkg.pypiName}`, label: 'PyPI' };
  if (pkg.paperUrl) return { href: pkg.paperUrl, label: 'paper' };
  return undefined;
}
