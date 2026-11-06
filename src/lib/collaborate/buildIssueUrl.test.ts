import { describe, expect, it } from '@jest/globals';

import {
  buildIssueBody,
  buildIssueTitle,
  buildIssueUrl,
  MAX_ISSUE_URL_LENGTH,
  MEDS_DEV_NEW_ISSUE_URL,
  truncate,
} from './buildIssueUrl';
import { CollaborationRequest, FIELD_LIMITS } from './request';

const request: CollaborationRequest = {
  role: 'dataset',
  name: 'MIMIC-IV',
  link: 'https://physionet.org/content/mimiciv/',
  goal: 'add',
  message: 'We would like to add our dataset & its predicates.\n\nThanks!',
};

/** Decodes the title and body query parameters of an issue URL. */
function parse(url: string): { base: string; title: string | null; body: string | null; keys: string[] } {
  const parsed = new URL(url);
  return {
    base: `${parsed.origin}${parsed.pathname}`,
    title: parsed.searchParams.get('title'),
    body: parsed.searchParams.get('body'),
    keys: [...parsed.searchParams.keys()],
  };
}

describe('truncate', () => {
  it('leaves text within the limit unchanged', () => {
    expect(truncate('abc', 3)).toBe('abc');
  });

  it('cuts longer text and ends it with an ellipsis, within the limit', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
  });

  it('counts code points, so it never splits an emoji', () => {
    expect(truncate('😀😀😀', 3)).toBe('😀😀😀');
    expect(truncate('😀😀😀', 2)).toBe('😀…');
  });
});

describe('buildIssueTitle', () => {
  it('prefixes the entity type for dataset, task and model owners', () => {
    expect(buildIssueTitle(request)).toBe('[Collaboration] Dataset: MIMIC-IV');
    expect(buildIssueTitle({ ...request, role: 'task', name: 'mortality/in_icu/first_24h' })).toBe(
      '[Collaboration] Task: mortality/in_icu/first_24h'
    );
    expect(buildIssueTitle({ ...request, role: 'model', name: 'MEDS-Tab' })).toBe(
      '[Collaboration] Model: MEDS-Tab'
    );
  });

  it('has no prefix for other roles, and keeps the name on one capped line', () => {
    expect(buildIssueTitle({ ...request, role: 'other', name: ' My\n  tool ' })).toBe(
      '[Collaboration] My tool'
    );
    const title = buildIssueTitle({ ...request, role: 'other', name: 'x'.repeat(500) });
    expect(title).toBe(`[Collaboration] ${'x'.repeat(FIELD_LIMITS.name - 1)}…`);
  });
});

describe('buildIssueBody', () => {
  it('formats the answers as issue-form style sections', () => {
    expect(buildIssueBody(request)).toBe(
      [
        '### Role',
        'Dataset owner',
        '### Name',
        'MIMIC-IV',
        '### Link',
        'https://physionet.org/content/mimiciv/',
        '### What I would like to do',
        'Add my dataset, task or model to MEDS-DEV',
        '### Message',
        'We would like to add our dataset & its predicates.\n\nThanks!',
      ].join('\n\n')
    );
  });

  it('marks optional answers that were left empty', () => {
    const body = buildIssueBody({ ...request, role: 'model', goal: 'other', link: ' ', message: '\n' });
    expect(body).toContain('### Role\n\nModel owner');
    expect(body).toContain('### Link\n\n_No response_');
    expect(body).toContain('### What I would like to do\n\nSomething else');
    expect(body).toContain('### Message\n\n_No response_');
  });

  it('caps the message and link', () => {
    const body = buildIssueBody({
      ...request,
      link: `https://x.org/${'a'.repeat(400)}`,
      message: 'm'.repeat(2000),
    });
    expect(body).toContain(`### Message\n\n${'m'.repeat(FIELD_LIMITS.message - 1)}…`);
    expect(body).toContain(`### Link\n\nhttps://x.org/${'a'.repeat(FIELD_LIMITS.link - 15)}…\n`);
  });

  it('links back to the form when a source URL is given', () => {
    const body = buildIssueBody(
      request,
      'https://medical-event-data-standard.github.io/docs/MEDS-DEV/collaborate'
    );
    expect(
      body.endsWith(
        '\n\n---\n\nSent with the [collaboration request form](https://medical-event-data-standard.github.io/docs/MEDS-DEV/collaborate).'
      )
    ).toBe(true);
  });
});

describe('buildIssueUrl', () => {
  it('pre-fills only the title and body of a new MEDS-DEV issue', () => {
    const url = buildIssueUrl(request, { sourceUrl: 'https://example.org/collaborate' });
    expect(parse(url)).toEqual({
      base: MEDS_DEV_NEW_ISSUE_URL,
      title: buildIssueTitle(request),
      body: buildIssueBody(request, 'https://example.org/collaborate'),
      keys: ['title', 'body'],
    });
  });

  it('percent-encodes reserved characters', () => {
    const url = buildIssueUrl({ ...request, name: 'A&B #1 + C?' });
    expect(url).toContain('title=%5BCollaboration%5D%20Dataset%3A%20A%26B%20%231%20%2B%20C%3F&body=');
    expect(url).not.toMatch(/[ \n#]/);
    expect(parse(url).title).toBe('[Collaboration] Dataset: A&B #1 + C?');
  });

  it('caps a long ASCII message at the field limit', () => {
    const url = buildIssueUrl({ ...request, message: 'a'.repeat(5000) });
    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    expect(parse(url).body).toContain(`### Message\n\n${'a'.repeat(FIELD_LIMITS.message - 1)}…`);
  });

  it('shortens a message whose encoding would make the URL too long', () => {
    // Each emoji is 12 characters once percent-encoded, so 1000 of them would need about 12,000.
    const url = buildIssueUrl({ ...request, message: '😀'.repeat(FIELD_LIMITS.message) });
    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    expect(url.length).toBeGreaterThan(MAX_ISSUE_URL_LENGTH - 12);
    const message = parse(url).body!.split('### Message\n\n')[1];
    expect(message).toMatch(/^(😀)+…$/u);
  });

  it('respects a custom maximum length', () => {
    const url = buildIssueUrl(request, { maxLength: 450 });
    expect(url.length).toBeLessThanOrEqual(450);
    expect(parse(url).body).toMatch(/### Message\n\n.+…$/);
  });

  it('keeps the URL as is when there is no message left to shorten', () => {
    const url = buildIssueUrl({ ...request, message: '' }, { maxLength: 10 });
    expect(parse(url).body).toContain('### Message\n\n_No response_');
  });
});
