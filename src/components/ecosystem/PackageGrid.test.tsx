/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import PackageGrid from './PackageGrid';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';
import { RawCategory } from '@site/src/lib/ecosystem/types';

// `@docusaurus/*` and `@theme/*` modules are webpack aliases that only exist inside a Docusaurus build. The grid keeps
// its search, topics and layout in the URL; without metadata, its cards show no stars or releases, and the MEDS logo.
// The theme's heading (which adds the permalink) is replaced by a plain one.
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
jest.mock(
  '@theme/Heading',
  () => ({
    __esModule: true,
    default: ({ as: Tag, id, children }: { as: 'h2'; id: string; children: React.ReactNode }) => (
      <Tag id={id} data-permalink={`#${id}`}>
        {children}
      </Tag>
    ),
  }),
  { virtual: true }
);

const { packages, topics, topicPackages, categories } = parseCategoryMap({
  datasets: {
    name: 'Datasets',
    description: 'ETLs that convert datasets into MEDS.',
    // No package of its own, and an empty subcategory: neither is ever shown.
    templates: { name: 'Templates' } as RawCategory,
    public: {
      name: 'Public Datasets',
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
    } as RawCategory,
  },
  tools: {
    name: 'Tools',
    packages: [
      { name: 'MEDS-DEV', description: 'A decentralized benchmark of tasks and models for MEDS data.' },
    ],
  },
});

const grid = () => (
  <PackageGrid packages={packages} topics={topics} topicPackages={topicPackages} categories={categories} />
);
const renderGrid = () => render(grid());

/** The names of the packages whose cards are shown. */
const shownPackages = () =>
  screen.queryAllByRole('heading', { level: 6 }).map(heading => heading.textContent);

const search = (query: string) =>
  fireEvent.change(screen.getByLabelText('Search by name or description'), { target: { value: query } });

/** The headings of the categories shown, indented by their level below h2. */
const shownGroups = () =>
  screen
    .queryAllByRole('heading')
    .filter(heading => /^H[2-5]$/.test(heading.tagName))
    .map(heading => `${'  '.repeat(Number(heading.tagName[1]) - 2)}${heading.textContent}`);

/** The names of the packages whose cards are shown in a category's section. */
const packagesIn = (category: string) =>
  within(screen.getByRole('region', { name: category }))
    .queryAllByRole('heading', { level: 6 })
    .map(heading => heading.textContent);

const layoutButton = (name: string) => screen.getByRole('button', { name });

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
    rerender(grid());
    expect(shownPackages()).toEqual(['MEDS-DEV']);
  });

  it('groups the tiles by category by default, leaving out categories without tiles', () => {
    renderGrid();
    expect(shownGroups()).toEqual(['Datasets', '  Public Datasets', 'Tools']);
    expect(screen.getByText('ETLs that convert datasets into MEDS.')).toBeInTheDocument();
    expect(packagesIn('Public Datasets')).toEqual(['HiRID', 'PIC']);
    expect(packagesIn('Tools')).toEqual(['MEDS-DEV']);
    // A subcategory's section is part of its parent's.
    expect(packagesIn('Datasets')).toEqual(['HiRID', 'PIC']);

    // The headings can be linked to.
    expect(screen.getByRole('heading', { name: 'Public Datasets' })).toHaveAttribute(
      'id',
      'datasets-public-datasets'
    );
    expect(screen.getByRole('heading', { name: 'Tools' })).toHaveAttribute('data-permalink', '#tools');

    expect(layoutButton('Grouped by type')).toHaveAttribute('aria-pressed', 'true');
    expect(layoutButton('All in one grid')).toHaveAttribute('aria-pressed', 'false');
  });

  it('filters the tiles within their groups, hiding the groups left without tiles', () => {
    renderGrid();

    search('bern');
    expect(shownGroups()).toEqual(['Datasets', '  Public Datasets']);
    expect(packagesIn('Public Datasets')).toEqual(['HiRID']);

    search('');
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(shownGroups()).toEqual(['Tools']);
    expect(packagesIn('Tools')).toEqual(['MEDS-DEV']);

    search('hospital');
    expect(shownGroups()).toEqual([]);
    expect(shownPackages()).toEqual([]);
  });

  it('switches between the grouped tiles and one grid, keeping the layout in the URL', () => {
    renderGrid();
    search('into meds');

    fireEvent.click(layoutButton('All in one grid'));
    expect(shownGroups()).toEqual([]);
    expect(shownPackages()).toEqual(['HiRID', 'PIC']);
    expect(layoutButton('All in one grid')).toHaveAttribute('aria-pressed', 'true');
    expect(urlSearch()).toBe('search=into+meds&view=flat');

    // Clicking the selected layout again keeps it.
    fireEvent.click(layoutButton('All in one grid'));
    expect(urlSearch()).toBe('search=into+meds&view=flat');

    fireEvent.click(layoutButton('Grouped by type'));
    expect(shownGroups()).toEqual(['Datasets', '  Public Datasets']);
    expect(urlSearch()).toBe('search=into+meds');
  });

  it('starts from the layout in the URL, and follows changes to it', () => {
    mockLocation = { ...mockLocation, search: '?view=flat' };
    const { rerender } = renderGrid();
    expect(shownGroups()).toEqual([]);
    expect(shownPackages()).toEqual(['HiRID', 'PIC', 'MEDS-DEV']);

    // Any other value is the default, grouped layout.
    mockLocation = { ...mockLocation, search: '?view=bogus' };
    rerender(grid());
    expect(shownGroups()).toEqual(['Datasets', '  Public Datasets', 'Tools']);
  });
});
