/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import CollaborationRequestForm from './CollaborationRequestForm';
import { buildIssueUrl } from '@site/src/lib/collaborate/buildIssueUrl';

const nameField = () => screen.getByRole('textbox', { name: /Name of your dataset, task or model/ });
const linkField = () => screen.getByRole('textbox', { name: /Link/ });
const goalField = () => screen.getByRole('combobox', { name: /What would you like to do\?/ });
const messageField = () => screen.getByRole('textbox', { name: /Short message/ });
async function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Open request on GitHub' }));
  // Focusing an invalid field starts MUI's focus ripple, which mounts asynchronously; let it settle.
  await act(async () => {});
}

function fillValidForm() {
  fireEvent.click(screen.getByRole('radio', { name: 'Model owner' }));
  fireEvent.change(nameField(), { target: { value: ' MEDS-Tab ' } });
  fireEvent.change(linkField(), { target: { value: 'https://github.com/mmcdermott/MEDS_TAB_MIMIC_IV' } });
  fireEvent.change(goalField(), { target: { value: 'add' } });
  fireEvent.change(messageField(), { target: { value: 'We would like to add our model.' } });
}

let open: jest.SpiedFunction<typeof window.open>;
beforeEach(() => {
  open = jest.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => open.mockRestore());

it('renders five labelled fields, with the required ones marked', () => {
  render(<CollaborationRequestForm />);

  const roles = screen.getByRole('radiogroup');
  expect(roles).toHaveAttribute('aria-required', 'true');
  expect(screen.getByRole('group', { name: /I am a…/ })).toContainElement(roles);
  expect(screen.getAllByRole('radio').map(radio => radio.closest('label')?.textContent)).toEqual([
    'Dataset owner',
    'Task owner',
    'Model owner',
    'Other',
  ]);
  expect(nameField()).toBeRequired();
  expect(nameField()).toHaveAttribute('maxlength', '100');
  expect(linkField()).not.toBeRequired();
  expect(linkField()).toHaveAttribute('type', 'url');
  expect(goalField()).toBeRequired();
  expect(goalField()).toHaveValue('');
  expect(messageField()).not.toBeRequired();
  expect(messageField()).toHaveAttribute('maxlength', '1000');
  expect(screen.getByText('Optional. 0/1000 characters.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open request on GitHub' })).toHaveAccessibleDescription(
    /pre-filled issue on the public MEDS-DEV GitHub repository.*You need a GitHub account/
  );
});

it('shows errors for missing required fields and focuses the first one', async () => {
  render(<CollaborationRequestForm />);
  expect(screen.queryByText('Choose who you are.')).not.toBeInTheDocument();

  await submit();

  expect(open).not.toHaveBeenCalled();
  expect(screen.getByText('Choose who you are.')).toBeInTheDocument();
  expect(screen.getByRole('radiogroup')).toHaveAccessibleDescription('Choose who you are.');
  expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
  expect(nameField()).toHaveAccessibleDescription('Enter the name of your dataset, task or model.');
  expect(nameField()).toHaveAttribute('aria-invalid', 'true');
  expect(goalField()).toHaveAccessibleDescription('Choose what you would like to do.');
  expect(screen.getByRole('radio', { name: 'Dataset owner' })).toHaveFocus();

  // Errors update as the user fixes the fields.
  fireEvent.click(screen.getByRole('radio', { name: 'Task owner' }));
  expect(screen.queryByText('Choose who you are.')).not.toBeInTheDocument();
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

it('opens the pre-filled GitHub issue in a new tab and offers a fallback link', async () => {
  render(<CollaborationRequestForm />);
  fillValidForm();
  expect(screen.getByText('Optional. 31/1000 characters.')).toBeInTheDocument();

  await submit();

  const expected = buildIssueUrl(
    {
      role: 'model',
      name: 'MEDS-Tab',
      link: 'https://github.com/mmcdermott/MEDS_TAB_MIMIC_IV',
      goal: 'add',
      message: 'We would like to add our model.',
    },
    { sourceUrl: `${window.location.origin}${window.location.pathname}` }
  );
  expect(expected).toMatch(
    /^https:\/\/github\.com\/Medical-Event-Data-Standard\/MEDS-DEV\/issues\/new\?title=/
  );
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(expected, '_blank', 'noopener,noreferrer');
  expect(screen.getByRole('status')).toHaveTextContent('Your request opened in a new tab');
  expect(screen.getByRole('link', { name: 'open the pre-filled issue' })).toHaveAttribute('href', expected);

  // Editing the form hides the now out-of-date link.
  fireEvent.change(messageField(), { target: { value: 'Changed my mind.' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
