/** The options and validation rules of the MEDS-DEV collaboration request form. */

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

/** Maximum lengths of the free-text fields; they keep the pre-filled issue URL a sane length. */
export const FIELD_LIMITS = { name: 100, link: 300, message: 1000 } as const;

/** The form state: role and goal are empty until the user picks one. */
export interface CollaborationDraft {
  role: Role | '';
  name: string;
  link: string;
  goal: Goal | '';
  message: string;
}

/** A validated request, with surrounding whitespace trimmed from the free-text fields. */
export interface CollaborationRequest {
  role: Role;
  name: string;
  link: string;
  goal: Goal;
  message: string;
}

export type CollaborationErrors = Partial<Record<keyof CollaborationDraft, string>>;

export const EMPTY_DRAFT: CollaborationDraft = { role: '', name: '', link: '', goal: '', message: '' };

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
  const name = draft.name.trim();
  const link = draft.link.trim();
  const errors: CollaborationErrors = {};
  if (!draft.role) errors.role = 'Choose who you are.';
  if (!name) errors.name = 'Enter the name of your dataset, task or model.';
  if (link && !isHttpUrl(link)) errors.link = 'Enter a full web address starting with https:// or http://.';
  if (!draft.goal) errors.goal = 'Choose what you would like to do.';

  if (!draft.role || !draft.goal || Object.keys(errors).length > 0) return { errors, request: null };
  return {
    errors,
    request: { role: draft.role, name, link, goal: draft.goal, message: draft.message.trim() },
  };
}
