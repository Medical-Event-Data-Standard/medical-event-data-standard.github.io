// #################################################
// #               Common Types                    #
// #################################################

export enum MedsEntityType {
  DATASET = 'dataset',
  MODEL = 'model',
  TASK = 'task',
}

export interface Contact {
  name: string;
  github_username: string;
}

export interface Metadata {
  description?: string;
  links?: string[];
  contacts?: Contact[];
  supported_datasets?: string[];
}

// Predicates are used across datasets and tasks
export interface Predicate {
  code?:
    | string
    | {
        regex?: string;
        any?: string[];
      }
    | null;
  expr?: string;
  value_min?: number | null;
  value_max?: number | null;
  value_min_inclusive?: boolean;
  value_max_inclusive?: boolean;
}

export type PredicateCollection = Record<string, Predicate>;

// Data blocks for entities have a common format

export interface SharedEntitySpec {
  metadata?: Metadata;
}

export interface SharedEntityData {
  type: MedsEntityType;
  entity?: SharedEntitySpec;
  readme?: string;
  refs?: string;
  requirements?: string[];
}

// #################################################
// #               Dataset Entities                #
// #################################################
// TODO: Offload to MEDS-DEV types package

export interface DatasetCommands {
  build_full?: string | null;
  build_demo?: string | null;
}

// Dataset specification
export interface DatasetSpec extends SharedEntitySpec {
  commands?: DatasetCommands;
}

export interface DatasetEntityData extends SharedEntityData {
  entity?: DatasetSpec;
  predicates?: PredicateCollection;
}

// #################################################
// #               Task Entities                   #
// #################################################

// ACES Types:
// TODO: Offload to ACES types package

// Window definition for task specifications
export interface Window {
  start: string | null;
  end: string | null;
  start_inclusive: boolean;
  end_inclusive: boolean;
  index_timestamp?: string;
  has?: Record<string, string>;
  label?: string;
}

// Task specification
export interface TaskSpec extends SharedEntitySpec {
  predicates: Record<string, Predicate>;
  trigger: string;
  windows: Record<string, Window>;
}

// Retrieved MEDS-DEV Task spec. TODO: Offload to a MEDS-DEV type package.
export interface TaskEntityData extends SharedEntityData {
  entity?: TaskSpec;
}

// #################################################
// #               Model Entities                  #
// #################################################

// TODO: Offload to MEDS-DEV types package
export interface ModelCommands {
  train?: string | null;
  predict?: string | null;
}

// Model specification
export interface ModelSpec extends SharedEntitySpec {
  commands: {
    unsupervised?: ModelCommands | null;
    supervised?: ModelCommands | null;
  };
}

export interface ModelEntityData extends SharedEntityData {
  entity?: ModelSpec;
}

// #################################################
// #               Tree Structure                  #
// #################################################

interface TreeNode<T> {
  name: string;
  data: T;
}

export interface MedsEntityFlatTreeNode<T> extends TreeNode<T> {
  children: string[];
}

export type MedsEntityFlatTree<T> = Record<string, MedsEntityFlatTreeNode<T>>;

export type MedsDatasets = MedsEntityFlatTree<DatasetEntityData>;
export type MedsTasks = MedsEntityFlatTree<TaskEntityData>;
export type MedsModels = MedsEntityFlatTree<ModelEntityData>;

export interface MedsEntityNestedTreeNode<T> extends TreeNode<T> {
  children: MedsEntityNestedTree<T>;
}

export type MedsEntityNestedTree<T> = Record<string, MedsEntityNestedTreeNode<T>>;

// #################################################
// #               Benchmark Results               #
// #################################################

// MEDS-Evaluation result specs: TODO: Offload to a MEDS-Evaluation type package
export interface Metrics {
  binary_accuracy?: number;
  f1_score?: number;
  roc_auc_score?: number;
  average_precision_score?: number;
  calibration_error?: number;
}

export interface Result {
  samples_equally_weighted?: Metrics;
  subjects_equally_weighted?: Metrics;
}

// TODO: Offload to a MEDS-DEV type package
export interface BenchmarkEntry {
  dataset: string;
  task: string;
  model: string;
  timestamp: string;
  result: Result;
  version: string;
}

// Define the overall structure as a record with string keys
export type BenchmarkResults = Record<string, BenchmarkEntry>;
