import { describe, expect, it } from '@jest/globals';

import { CollaborationDraft, EMPTY_DRAFT, isHttpUrl, validateDraft } from './request';

const valid: CollaborationDraft = {
  role: 'dataset',
  name: '  MIMIC-IV  ',
  link: ' https://physionet.org/content/mimiciv/ ',
  goal: 'add',
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

describe('validateDraft', () => {
  it('requires a role, a name and a goal, but not a link or message', () => {
    expect(validateDraft(EMPTY_DRAFT)).toEqual({
      errors: {
        role: 'Choose who you are.',
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

  it('returns a trimmed request when the draft is valid', () => {
    expect(validateDraft(valid)).toEqual({
      errors: {},
      request: {
        role: 'dataset',
        name: 'MIMIC-IV',
        link: 'https://physionet.org/content/mimiciv/',
        goal: 'add',
        message: 'Hello!',
      },
    });
  });

  it('accepts an empty link and message', () => {
    expect(validateDraft({ ...valid, link: '', message: '' }).request).toMatchObject({
      link: '',
      message: '',
    });
  });
});
