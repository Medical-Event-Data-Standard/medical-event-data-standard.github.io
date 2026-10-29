/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import CiCompatibilityMatrix from './CiCompatibilityMatrix';
import { CI_ACTIONS_URL, CiReport, CiResult, countCiResults, loadCiReport } from '@site/src/lib/MEDS-DEV/ci';

jest.mock('@site/src/lib/MEDS-DEV/ci', () => ({
  ...jest.requireActual('@site/src/lib/MEDS-DEV/ci'),
  loadCiReport: jest.fn(),
}));
const mockLoad = jest.mocked(loadCiReport);

// Synthetic data exercises both missing combinations and expected-but-not-run jobs.
const baseResult: CiResult = {
  model: 'model-a',
  dataset: 'demo-a',
  task: 'mortality',
  status: 'passed',
  job_conclusion: 'success',
  test_conclusion: 'success',
  job_id: 99,
  job_url: `${CI_ACTIONS_URL}/runs/123/job/99`,
};
const results: CiResult[] = [
  baseResult,
  { ...baseResult, model: 'model-b', status: 'failed', job_conclusion: 'failure' },
  {
    ...baseResult,
    dataset: 'demo-b',
    status: 'not_run',
    job_id: null,
    job_url: null,
    job_conclusion: null,
    test_conclusion: null,
  },
];
const report: CiReport = {
  schema_version: 1,
  repository: 'Medical-Event-Data-Standard/MEDS-DEV',
  run_id: 123,
  run_attempt: 2,
  run_url: `${CI_ACTIONS_URL}/runs/123`,
  commit_sha: 'abcdef123456',
  branch: 'main',
  generated_at: '2026-10-28T12:00:00+00:00',
  scope: 'full-integration',
  summary: countCiResults(results),
  results,
};

beforeEach(() => mockLoad.mockReset());

it('shows loading then an Actions fallback for an unavailable report', async () => {
  mockLoad.mockResolvedValue(null);
  render(<CiCompatibilityMatrix />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading CI compatibility report');
  expect(await screen.findByRole('alert')).toHaveTextContent('not available');
  expect(screen.getByRole('link', { name: 'View MEDS-DEV GitHub Actions' })).toHaveAttribute(
    'href',
    CI_ACTIONS_URL
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('renders provenance, accessible job links, separate conclusions, and absent cells', async () => {
  mockLoad.mockResolvedValue(report);
  render(<CiCompatibilityMatrix />);
  const table = await screen.findByRole('table');
  expect(screen.getByRole('link', { name: 'run 123' })).toHaveAttribute('href', report.run_url);
  expect(screen.getByText('abcdef1')).toBeInTheDocument();
  expect(screen.getByText('2026-10-28T12:00:00.000Z')).toBeInTheDocument();
  const failed = within(table).getByRole('link', {
    name: 'model-b, demo-a, mortality: Failed. View job logs',
  });
  expect(failed).toHaveAttribute('href', baseResult.job_url);
  expect(failed.closest('td')).toHaveTextContent('Job: failurePytest step: success');
  expect(within(table).getByLabelText('model-a, demo-b, mortality: Not run')).toBeInTheDocument();
  expect(within(table).getByLabelText('Not included in collection')).toHaveTextContent('—');
  expect(screen.getByRole('status')).toHaveTextContent('3 collected combinations');
});

it('updates visible columns and counts when filtering and handles no matches', async () => {
  mockLoad.mockResolvedValue(report);
  render(<CiCompatibilityMatrix />);
  await screen.findByRole('table');
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Model' }));
  fireEvent.click(await screen.findByRole('option', { name: 'model-b' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 collected combinations');
  expect(screen.getByRole('status')).toHaveTextContent('Failed: 1');
  expect(screen.queryByRole('columnheader', { name: 'model-a' })).not.toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Dataset' }));
  fireEvent.click(await screen.findByRole('option', { name: 'demo-b' }));
  expect(screen.getByRole('alert')).toHaveTextContent('No collected combinations match');
  expect(screen.getByRole('status')).toHaveTextContent('0 collected combinations');
});
