/** The options and validation rules of the MEDS-DEV collaboration request form. */

/**
 * The inbox that receives requests sent by email. While it is empty, the form offers only the public GitHub
 * issue; set it to the MEDS-DEV maintainers' address to add a private "Send by email" option.
 */
export const COLLABORATION_EMAIL = '';

export const ROLES = ['dataset', 'task', 'model', 'other'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  dataset: 'Dataset owner',
  task: 'Task owner',
  model: 'Model owner',
  other: 'Other',
};

// Each goal maps to a path described in the MEDS-DEV README or its issue templates.
export const GOALS = ['add', 'find-best-model', 'results', 'convert', 'task-feedback', 'other'] as const;
export type Goal = (typeof GOALS)[number];
export const GOAL_LABELS: Record<Goal, string> = {
  add: 'Add my dataset, task or model to MEDS-DEV',
  'find-best-model': 'Benchmark my data using MEDS-DEV to find the best model for my use case',
  results: 'Run MEDS-DEV on my data and share the results',
  convert: 'Get help converting a dataset to MEDS',
  'task-feedback': 'Get feedback on a task definition',
  other: 'Something else',
};

/**
 * The goals offered to each role. The form offers the union over the selected roles, so someone who owns a
 * dataset and a model sees the options of both.
 */
export const ROLE_GOALS: Record<Role, readonly Goal[]> = {
  // Only data holders can run MEDS-DEV on their data or convert it to MEDS.
  dataset: ['add', 'find-best-model', 'results', 'convert', 'other'],
  task: ['add', 'task-feedback', 'other'],
  // Model owners often train and evaluate their recipe on a dataset they can access, then submit the results.
  model: ['add', 'results', 'other'],
  other: GOALS,
};

/** The goals that fit at least one of `roles`, in the order of `GOALS`. */
export function goalsForRoles(roles: readonly Role[]): Goal[] {
  return GOALS.filter(goal => roles.some(role => ROLE_GOALS[role].includes(goal)));
}

/**
 * The kinds of data a dataset can contain or a model can use. The first three are what MEDS represents
 * (a `code` per event, with an optional `numeric_value` or `text_value`); the others are common extras.
 */
export const MODALITIES = [
  'coded',
  'measurements',
  'text',
  'imaging',
  'signals',
  'omics',
  'claims',
  'other',
] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = {
  coded: 'Diagnoses, procedures or medications',
  measurements: 'Lab results or vital signs',
  text: 'Clinical notes or other free text',
  imaging: 'Medical images',
  signals: 'Waveforms or other high-frequency signals',
  omics: 'Genomics or other omics',
  claims: 'Insurance claims',
  other: 'Other',
};

/** The kinds of data describe a dataset or the inputs of a model, so only these roles are asked for them. */
export const MODALITY_ROLES: readonly Role[] = ['dataset', 'model'];

/** Whether the form asks someone with `roles` which kinds of data are involved. */
export function asksForModalities(roles: readonly Role[]): boolean {
  return roles.some(role => MODALITY_ROLES.includes(role));
}

/** Maximum lengths of the free-text fields; they keep the pre-filled issue URL a sane length. */
export const FIELD_LIMITS = { name: 100, link: 300, message: 1000 } as const;

/** The form state: the lists are empty and the goal is '' until the user picks something. */
export interface CollaborationDraft {
  roles: Role[];
  name: string;
  link: string;
  goal: Goal | '';
  modalities: Modality[];
  message: string;
}

/**
 * A validated request, with surrounding whitespace trimmed from the free-text fields. `roles` is non-empty,
 * and `roles` and `modalities` are in the order of `ROLES` and `MODALITIES`. `modalities` is empty unless
 * `asksForModalities(roles)`.
 */
export interface CollaborationRequest {
  roles: Role[];
  name: string;
  link: string;
  goal: Goal;
  modalities: Modality[];
  message: string;
}

export type CollaborationErrors = Partial<Record<keyof CollaborationDraft, string>>;

export const EMPTY_DRAFT: CollaborationDraft = {
  roles: [],
  name: '',
  link: '',
  goal: '',
  modalities: [],
  message: '',
};

/** Keeps the options of `all` that are in `selected`, in the order of `all` and without duplicates. */
export function inOrder<T>(all: readonly T[], selected: readonly T[]): T[] {
  return all.filter(option => selected.includes(option));
}

/** Sets the roles of `draft`, clearing its goal if that no longer fits them. */
export function withRoles(draft: CollaborationDraft, roles: Role[]): CollaborationDraft {
  const goal = draft.goal && goalsForRoles(roles).includes(draft.goal) ? draft.goal : '';
  return { ...draft, roles, goal };
}

/** Whether `value` is an absolute http(s) URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Validates a draft; `request` is set only when there are no errors. */
export function validateDraft(draft: CollaborationDraft): {
  errors: CollaborationErrors;
  request: CollaborationRequest | null;
} {
  const roles = inOrder(ROLES, draft.roles);
  const name = draft.name.trim();
  const link = draft.link.trim();
  const errors: CollaborationErrors = {};
  if (roles.length === 0) errors.roles = 'Choose who you are (one or more).';
  if (!name) errors.name = 'Enter the name of your dataset, task or model.';
  if (link && !isHttpUrl(link)) errors.link = 'Enter a full web address starting with https:// or http://.';
  if (!draft.goal) errors.goal = 'Choose what you would like to do.';
  else if (!goalsForRoles(roles).includes(draft.goal))
    errors.goal = 'Choose an option that fits who you are.';

  if (!draft.goal || Object.keys(errors).length > 0) return { errors, request: null };
  return {
    errors,
    request: {
      roles,
      name,
      link,
      goal: draft.goal,
      // Answers to a question that is hidden for these roles are dropped.
      modalities: asksForModalities(roles) ? inOrder(MODALITIES, draft.modalities) : [],
      message: draft.message.trim(),
    },
  };
}
