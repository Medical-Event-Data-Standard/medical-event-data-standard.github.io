/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import CollaborationRequestForm from './CollaborationRequestForm';
import { buildEmailText, buildIssueUrl, buildMailtoUrl } from '@site/src/lib/collaborate/buildIssueUrl';
import { navigateTo } from '@site/src/lib/collaborate/navigate';
import {
  COLLABORATION_EMAIL,
  CollaborationRequest,
  GOAL_LABELS,
  ROLE_GOALS,
} from '@site/src/lib/collaborate/request';

// jsdom cannot navigate to a mailto: URL, so record where the form sends the tab instead.
jest.mock('@site/src/lib/collaborate/navigate', () => ({ navigateTo: jest.fn() }));

const EMAIL = 'maintainers@example.org';
const SOURCE_URL = () => `${window.location.origin}${window.location.pathname}`;

const rolesGroup = () => screen.getByRole('group', { name: /I am a…/ });
const role = (name: string) => within(rolesGroup()).getByRole('checkbox', { name });
const nameField = () => screen.getByRole('textbox', { name: /Name of your dataset, task or model/ });
const linkField = () => screen.getByRole('textbox', { name: /Link/ });
const goalField = () => screen.getByRole('combobox', { name: /What would you like to do\?/ });
const goalOptions = () =>
  within(goalField())
    .getAllByRole('option')
    .map(option => option.textContent);
const dataGroup = () => screen.queryByRole('group', { name: 'What kinds of data are involved?' });
const dataKind = (name: string) => within(dataGroup()!).getByRole('checkbox', { name });
const messageField = () => screen.getByRole('textbox', { name: /Short message/ });

/** Clicks a button, then lets MUI's focus ripple, which mounts asynchronously, settle. */
async function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
  await act(async () => {});
}
const submit = () => click('Open request on GitHub');

function fillValidForm() {
  fireEvent.click(role('Model owner'));
  fireEvent.change(nameField(), { target: { value: ' MEDS-Tab ' } });
  fireEvent.change(linkField(), { target: { value: 'https://github.com/mmcdermott/MEDS_TAB_MIMIC_IV' } });
  fireEvent.change(goalField(), { target: { value: 'add' } });
  fireEvent.change(messageField(), { target: { value: 'We would like to add our model.' } });
}

/** The request that `fillValidForm` describes. */
const validRequest: CollaborationRequest = {
  roles: ['model'],
  name: 'MEDS-Tab',
  link: 'https://github.com/mmcdermott/MEDS_TAB_MIMIC_IV',
  goal: 'add',
  modalities: [],
  message: 'We would like to add our model.',
};

let open: jest.SpiedFunction<typeof window.open>;
beforeEach(() => {
  open = jest.spyOn(window, 'open').mockImplementation(() => null);
  jest.mocked(navigateTo).mockClear();
});
afterEach(() => open.mockRestore());

describe('the form', () => {
  it('renders labelled fields, with the required ones marked', () => {
    render(<CollaborationRequestForm email="" />);

    expect(rolesGroup().tagName).toBe('FIELDSET');
    expect(rolesGroup()).toHaveAccessibleDescription('Choose one or more.');
    expect(within(rolesGroup()).getByText('*')).toBeInTheDocument();
    expect(
      within(rolesGroup())
        .getAllByRole('checkbox')
        .map(checkbox => checkbox.closest('label')?.textContent)
    ).toEqual(['Dataset owner', 'Task owner', 'Model owner', 'Other']);
    expect(within(rolesGroup()).queryAllByRole('checkbox', { checked: true })).toHaveLength(0);
    expect(nameField()).toBeRequired();
    expect(nameField()).toHaveAttribute('maxlength', '100');
    expect(linkField()).not.toBeRequired();
    expect(linkField()).toHaveAttribute('type', 'url');
    expect(goalField()).toBeRequired();
    expect(goalField()).toHaveValue('');
    expect(dataGroup()).not.toBeInTheDocument();
    expect(messageField()).not.toBeRequired();
    expect(messageField()).toHaveAttribute('maxlength', '1000');
    expect(screen.getByText('Optional. 0/1000 characters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open request on GitHub' })).toHaveAccessibleDescription(
      /^Public\. This opens a pre-filled issue on the public MEDS-DEV GitHub repository.*You need a GitHub account/
    );
  });

  it('shows errors for missing required fields and focuses the first one', async () => {
    render(<CollaborationRequestForm />);
    expect(screen.queryByText('Choose who you are (one or more).')).not.toBeInTheDocument();

    await submit();

    expect(open).not.toHaveBeenCalled();
    expect(rolesGroup()).toHaveAccessibleDescription('Choose who you are (one or more).');
    for (const checkbox of within(rolesGroup()).getAllByRole('checkbox')) {
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    }
    expect(role('Dataset owner')).toHaveFocus();
    expect(nameField()).toHaveAccessibleDescription('Enter the name of your dataset, task or model.');
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    // The goal cannot be chosen yet, so it explains why instead of showing an error.
    expect(goalField()).toBeDisabled();
    expect(goalField()).toHaveAccessibleDescription('Choose who you are first.');
    expect(goalField()).not.toHaveAttribute('aria-invalid', 'true');

    // Errors update as the user fixes the fields.
    fireEvent.click(role('Task owner'));
    expect(rolesGroup()).toHaveAccessibleDescription('Choose one or more.');
    expect(role('Dataset owner')).toHaveAttribute('aria-invalid', 'false');
    expect(goalField()).toHaveAccessibleDescription('Choose what you would like to do.');
    expect(goalField()).toHaveAttribute('aria-invalid', 'true');
    await submit();
    expect(nameField()).toHaveFocus();
    fireEvent.change(nameField(), { target: { value: 'mortality/in_icu/first_24h' } });
    await submit();
    expect(goalField()).toHaveFocus();
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects a link that is not a web address', async () => {
    render(<CollaborationRequestForm />);
    fillValidForm();
    fireEvent.change(linkField(), { target: { value: 'github.com/mmcdermott' } });

    await submit();

    expect(open).not.toHaveBeenCalled();
    expect(linkField()).toHaveFocus();
    expect(linkField()).toHaveAccessibleDescription(
      'Enter a full web address starting with https:// or http://.'
    );
  });
});

describe('the goal options', () => {
  it('are disabled until a role is chosen', () => {
    render(<CollaborationRequestForm />);
    expect(goalField()).toBeDisabled();
    expect(goalField()).toHaveAccessibleDescription('Choose who you are first.');
    expect(goalOptions()).toEqual(['Choose an option']);

    fireEvent.click(role('Task owner'));
    expect(goalField()).toBeEnabled();
    expect(goalField()).not.toHaveAccessibleDescription();

    fireEvent.click(role('Task owner'));
    expect(goalField()).toBeDisabled();
  });

  it('offer the goals that fit any of the selected roles', () => {
    render(<CollaborationRequestForm />);
    const labels = (...goals: (keyof typeof GOAL_LABELS)[]) => [
      'Choose an option',
      ...goals.map(g => GOAL_LABELS[g]),
    ];

    fireEvent.click(role('Task owner'));
    expect(goalOptions()).toEqual(labels(...ROLE_GOALS.task));
    fireEvent.click(role('Model owner'));
    expect(goalOptions()).toEqual(labels('add', 'results', 'task-feedback', 'other'));
    fireEvent.click(role('Dataset owner'));
    expect(goalOptions()).toEqual(
      labels('add', 'find-best-model', 'results', 'convert', 'task-feedback', 'other')
    );
    fireEvent.click(role('Task owner'));
    fireEvent.click(role('Model owner'));
    expect(goalOptions()).toEqual(labels(...ROLE_GOALS.dataset));
    fireEvent.click(role('Dataset owner'));
    fireEvent.click(role('Other'));
    expect(goalOptions()).toEqual(labels(...ROLE_GOALS.other));
  });

  it('keep a chosen goal that still fits after a role is unticked', () => {
    render(<CollaborationRequestForm />);
    fireEvent.click(role('Dataset owner'));
    fireEvent.click(role('Model owner'));
    fireEvent.change(goalField(), { target: { value: 'results' } });

    fireEvent.click(role('Dataset owner'));

    expect(goalField()).toHaveValue('results');
    expect(goalField()).not.toHaveAccessibleDescription();
  });

  it('clear a chosen goal that no longer fits, so it cannot be sent', async () => {
    render(<CollaborationRequestForm />);
    fireEvent.click(role('Dataset owner'));
    fireEvent.click(role('Task owner'));
    fireEvent.change(nameField(), { target: { value: 'MIMIC-IV' } });
    fireEvent.change(goalField(), { target: { value: 'task-feedback' } });
    expect(goalField()).toHaveValue('task-feedback');

    fireEvent.click(role('Task owner'));

    expect(goalField()).toHaveValue('');
    expect(goalOptions()).not.toContain(GOAL_LABELS['task-feedback']);
    expect(goalField()).toHaveAccessibleDescription(
      'Your earlier choice does not fit who you are, so choose again.'
    );
    await submit();
    expect(open).not.toHaveBeenCalled();
    expect(goalField()).toHaveFocus();
    expect(goalField()).toHaveAccessibleDescription('Choose what you would like to do.');

    // Choosing again removes the note, and unticking the last role clears and disables the goal.
    fireEvent.change(goalField(), { target: { value: 'convert' } });
    expect(goalField()).not.toHaveAccessibleDescription();
    fireEvent.click(role('Dataset owner'));
    expect(goalField()).toHaveValue('');
    expect(goalField()).toBeDisabled();
    expect(goalField()).toHaveAccessibleDescription('Choose who you are first.');
  });
});

describe('the kinds of data', () => {
  it('are asked only of dataset and model owners, and keep their answers while hidden', () => {
    render(<CollaborationRequestForm />);
    fireEvent.click(role('Task owner'));
    fireEvent.click(role('Other'));
    expect(dataGroup()).not.toBeInTheDocument();

    fireEvent.click(role('Model owner'));
    expect(dataGroup()).toBeInTheDocument();
    expect(dataGroup()).toHaveAccessibleDescription(/^Optional\./);
    expect(
      within(dataGroup()!)
        .getAllByRole('checkbox')
        .map(checkbox => checkbox.closest('label')?.textContent)
    ).toEqual([
      'Diagnoses, procedures or medications',
      'Lab results or vital signs',
      'Clinical notes or other free text',
      'Medical images',
      'Waveforms or other high-frequency signals',
      'Genomics or other omics',
      'Insurance claims',
      'Other',
    ]);
    fireEvent.click(dataKind('Clinical notes or other free text'));
    fireEvent.click(dataKind('Medical images'));
    fireEvent.click(dataKind('Medical images'));
    expect(within(dataGroup()!).getAllByRole('checkbox', { checked: true })).toHaveLength(1);

    fireEvent.click(role('Model owner'));
    expect(dataGroup()).not.toBeInTheDocument();
    fireEvent.click(role('Dataset owner'));
    expect(dataKind('Clinical notes or other free text')).toBeChecked();
  });

  it('are left out of the request when the roles do not ask for them', async () => {
    render(<CollaborationRequestForm />);
    fillValidForm();
    fireEvent.click(dataKind('Lab results or vital signs'));
    fireEvent.click(role('Task owner'));
    fireEvent.click(role('Model owner'));

    await submit();

    expect(open).toHaveBeenCalledWith(
      buildIssueUrl({ ...validRequest, roles: ['task'] }, { sourceUrl: SOURCE_URL() }),
      '_blank',
      'noopener,noreferrer'
    );
    expect(decodeURIComponent(open.mock.calls[0][0] as string)).not.toContain('Kinds of data');
  });
});

describe('opening a GitHub issue', () => {
  it('opens the pre-filled issue in a new tab and offers a fallback link', async () => {
    render(<CollaborationRequestForm />);
    fillValidForm();
    fireEvent.click(role('Dataset owner'));
    fireEvent.click(dataKind('Lab results or vital signs'));
    fireEvent.click(dataKind('Diagnoses, procedures or medications'));
    expect(screen.getByText('Optional. 31/1000 characters.')).toBeInTheDocument();

    await submit();

    const expected = buildIssueUrl(
      { ...validRequest, roles: ['dataset', 'model'], modalities: ['coded', 'measurements'] },
      { sourceUrl: SOURCE_URL() }
    );
    expect(expected).toMatch(
      /^https:\/\/github\.com\/Medical-Event-Data-Standard\/MEDS-DEV\/issues\/new\?title=%5BCollaboration%5D%20Dataset%20%26%20Model%3A%20MEDS-Tab&body=/
    );
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
    expect(navigateTo).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Your request opened in a new tab');
    expect(screen.getByRole('link', { name: 'open the pre-filled issue' })).toHaveAttribute('href', expected);

    // Editing the form hides the now out-of-date link.
    fireEvent.change(messageField(), { target: { value: 'Changed my mind.' } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('sending by email', () => {
  it('is offered only when an address is set', () => {
    const { unmount } = render(<CollaborationRequestForm email="" />);
    expect(screen.getByRole('button', { name: 'Open request on GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send by email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy request' })).not.toBeInTheDocument();
    unmount();

    // By default the form uses COLLABORATION_EMAIL, which stays empty until the maintainers set it.
    render(<CollaborationRequestForm />);
    expect(Boolean(screen.queryByRole('button', { name: 'Send by email' }))).toBe(
      Boolean(COLLABORATION_EMAIL)
    );
  });

  it('explains how the private email differs from the public issue', () => {
    render(<CollaborationRequestForm email={EMAIL} />);
    expect(screen.getByRole('button', { name: 'Open request on GitHub' })).toHaveAccessibleDescription(
      /^Public\./
    );
    expect(screen.getByRole('button', { name: 'Send by email' })).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Send by email' })).toHaveAccessibleDescription(
      /^Private\. This opens a pre-filled email to the MEDS-DEV maintainers in your mail app.*Only the maintainers receive it/
    );
    expect(screen.getByRole('button', { name: 'Copy request' })).toHaveAccessibleDescription(
      `No mail app? Copy the request and paste it into an email to ${EMAIL}.`
    );
  });

  it('validates the form first', async () => {
    render(<CollaborationRequestForm email={EMAIL} />);
    await click('Send by email');

    expect(navigateTo).not.toHaveBeenCalled();
    expect(role('Dataset owner')).toHaveFocus();
    expect(rolesGroup()).toHaveAccessibleDescription('Choose who you are (one or more).');
  });

  it('opens the pre-filled email in the mail app', async () => {
    render(<CollaborationRequestForm email={EMAIL} />);
    fillValidForm();
    fireEvent.click(dataKind('Waveforms or other high-frequency signals'));

    await click('Send by email');

    const expected = buildMailtoUrl(
      { ...validRequest, modalities: ['signals'] },
      { to: EMAIL, sourceUrl: SOURCE_URL() }
    );
    expect(expected).toMatch(
      /^mailto:maintainers@example\.org\?subject=%5BMEDS-DEV%20collaboration%5D%20Model%3A%20MEDS-Tab&body=Roles%3A%0D%0AModel%20owner%0D%0A/
    );
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith(expected);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      `Your request should now be open in your mail app: send it from there. If nothing opened, use “Copy request” and paste it into an email to ${EMAIL}.`
    );
  });
});

describe('copying the request', () => {
  const writeText = jest.fn<Promise<void>, [string]>();
  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  it('validates the form first', async () => {
    render(<CollaborationRequestForm email={EMAIL} />);
    fireEvent.click(role('Other'));
    await click('Copy request');

    expect(writeText).not.toHaveBeenCalled();
    expect(nameField()).toHaveFocus();
  });

  it('copies the address and the full request, and confirms it', async () => {
    writeText.mockResolvedValue(undefined);
    render(<CollaborationRequestForm email={EMAIL} />);
    fillValidForm();

    await click('Copy request');

    expect(writeText).toHaveBeenCalledWith(
      buildEmailText(validRequest, { to: EMAIL, sourceUrl: SOURCE_URL() })
    );
    expect(writeText.mock.calls[0][0]).toMatch(
      /^To: maintainers@example\.org\nSubject: \[MEDS-DEV collaboration\] Model: MEDS-Tab\n\nRoles:\nModel owner\n/
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Copied\. Paste the request into a new email to maintainers@example\.org/
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it.each([
    ['refuses', () => writeText.mockRejectedValue(new Error('Write permission denied.'))],
    ['is missing', () => delete (navigator as { clipboard?: unknown }).clipboard],
  ])('shows the request to copy by hand when the clipboard %s', async (_, breakClipboard) => {
    breakClipboard();
    render(<CollaborationRequestForm email={EMAIL} />);
    fillValidForm();

    await click('Copy request');

    expect(screen.getByRole('status')).toHaveTextContent(
      /did not let the page copy the request\. Select the text below, copy it, and paste it into a new email to maintainers@example\.org\./
    );
    const text = screen.getByRole('textbox', { name: 'Your request' });
    expect(text).toHaveValue(buildEmailText(validRequest, { to: EMAIL, sourceUrl: SOURCE_URL() }));
    expect(text).toHaveAttribute('readonly');
  });
});
