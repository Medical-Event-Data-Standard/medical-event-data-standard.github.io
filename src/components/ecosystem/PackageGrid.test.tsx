/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import PackageGrid from './PackageGrid';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build. The grid keeps its search
// and topics in the URL; without metadata, its cards show no stars or releases, and the MEDS logo.
let mockLocation = { pathname: '/docs/intro_pages/ecosystem', search: '' };
const mockReplace = jest.fn();
jest.mock(
  '@docusaurus/router',
  () => ({ useLocation: () => mockLocation, useHistory: () => ({ replace: mockReplace }) }),
  { virtual: true }
);
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: () => undefined }), { virtual: true });
jest.mock('@docusaurus/useBaseUrl', () => ({ __esModule: true, default: (url: string) => `/${url}` }), {
  virtual: true,
});
jest.mock('@docusaurus/Link', () => ({ __esModule: true, default: () => null }), { virtual: true });

const { packages, topics, topicPackages } = parseCategoryMap({
  datasets: {
    name: 'Datasets',
    packages: [
      {
        name: 'HiRID',
        description:
          'Converts HiRID, a high time-resolution ICU dataset from Bern University Hospital, into MEDS.',
      },
      {
        name: 'PIC',
        description:
          "Converts the Paediatric Intensive Care database, from a children's hospital in China, into MEDS.",
      },
    ],
  },
  tools: {
    name: 'Tools',
    packages: [
      { name: 'MEDS-DEV', description: 'A decentralized benchmark of tasks and models for MEDS data.' },
    ],
  },
});

const renderGrid = () =>
  render(<PackageGrid packages={packages} topics={topics} topicPackages={topicPackages} />);

/** The names of the packages whose cards are shown. */
const shownPackages = () =>
  screen.queryAllByRole('heading', { level: 6 }).map(heading => heading.textContent);

const search = (query: string) =>
  fireEvent.change(screen.getByLabelText('Search by name or description'), { target: { value: query } });

/** The query string that the grid last put in the URL. */
const urlSearch = () => mockReplace.mock.lastCall?.[0].search;

beforeEach(() => {
  mockLocation = { pathname: '/docs/intro_pages/ecosystem', search: '' };
  mockReplace.mockClear();
});

describe('PackageGrid', () => {
  it('searches the descriptions of the packages as well as their names', () => {
    renderGrid();
    expect(shownPackages()).toEqual(['HiRID', 'PIC', 'MEDS-DEV']);
    expect(urlSearch()).toBe('');

    search('bern');
    expect(shownPackages()).toEqual(['HiRID']);
    expect(urlSearch()).toBe('search=bern');

    search('Benchmark');
    expect(shownPackages()).toEqual(['MEDS-DEV']);

    search('pic');
    expect(shownPackages()).toEqual(['PIC']);

    search('hospital china');
    expect(shownPackages()).toEqual(['PIC']);

    search('pediatric');
    expect(shownPackages()).toEqual([]);
  });

  it('filters by topic, together with the search', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(shownPackages()).toEqual(['MEDS-DEV']);
    expect(urlSearch()).toBe('topics=Tools');

    fireEvent.click(screen.getByRole('button', { name: 'Datasets' }));
    expect(shownPackages()).toEqual(['HiRID', 'PIC', 'MEDS-DEV']);

    search('into meds');
    expect(shownPackages()).toEqual(['HiRID', 'PIC']);

    fireEvent.click(screen.getByRole('button', { name: 'Datasets' }));
    expect(shownPackages()).toEqual([]);
    expect(urlSearch()).toBe('search=into+meds&topics=Tools');
  });

  it('starts from the search and topics in the URL, and follows changes to them', () => {
    // A topic that no longer exists selects nothing.
    mockLocation = { ...mockLocation, search: '?search=hospital&topics=Datasets,Gone' };
    const { rerender } = renderGrid();
    expect(screen.getByLabelText('Search by name or description')).toHaveValue('hospital');
    expect(shownPackages()).toEqual(['HiRID', 'PIC']);

    mockLocation = { ...mockLocation, search: '?search=decentralized' };
    rerender(<PackageGrid packages={packages} topics={topics} topicPackages={topicPackages} />);
    expect(shownPackages()).toEqual(['MEDS-DEV']);
  });
});
