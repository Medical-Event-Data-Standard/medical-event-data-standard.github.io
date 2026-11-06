import { describe, expect, it } from '@jest/globals';

import {
  buildEmailText,
  buildIssueBody,
  buildIssueTitle,
  buildIssueUrl,
  buildMailBody,
  buildMailSubject,
  buildMailtoUrl,
  MAX_ISSUE_URL_LENGTH,
  MAX_MAILTO_URL_LENGTH,
  MEDS_DEV_NEW_ISSUE_URL,
  truncate,
} from './buildIssueUrl';
import { CollaborationRequest, FIELD_LIMITS, GOAL_LABELS, GOALS, MODALITIES, ROLES } from './request';

const request: CollaborationRequest = {
  roles: ['dataset'],
  name: 'MIMIC-IV',
  link: 'https://physionet.org/content/mimiciv/',
  goal: 'add',
  modalities: ['coded', 'measurements'],
  message: 'We would like to add our dataset & its predicates.\n\nThanks!',
};

const SOURCE_URL = 'https://medical-event-data-standard.github.io/docs/MEDS-DEV/collaborate';
const TO = 'maintainers@example.org';

/** The largest request the form allows: every role and kind of data, and every free-text field full. */
function worstCase(char: string): CollaborationRequest {
  return {
    roles: [...ROLES],
    name: char.repeat(FIELD_LIMITS.name),
    link: `https://example.org/${char.repeat(FIELD_LIMITS.link - 20)}`,
    goal: 'find-best-model',
    modalities: [...MODALITIES],
    message: char.repeat(FIELD_LIMITS.message),
  };
}

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

/** Splits a mailto: URL into its address and its percent-decoded subject and body. */
function parseMailto(url: string): { to: string; subject: string; body: string; keys: string[] } {
  const [address, query] = url.split('?');
  const params = query.split('&').map(param => param.split('='));
  const get = (key: string) => decodeURIComponent(params.find(([name]) => name === key)![1]);
  return {
    to: address.replace(/^mailto:/, ''),
    subject: get('subject'),
    body: get('body'),
    keys: params.map(([name]) => name),
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
  it('prefixes the entity type for a dataset, task or model owner', () => {
    expect(buildIssueTitle(request)).toBe('[Collaboration] Dataset: MIMIC-IV');
    expect(buildIssueTitle({ ...request, roles: ['task'], name: 'mortality/in_icu/first_24h' })).toBe(
      '[Collaboration] Task: mortality/in_icu/first_24h'
    );
    expect(buildIssueTitle({ ...request, roles: ['model'], name: 'MEDS-Tab' })).toBe(
      '[Collaboration] Model: MEDS-Tab'
    );
  });

  it('names every selected entity type, in a fixed order', () => {
    expect(buildIssueTitle({ ...request, roles: ['model', 'dataset'] })).toBe(
      '[Collaboration] Dataset & Model: MIMIC-IV'
    );
    expect(buildIssueTitle({ ...request, roles: ['model', 'other', 'task', 'dataset'] })).toBe(
      '[Collaboration] Dataset, Task & Model: MIMIC-IV'
    );
    expect(buildIssueTitle({ ...request, roles: ['other', 'task'] })).toBe('[Collaboration] Task: MIMIC-IV');
  });

  it('has no prefix for "Other" alone, and keeps the name on one capped line', () => {
    expect(buildIssueTitle({ ...request, roles: ['other'], name: ' My\n  tool ' })).toBe(
      '[Collaboration] My tool'
    );
    const title = buildIssueTitle({ ...request, roles: ['other'], name: 'x'.repeat(500) });
    expect(title).toBe(`[Collaboration] ${'x'.repeat(FIELD_LIMITS.name - 1)}…`);
  });
});

describe('buildIssueBody', () => {
  it('formats the answers as issue-form style sections', () => {
    expect(buildIssueBody(request)).toBe(
      [
        '### Roles',
        'Dataset owner',
        '### Name',
        'MIMIC-IV',
        '### Link',
        'https://physionet.org/content/mimiciv/',
        '### What I would like to do',
        'Add my dataset, task or model to MEDS-DEV',
        '### Kinds of data',
        '- Diagnoses, procedures or medications\n- Lab results or vital signs',
        '### Message',
        'We would like to add our dataset & its predicates.\n\nThanks!',
      ].join('\n\n')
    );
  });

  it('lists several roles and kinds of data in a fixed order', () => {
    const body = buildIssueBody({
      ...request,
      roles: ['model', 'dataset'],
      modalities: ['other', 'text', 'imaging'],
    });
    expect(body).toContain('### Roles\n\nDataset owner, Model owner\n\n');
    expect(body).toContain(
      '### Kinds of data\n\n- Clinical notes or other free text\n- Medical images\n- Other\n\n'
    );
  });

  it('marks the kinds of data as unanswered when a dataset or model owner ticked none', () => {
    const body = buildIssueBody({ ...request, roles: ['model'], modalities: [] });
    expect(body).toContain('### Kinds of data\n\n_No response_\n\n### Message');
  });

  it('leaves out the kinds of data for roles that are not asked about them', () => {
    const body = buildIssueBody({
      ...request,
      roles: ['task', 'other'],
      goal: 'task-feedback',
      modalities: [],
    });
    expect(body).toContain('### Roles\n\nTask owner, Other\n\n');
    expect(body).not.toContain('Kinds of data');
    expect(body).toContain('### What I would like to do\n\nGet feedback on a task definition\n\n### Message');
  });

  it('includes the full wording of every goal, e.g. benchmarking to find the best model', () => {
    for (const goal of GOALS) {
      expect(buildIssueBody({ ...request, goal })).toContain(
        `### What I would like to do\n\n${GOAL_LABELS[goal]}`
      );
    }
    expect(buildIssueBody({ ...request, goal: 'find-best-model' })).toContain(
      'Benchmark my data using MEDS-DEV to find the best model for my use case'
    );
  });

  it('marks optional answers that were left empty', () => {
    const body = buildIssueBody({ ...request, roles: ['model'], goal: 'other', link: ' ', message: '\n' });
    expect(body).toContain('### Roles\n\nModel owner');
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
    expect(buildIssueBody(request, SOURCE_URL)).toMatch(
      /\n\n---\n\nSent with the \[collaboration request form\]\(https:\/\/medical-event-data-standard\.github\.io\/docs\/MEDS-DEV\/collaborate\)\.$/
    );
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

  it('fits the largest ASCII request, with every role and kind of data, without shortening the message', () => {
    const url = buildIssueUrl(worstCase('a'), { sourceUrl: SOURCE_URL });
    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    const { title, body } = parse(url);
    expect(title).toBe(`[Collaboration] Dataset, Task & Model: ${'a'.repeat(FIELD_LIMITS.name)}`);
    expect(body).toContain(`### Kinds of data\n\n- Diagnoses, procedures or medications\n`);
    expect(body).toContain(`### Message\n\n${'a'.repeat(FIELD_LIMITS.message)}\n\n---`);
  });

  it('fits the largest non-ASCII request by shortening the message, then the link', () => {
    // Even with the message cut to an ellipsis, a 4-byte name and link would need about 6,750 characters.
    const url = buildIssueUrl(worstCase('😀'), { sourceUrl: SOURCE_URL });
    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    const { title, body } = parse(url);
    expect(title).toBe(`[Collaboration] Dataset, Task & Model: ${'😀'.repeat(FIELD_LIMITS.name)}`);
    expect(body).toContain('### Message\n\n…\n\n---');
    expect(body).toMatch(/### Link\n\nhttps:\/\/example\.org\/(😀)+…\n/u);
  });

  it('respects a custom maximum length', () => {
    const maxLength = buildIssueUrl(request).length - 30;
    const url = buildIssueUrl(request, { maxLength });
    expect(url.length).toBeLessThanOrEqual(maxLength);
    expect(parse(url).body).toMatch(/### Message\n\n.+…$/);
    expect(parse(url).body).toContain('### Link\n\nhttps://physionet.org/content/mimiciv/\n');
  });

  it('shortens every free-text field to an ellipsis when nothing else fits', () => {
    const { title, body } = parse(buildIssueUrl(request, { maxLength: 10 }));
    expect(title).toBe('[Collaboration] Dataset: …');
    expect(body).toContain('### Name\n\n…\n\n### Link\n\n…\n\n');
    expect(body).toContain('### Message\n\n…');
  });

  it('skips empty fields when shortening', () => {
    const { body } = parse(buildIssueUrl({ ...request, link: '', message: '' }, { maxLength: 10 }));
    expect(body).toContain('### Name\n\n…\n\n### Link\n\n_No response_\n\n');
    expect(body).toContain('### Message\n\n_No response_');
  });
});

describe('buildMailSubject', () => {
  it('matches the issue title, with a tag that names MEDS-DEV', () => {
    expect(buildMailSubject({ ...request, roles: ['dataset', 'model'] })).toBe(
      '[MEDS-DEV collaboration] Dataset & Model: MIMIC-IV'
    );
    expect(buildMailSubject({ ...request, roles: ['other'] })).toBe('[MEDS-DEV collaboration] MIMIC-IV');
  });
});

describe('buildMailBody', () => {
  it('has the same sections as the issue, as plain text', () => {
    expect(buildMailBody(request)).toBe(
      [
        'Roles:\nDataset owner',
        'Name:\nMIMIC-IV',
        'Link:\nhttps://physionet.org/content/mimiciv/',
        'What I would like to do:\nAdd my dataset, task or model to MEDS-DEV',
        'Kinds of data:\n- Diagnoses, procedures or medications\n- Lab results or vital signs',
        'Message:\nWe would like to add our dataset & its predicates.\n\nThanks!',
      ].join('\n\n')
    );
  });

  it('marks empty answers, leaves out unasked questions and links back to the form', () => {
    const body = buildMailBody({ ...request, roles: ['task'], link: '', message: '' }, SOURCE_URL);
    expect(body).toContain('Link:\nNo response\n\n');
    expect(body).not.toContain('Kinds of data');
    expect(body).not.toContain('###');
    expect(
      body.endsWith(`Message:\nNo response\n\n---\nSent with the collaboration request form: ${SOURCE_URL}`)
    ).toBe(true);
  });
});

describe('buildEmailText', () => {
  it('puts the address and subject above the full body, for pasting into any mail app', () => {
    const text = buildEmailText(
      { ...request, message: 'm'.repeat(FIELD_LIMITS.message) },
      { to: TO, sourceUrl: SOURCE_URL }
    );
    expect(text).toBe(
      `To: ${TO}\nSubject: [MEDS-DEV collaboration] Dataset: MIMIC-IV\n\n${buildMailBody(
        { ...request, message: 'm'.repeat(FIELD_LIMITS.message) },
        SOURCE_URL
      )}`
    );
    // Unlike the mailto: URL, the copied text is not shortened to fit a length limit.
    expect(text).toContain(`Message:\n${'m'.repeat(FIELD_LIMITS.message)}\n`);
  });
});

describe('buildMailtoUrl', () => {
  it('pre-fills the subject and body of an email to the given address', () => {
    const url = buildMailtoUrl(request, { to: TO, sourceUrl: SOURCE_URL });
    expect(url.startsWith(`mailto:${TO}?subject=`)).toBe(true);
    expect(parseMailto(url)).toEqual({
      to: TO,
      subject: buildMailSubject(request),
      body: buildMailBody(request, SOURCE_URL).replace(/\n/g, '\r\n'),
      keys: ['subject', 'body'],
    });
  });

  it('encodes spaces as %20 and line breaks as %0D%0A', () => {
    const url = buildMailtoUrl({ ...request, message: 'one two\nthree\r\nfour\rfive' }, { to: TO });
    expect(url).toContain(
      'subject=%5BMEDS-DEV%20collaboration%5D%20Dataset%3A%20MIMIC-IV&body=Roles%3A%0D%0ADataset%20owner%0D%0A%0D%0AName'
    );
    expect(url).toContain('Message%3A%0D%0Aone%20two%0D%0Athree%0D%0Afour%0D%0Afive');
    expect(url).not.toMatch(/[ +\n\r]/);
    expect(url.match(/%0A/g)!.length).toBe(url.match(/%0D%0A/g)!.length);
  });

  it('percent-encodes reserved characters in the subject and body', () => {
    const { subject, body } = parseMailto(buildMailtoUrl({ ...request, name: 'A&B #1 + C?=' }, { to: TO }));
    expect(subject).toBe('[MEDS-DEV collaboration] Dataset: A&B #1 + C?=');
    expect(body).toContain('Name:\r\nA&B #1 + C?=\r\n');
  });

  it('shortens the message so the URL stays within what mail clients accept', () => {
    // Each space takes three characters once encoded, so this 1,000-character message needs about 1,400.
    const message = 'Hello there. '.repeat(100).slice(0, FIELD_LIMITS.message);
    const url = buildMailtoUrl({ ...request, message }, { to: TO, sourceUrl: SOURCE_URL });
    expect(url.length).toBeLessThanOrEqual(MAX_MAILTO_URL_LENGTH);
    expect(url.length).toBeGreaterThan(MAX_MAILTO_URL_LENGTH - 3);
    const { body } = parseMailto(url);
    expect(body).toMatch(
      /Message:\r\n(Hello there\. )+[^\r\n]*…\r\n\r\n---\r\nSent with the collaboration request form: /
    );
    expect(body).toContain('Link:\r\nhttps://physionet.org/content/mimiciv/\r\n');
  });

  it('keeps a short request whole', () => {
    const url = buildMailtoUrl(request, { to: TO });
    expect(url.length).toBeLessThan(MAX_MAILTO_URL_LENGTH);
    expect(parseMailto(url).body).toContain(
      'Message:\r\nWe would like to add our dataset & its predicates.\r\n\r\nThanks!'
    );
  });

  it.each(['a', 'é', '😀'])(
    'fits the largest request within the limit, with every field made of %s',
    char => {
      const url = buildMailtoUrl(worstCase(char), { to: TO, sourceUrl: SOURCE_URL });
      expect(url.length).toBeLessThanOrEqual(MAX_MAILTO_URL_LENGTH);
      const { subject, body } = parseMailto(url);
      expect(subject.startsWith('[MEDS-DEV collaboration] Dataset, Task & Model: ')).toBe(true);
      expect(body).toContain('Roles:\r\nDataset owner, Task owner, Model owner, Other\r\n');
      expect(body).toContain('Kinds of data:\r\n- Diagnoses, procedures or medications\r\n');
      expect(body).toContain('- Other\r\n\r\nMessage:\r\n');
      expect(body).toContain(`Sent with the collaboration request form: ${SOURCE_URL}`);
    }
  );

  it('respects a custom maximum length', () => {
    const maxLength = buildMailtoUrl(request, { to: TO }).length - 30;
    const url = buildMailtoUrl(request, { to: TO, maxLength });
    expect(url.length).toBeLessThanOrEqual(maxLength);
    expect(parseMailto(url).body).toMatch(/Message:\r\n.*…$/);
  });
});
