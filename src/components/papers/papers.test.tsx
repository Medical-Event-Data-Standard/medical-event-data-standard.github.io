/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import Papers from '@site/src/pages/papers';
import type { CitingPaper, PapersPageData, SeedPaper } from '@site/src/lib/papers/types';

// `@docusaurus/*` and `@theme/*` modules are webpack aliases that only exist inside a Docusaurus build.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
jest.mock(
  '@theme/Layout',
  () => ({
    __esModule: true,
    default: ({ children, title }: React.PropsWithChildren<{ title: string }>) => (
      <div data-testid="layout" data-title={title}>
        {children}
      </div>
    ),
  }),
  { virtual: true }
);
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
    default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
  }),
  { virtual: true }
);
jest.mock(
  '@docusaurus/useBaseUrl',
  () => ({ __esModule: true, useBaseUrlUtils: () => ({ withBaseUrl: (url: string) => `/base${url}` }) }),
  { virtual: true }
);
const mockUsePluginData = jest.mocked(usePluginData);

const base = {
  authors: [] as string[],
  venue: null,
  year: null,
  publicationDate: null,
  doi: null,
  arxivId: null,
};

const seeds: SeedPaper[] = [
  {
    ...base,
    id: 'seed-meds',
    label: 'MEDS (KDD 2025)',
    title: 'MEDS: Building Models and Tools',
    authors: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    venue: 'KDD',
    year: 2025,
    url: 'https://doi.org/10.1145/meds',
  },
  { ...base, id: 'seed-aces', label: 'ACES', title: 'ACES', url: 'https://arxiv.org/abs/2406.19653' },
  { ...base, id: 'seed-uncited', label: 'Uncited', title: 'Uncited', url: 'https://example.org/uncited' },
];

const papers: CitingPaper[] = [
  {
    ...base,
    id: 'old',
    title: 'An Older Paper About Foundation Models',
    authors: ['Ada Lovelace'],
    venue: 'ML4H',
    year: 2024,
    publicationDate: '2024-12-01',
    url: 'https://doi.org/10.1/old',
    cites: ['seed-meds', 'seed-aces'],
    institutions: ['Columbia University', 'Stanford University'],
  },
  {
    ...base,
    id: 'new',
    title: 'A Newer Paper',
    authors: ['Alan Turing', 'Grace Hopper', 'Edsger Dijkstra', 'Barbara Liskov'],
    year: 2026,
    url: 'https://arxiv.org/abs/2601.00001',
    cites: ['seed-aces'],
    institutions: ['Columbia University'],
  },
  {
    ...base,
    id: 'manual',
    title: 'Uses MEDS Without Citing It',
    year: 2025,
    url: 'https://www.semanticscholar.org/paper/manual',
    cites: [],
    manual: true,
    institutions: [],
  },
];

const data: PapersPageData = {
  updatedAt: '2026-11-02T03:04:05.000Z',
  seeds,
  papers,
  institutionIcons: { 'Columbia University': '/img/institutions/columbia-university.png' },
  institutionLocations: {},
};

const listRegion = () => screen.getByRole('region', { name: 'Papers citing or using MEDS' });

/** Titles of the listed citing papers, in order. */
const listedTitles = () =>
  within(listRegion())
    .queryAllByRole('heading', { level: 3 })
    .map(heading => heading.textContent);

const selectReason = (name: string) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /Why listed/ }));
  fireEvent.click(screen.getByRole('option', { name }));
};

describe('Papers page', () => {
  beforeEach(() => mockUsePluginData.mockReset());

  it('has a headline with counts, says when it was updated, and explains how the list is made', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    expect(mockUsePluginData).toHaveBeenCalledWith('papers');
    expect(screen.getByTestId('layout')).toHaveAttribute('data-title', 'Papers');
    expect(screen.getByRole('heading', { level: 1, name: 'Papers using MEDS' })).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(
      within(header)
        .getAllByRole('listitem')
        .map(item => item.textContent)
    ).toEqual(['3papers', '2institutions', '3core MEDS papers']);
    expect(within(header).getByText('Last updated on 2 November 2026')).toBeInTheDocument();
    expect(screen.getByText(/doesn’t always mean using it/)).toBeInTheDocument();

    const how = screen.getByRole('region', { name: 'How this list is made' });
    expect(within(how).getByRole('link', { name: 'OpenAlex' })).toHaveAttribute(
      'href',
      'https://openalex.org/'
    );
    expect(within(how).getByText(/1 of the 3 papers has no institutions listed/)).toBeInTheDocument();
    expect(within(how).getByRole('link', { name: 'open an issue' })).toHaveAttribute(
      'href',
      'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/issues/new/choose'
    );
    for (const link of within(how).getAllByRole('link', { name: 'static/data/papers.yaml' })) {
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/blob/main/static/data/papers.yaml'
      );
    }
  });

  it('lists the core MEDS papers, without citation counts', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    const core = screen.getByRole('region', { name: 'Core MEDS papers' });
    expect(within(core).getByRole('link', { name: 'MEDS: Building Models and Tools' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1145/meds'
    );
    expect(within(core).getByText('A, B, C, D, E, F et al.')).toBeInTheDocument();
    expect(within(core).getByText('KDD · 2025')).toBeInTheDocument();
    expect(within(core).getByText('MEDS (KDD 2025)')).toBeInTheDocument();
    expect(screen.queryByText(/\d+ citations?/)).not.toBeInTheDocument();
  });

  it('lists citing papers newest first, with links, details and institutions', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    expect(screen.getByText('3 papers')).toBeInTheDocument();
    expect(listedTitles()).toEqual([
      'A Newer Paper',
      'Uses MEDS Without Citing It',
      'An Older Paper About Foundation Models',
    ]);

    const list = within(listRegion());
    expect(list.getByRole('link', { name: 'A Newer Paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2601.00001'
    );
    expect(list.getByText('Alan Turing, Grace Hopper, Edsger Dijkstra, Barbara Liskov')).toBeInTheDocument();
    expect(list.getByText('ML4H · 2024')).toBeInTheDocument();
    expect(list.getByText('Columbia University · Stanford University')).toBeInTheDocument();
    expect(list.getByText('Columbia University')).toBeInTheDocument();
    expect(list.queryByText('Cites')).not.toBeInTheDocument();
  });

  it('shows the institutions with their paper counts, and filters the list by one', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    const institutions = within(screen.getByRole('region', { name: 'Institutions' }));
    const chips = institutions.getAllByRole('button', { name: /: \d+ papers?$/ });
    expect(chips.map(chip => chip.getAttribute('aria-label'))).toEqual([
      'Columbia University: 2 papers',
      'Stanford University: 1 paper',
    ]);
    expect(institutions.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();

    fireEvent.click(chips[1]);
    expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
    expect(listedTitles()).toEqual(['An Older Paper About Foundation Models']);
    expect(screen.getByText('1 of 3 papers')).toBeInTheDocument();
    expect(
      within(listRegion()).getByRole('button', { name: 'Institution: Stanford University' })
    ).toBeInTheDocument();

    fireEvent.click(chips[0]);
    expect(listedTitles()).toEqual(['A Newer Paper', 'An Older Paper About Foundation Models']);

    // Selecting the chosen institution again clears the filter.
    fireEvent.click(chips[0]);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
    expect(listedTitles()).toHaveLength(3);
  });

  it("shows each institution's icon, or its initial if it has none, and sorts institutions by name", () => {
    mockUsePluginData.mockReturnValue(data);
    const { container } = render(<Papers />);
    const region = screen.getByRole('region', { name: 'Institutions' });

    const icon = container.querySelector('img[src="/base/img/institutions/columbia-university.png"]');
    expect(icon).toHaveAttribute('alt', '');
    expect(
      within(screen.getByRole('button', { name: 'Stanford University: 1 paper' })).getByText('S')
    ).toBeInTheDocument();

    const chipNames = () =>
      within(region)
        .getAllByRole('button')
        .map(chip => chip.getAttribute('aria-label'))
        .filter(Boolean);
    expect(chipNames()).toEqual(['Columbia University: 2 papers', 'Stanford University: 1 paper']);
    fireEvent.click(within(region).getByRole('button', { name: 'A–Z' }));
    fireEvent.click(within(region).getByRole('button', { name: 'A–Z' })); // Selecting it again keeps it.
    expect(within(region).getByRole('button', { name: 'A–Z' })).toHaveAttribute('aria-pressed', 'true');
    expect(chipNames()).toEqual(['Columbia University: 2 papers', 'Stanford University: 1 paper']);
  });

  it('sorts papers newest first, oldest first or by title', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);
    const sortBy = (name: string) => {
      fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sort by/ }));
      fireEvent.click(screen.getByRole('option', { name }));
    };

    sortBy('Oldest first');
    expect(listedTitles()).toEqual([
      'An Older Paper About Foundation Models',
      'Uses MEDS Without Citing It',
      'A Newer Paper',
    ]);
    sortBy('Title (A–Z)');
    expect(listedTitles()).toEqual([
      'A Newer Paper',
      'An Older Paper About Foundation Models',
      'Uses MEDS Without Citing It',
    ]);
    sortBy('Newest first');
    expect(listedTitles()).toEqual([
      'A Newer Paper',
      'Uses MEDS Without Citing It',
      'An Older Paper About Foundation Models',
    ]);
  });

  it('clears the institution filter from the chip above the list', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    fireEvent.click(screen.getByRole('button', { name: 'Stanford University: 1 paper' }));
    const active = within(listRegion()).getByRole('button', { name: 'Institution: Stanford University' });
    fireEvent.keyUp(active, { key: 'Backspace' });
    expect(listedTitles()).toHaveLength(3);
    expect(screen.getByText('3 papers')).toBeInTheDocument();
  });

  it('collapses a long list of institutions, keeping the selected one visible', () => {
    const many = Array.from({ length: 30 }, (_, i) => `Institution ${String(i).padStart(2, '0')}`);
    mockUsePluginData.mockReturnValue({
      ...data,
      papers: [
        { ...papers[0], institutions: many },
        { ...papers[1], institutions: [many[29]] },
      ],
    });
    render(<Papers />);
    const institutions = within(screen.getByRole('region', { name: 'Institutions' }));
    const chipNames = () =>
      institutions
        .getAllByRole('button')
        .map(chip => chip.getAttribute('aria-label'))
        .filter(Boolean);

    // The institution with two papers comes first, or in its place by name.
    expect(chipNames()).toHaveLength(24);
    expect(chipNames()[0]).toBe('Institution 29: 2 papers');
    fireEvent.click(institutions.getByRole('button', { name: 'A–Z' }));
    expect(chipNames().slice(0, 2)).toEqual(['Institution 00: 1 paper', 'Institution 01: 1 paper']);
    fireEvent.click(institutions.getByRole('button', { name: 'Most papers' }));
    expect(chipNames()[0]).toBe('Institution 29: 2 papers');

    fireEvent.click(institutions.getByRole('button', { name: 'Show all 30 institutions' }));
    expect(chipNames()).toHaveLength(30);
    fireEvent.click(institutions.getByRole('button', { name: 'Institution 28: 1 paper' }));
    fireEvent.click(institutions.getByRole('button', { name: 'Show fewer' }));
    expect(chipNames()).toHaveLength(25);
    expect(chipNames()[24]).toBe('Institution 28: 1 paper');
  });

  it('filters by why a paper is listed, offering only reasons some paper has', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Why listed/ }));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'Any reason',
      'Cites MEDS (KDD 2025) (1)',
      'Cites ACES (2)',
      'Added by hand (1)',
    ]);
    fireEvent.click(screen.getByRole('option', { name: 'Cites ACES (2)' }));
    expect(listedTitles()).toEqual(['A Newer Paper', 'An Older Paper About Foundation Models']);

    selectReason('Added by hand (1)');
    expect(listedTitles()).toEqual(['Uses MEDS Without Citing It']);

    selectReason('Any reason');
    expect(listedTitles()).toHaveLength(3);
  });

  it('searches titles, authors, venues and institutions, with an empty state that clears the filters', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);
    const search = screen.getByRole('searchbox', { name: 'Search papers' });

    fireEvent.change(search, { target: { value: 'hopper' } });
    expect(listedTitles()).toEqual(['A Newer Paper']);
    expect(screen.getByText('1 of 3 papers')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'ml4h foundation' } });
    expect(listedTitles()).toEqual(['An Older Paper About Foundation Models']);

    fireEvent.change(search, { target: { value: 'stanford' } });
    expect(listedTitles()).toEqual(['An Older Paper About Foundation Models']);

    selectReason('Added by hand (1)');
    expect(listedTitles()).toEqual([]);
    expect(screen.getByText('No papers match these filters.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
    expect(listedTitles()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('renders without data', () => {
    mockUsePluginData.mockReturnValue(undefined);
    render(<Papers />);

    expect(screen.getByRole('heading', { level: 1, name: 'Papers using MEDS' })).toBeInTheDocument();
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Institutions' })).not.toBeInTheDocument();
    expect(screen.queryByText(/no institutions listed/)).not.toBeInTheDocument();
    expect(screen.getByText('No citing papers have been found yet.')).toBeInTheDocument();
  });

  it('skips details a paper has none of', () => {
    mockUsePluginData.mockReturnValue({
      updatedAt: 'garbage',
      seeds: [],
      papers: [
        {
          ...base,
          id: 'bare',
          title: 'Bare Paper',
          url: 'https://example.org',
          cites: ['gone'],
          institutions: [],
        },
      ],
    });
    render(<Papers />);

    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
    const card = screen.getByRole('heading', { level: 3, name: 'Bare Paper' }).closest('.MuiCard-root');
    expect(card?.textContent).toBe('Bare Paper');
  });
});
