import * as MuiIcons from '@mui/icons-material';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

// Topics

export interface RichTopicName {
  name: string;
  icon?: keyof typeof MuiIcons;
}

export interface Topic extends RichTopicName {
  description?: string;
  featured?: string[];
}

// Raw packages (sourced from static/data/ecosystem.yaml; `parseCategoryMap` rejects any other keys)

/** The entity in the MEDS-DEV registry (shown on this site's MEDS-DEV pages) that a package corresponds to. */
export interface RawMedsDevInfo {
  entity_type: `${MedsEntityType}`;
  name: string;
}

export interface RawPackage {
  name: string;
  github_repo?: string;
  warn?: string;
  demo_available?: boolean;
  docs_url?: string;
  paper_url?: string;
  pypi_name?: string;
  physionet_url?: string;
  topics?: string[];
  meds_dev?: RawMedsDevInfo;
}

// Workflow stages (see src/lib/ecosystem/workflow.ts, which describes each one)

/**
 * A stage of the MEDS workflow, under which the "Which tool do I use for what?" flowchart on the ecosystem page
 * lists a category's packages. `general` is for tools that are useful at any stage.
 */
export type StageId =
  | 'convert'
  | 'explore'
  | 'preprocess'
  | 'task'
  | 'model'
  | 'evaluate'
  | 'benchmark'
  | 'general';

// Raw categories from the YAML file

export interface RawCategory {
  name: string;
  description?: string;
  icon?: keyof typeof MuiIcons;
  /** Defaults to the stage of the parent category, if any. */
  stage?: StageId;
  packages?: RawPackage[];
  /** Every other key holds a nested subcategory. */
  [subcategoryKey: string]: RawCategory | RawPackage[] | string | undefined;
}

// Parsed packages

export interface MedsDevInfo {
  entityType: MedsEntityType;
  name: string;
}

export interface Package {
  name: string;
  githubRepo?: string;
  warn?: string;
  demoAvailable?: boolean;
  docsUrl?: string;
  paperUrl?: string;
  pypiName?: string;
  physionetUrl?: string;
  topics?: RichTopicName[];
  medsDev?: MedsDevInfo;
}

// GitHub metadata, fetched at build time by the `ecosystem-metadata` plugin (plugins/ecosystemMetadata.ts)

export interface RepoMetadata {
  stars: number | null;
  /** ISO 8601 timestamp (plugin global data must be JSON-serializable). */
  lastUpdated: string | null;
  release: string | null;
}

/** Keyed by `repoKey(githubRepo)`, i.e. lower-cased `owner/repo`. */
export type EcosystemMetadata = Record<string, RepoMetadata>;

export interface PackageWithMetadata extends Package {
  stars: number | null;
  lastUpdated: Date | null;
  release: string | null;
}

/** A category (or subcategory) of static/data/ecosystem.yaml. */
export interface Category {
  /** The category's topic name, e.g. "Dataset ETLs/Public Datasets". */
  topic: string;
  /** The category's own name, e.g. "Public Datasets". */
  name: string;
  /** The category's `stage`, or else that of its closest ancestor that has one. */
  stage?: StageId;
  /** Names of the packages listed directly in the category (not in its subcategories), in YAML order. */
  packages: string[];
}

export interface ParsedEcosystem {
  packages: Record<string, Package>;
  topics: Record<string, Topic>;
  topicPackages: Record<string, string[]>;
  /** Every category, each followed by its subcategories, in YAML order. */
  categories: Category[];
}
