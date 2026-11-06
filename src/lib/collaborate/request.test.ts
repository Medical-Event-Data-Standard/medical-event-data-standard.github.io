import { describe, expect, it } from '@jest/globals';

import {
  asksForModalities,
  CollaborationDraft,
  EMPTY_DRAFT,
  GOALS,
  goalsForRoles,
  inOrder,
  isHttpUrl,
  MODALITIES,
  MODALITY_LABELS,
  ROLE_GOALS,
  ROLES,
  validateDraft,
  withRoles,
} from './request';

const valid: CollaborationDraft = {
  roles: ['dataset'],
  name: '  MIMIC-IV  ',
  link: ' https://physionet.org/content/mimiciv/ ',
  goal: 'add',
  modalities: ['measurements', 'coded'],
  message: '\n Hello! \n',
};

describe('isHttpUrl', () => {
  it.each([
    'https://physionet.org/content/mimiciv/',
    'http://example.org',
    'https://arxiv.org/abs/2411.03730',
  ])('accepts %s', url => expect(isHttpUrl(url)).toBe(true));

  it.each(['physionet.org', 'not a url', 'ftp://example.org/file', 'javascript:alert(1)', ''])(
    'rejects %s',
    url => expect(isHttpUrl(url)).toBe(false)
  );
});

describe('ROLE_GOALS', () => {
  it('maps every role to the goals that fit it', () => {
    expect(ROLE_GOALS).toEqual({
      dataset: ['add', 'find-best-model', 'results', 'convert', 'other'],
      task: ['add', 'task-feedback', 'other'],
      model: ['add', 'results', 'other'],
      other: [...GOALS],
    });
  });

  it('offers every role adding its work and "Something else"', () => {
    for (const role of ROLES) expect(ROLE_GOALS[role]).toEqual(expect.arrayContaining(['add', 'other']));
  });
});

describe('goalsForRoles', () => {
  it('offers nothing before a role is chosen', () => {
    expect(goalsForRoles([])).toEqual([]);
  });

  it.each(ROLES)('offers a single %s owner exactly its own goals', role => {
    expect(goalsForRoles([role])).toEqual(ROLE_GOALS[role]);
  });

  it('offers the union of the goals of several roles, in the order of GOALS', () => {
    expect(goalsForRoles(['model', 'task'])).toEqual(['add', 'results', 'task-feedback', 'other']);
    expect(goalsForRoles(['dataset', 'model'])).toEqual(ROLE_GOALS.dataset);
    expect(goalsForRoles(['dataset', 'task', 'model'])).toEqual([...GOALS]);
    expect(goalsForRoles(['task', 'other'])).toEqual([...GOALS]);
  });
});

describe('asksForModalities', () => {
  it('asks dataset and model owners, alone or with other roles', () => {
    expect(asksForModalities(['dataset'])).toBe(true);
    expect(asksForModalities(['model'])).toBe(true);
    expect(asksForModalities(['task', 'model'])).toBe(true);
    expect(asksForModalities(['other', 'dataset'])).toBe(true);
  });

  it('does not ask task owners, "Other" or someone who has not chosen yet', () => {
    expect(asksForModalities([])).toBe(false);
    expect(asksForModalities(['task'])).toBe(false);
    expect(asksForModalities(['other'])).toBe(false);
    expect(asksForModalities(['task', 'other'])).toBe(false);
  });
});

describe('MODALITIES', () => {
  it('starts with what MEDS represents and keeps the list short', () => {
    expect(MODALITIES.slice(0, 3).map(modality => MODALITY_LABELS[modality])).toEqual([
      'Diagnoses, procedures or medications',
      'Lab results or vital signs',
      'Clinical notes or other free text',
    ]);
    expect(MODALITIES.length).toBeGreaterThanOrEqual(6);
    expect(MODALITIES.length).toBeLessThanOrEqual(9);
    expect(MODALITIES.at(-1)).toBe('other');
  });
});

describe('inOrder', () => {
  it('keeps the selected options in the order of the full list, once each', () => {
    expect(inOrder(ROLES, ['other', 'model', 'dataset', 'model'])).toEqual(['dataset', 'model', 'other']);
    expect(inOrder(ROLES, [])).toEqual([]);
  });
});

describe('withRoles', () => {
  it('keeps the goal while it still fits the roles', () => {
    expect(withRoles(valid, ['dataset', 'task'])).toEqual({ ...valid, roles: ['dataset', 'task'] });
    expect(withRoles({ ...valid, goal: 'results' }, ['model'])).toMatchObject({ goal: 'results' });
  });

  it('clears a goal that no longer fits the roles', () => {
    const draft: CollaborationDraft = { ...valid, roles: ['dataset', 'task'], goal: 'task-feedback' };
    expect(withRoles(draft, ['dataset'])).toEqual({ ...draft, roles: ['dataset'], goal: '' });
    expect(withRoles(valid, [])).toMatchObject({ roles: [], goal: '' });
  });

  it('keeps an empty goal empty', () => {
    expect(withRoles(EMPTY_DRAFT, ['task'])).toEqual({ ...EMPTY_DRAFT, roles: ['task'] });
  });
});

describe('validateDraft', () => {
  it('requires a role, a name and a goal, but not a link, kinds of data or a message', () => {
    expect(validateDraft(EMPTY_DRAFT)).toEqual({
      errors: {
        roles: 'Choose who you are (one or more).',
        name: 'Enter the name of your dataset, task or model.',
        goal: 'Choose what you would like to do.',
      },
      request: null,
    });
  });

  it('treats a whitespace-only name as missing', () => {
    expect(validateDraft({ ...valid, name: '   ' }).errors).toEqual({
      name: 'Enter the name of your dataset, task or model.',
    });
  });

  it('rejects a link that is not an http(s) URL', () => {
    const { errors, request } = validateDraft({ ...valid, link: 'physionet.org' });
    expect(errors).toEqual({ link: 'Enter a full web address starting with https:// or http://.' });
    expect(request).toBeNull();
  });

  it('returns a trimmed request, with the lists in a fixed order, when the draft is valid', () => {
    expect(validateDraft(valid)).toEqual({
      errors: {},
      request: {
        roles: ['dataset'],
        name: 'MIMIC-IV',
        link: 'https://physionet.org/content/mimiciv/',
        goal: 'add',
        modalities: ['coded', 'measurements'],
        message: 'Hello!',
      },
    });
  });

  it('accepts several roles and a goal that fits any one of them', () => {
    const { errors, request } = validateDraft({
      ...valid,
      roles: ['model', 'task', 'dataset'],
      goal: 'task-feedback',
    });
    expect(errors).toEqual({});
    expect(request).toMatchObject({ roles: ['dataset', 'task', 'model'], goal: 'task-feedback' });
  });

  it.each([
    [['task'], 'find-best-model'],
    [['task'], 'results'],
    [['model'], 'convert'],
    [['model', 'task'], 'find-best-model'],
    [['dataset'], 'task-feedback'],
    [[], 'add'],
  ] as const)('rejects a goal that does not fit the roles %j: %s', (roles, goal) => {
    const { errors, request } = validateDraft({ ...valid, roles: [...roles], goal });
    expect(errors.goal).toBe('Choose an option that fits who you are.');
    expect(request).toBeNull();
  });

  it('accepts an empty link, message and list of kinds of data', () => {
    expect(validateDraft({ ...valid, link: '', modalities: [], message: '' }).request).toMatchObject({
      link: '',
      modalities: [],
      message: '',
    });
  });

  it('keeps the kinds of data for model owners', () => {
    const draft: CollaborationDraft = { ...valid, roles: ['model'], modalities: ['other', 'text'] };
    expect(validateDraft(draft).request?.modalities).toEqual(['text', 'other']);
  });

  it('drops the kinds of data when the roles do not ask for them', () => {
    const draft: CollaborationDraft = { ...valid, roles: ['task', 'other'], modalities: [...MODALITIES] };
    expect(validateDraft(draft).request?.modalities).toEqual([]);
  });
});
