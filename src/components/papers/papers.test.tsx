/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import Papers from '@site/src/pages/papers';
import type { CitingPaper, PapersData, SeedPaper } from '@site/src/lib/papers/types';

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
const mockUsePluginData = jest.mocked(usePluginData);

const base = {
  authors: [] as string[],
  venue: null,
  year: null,
  publicationDate: null,
  doi: null,
  arxivId: null,
  citationCount: null,
};

const seeds: SeedPaper[] = [
  {
    ...base,
    id: 'seed-meds',
    label: 'MEDS (KDD 2025)',
    title: 'MEDS: Building Models and Tools',
    authors: ['A', 'B', 'C', 'D'],
    venue: 'KDD',
    year: 2025,
    url: 'https://doi.org/10.1145/meds',
    citationCount: 20,
  },
  { ...base, id: 'seed-aces', label: 'ACES', title: 'ACES', url: 'https://arxiv.org/abs/2406.19653' },
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
    citationCount: 30,
    url: 'https://doi.org/10.1/old',
    cites: ['seed-meds', 'seed-aces'],
  },
  {
    ...base,
    id: 'new',
    title: 'A Newer Paper',
    authors: ['Alan Turing', 'Grace Hopper', 'Edsger Dijkstra', 'Barbara Liskov'],
    year: 2026,
    citationCount: 1,
    url: 'https://arxiv.org/abs/2601.00001',
    cites: ['seed-aces'],
  },
  {
    ...base,
    id: 'manual',
    title: 'Uses MEDS Without Citing It',
    year: 2025,
    url: 'https://www.semanticscholar.org/paper/manual',
    cites: [],
    manual: true,
  },
];

const data: PapersData = { updatedAt: '2026-11-02T03:04:05.000Z', seeds, papers };

/** Titles of the listed citing papers, in order. */
const listedTitles = () =>
  within(screen.getByRole('region', { name: 'Papers citing MEDS' }))
    .getAllByRole('heading', { level: 3 })
    .map(heading => heading.textContent);

describe('Papers page', () => {
  beforeEach(() => mockUsePluginData.mockReset());

  it('explains the list, shows when it was updated, and how to suggest changes', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    expect(mockUsePluginData).toHaveBeenCalledWith('papers');
    expect(screen.getByTestId('layout')).toHaveAttribute('data-title', 'Papers');
    expect(screen.getByRole('heading', { level: 1, name: 'Papers using MEDS' })).toBeInTheDocument();
    expect(screen.getByText('2 November 2026')).toBeInTheDocument();
    expect(screen.getByText(/doesn’t always mean using it/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'static/data/papers.yaml' })).toHaveAttribute(
      'href',
      'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/blob/main/static/data/papers.yaml'
    );
    expect(screen.getByRole('link', { name: 'open an issue' })).toHaveAttribute(
      'href',
      'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/issues/new/choose'
    );
  });

  it('lists the core MEDS papers', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    const core = screen.getByRole('region', { name: 'Core MEDS papers' });
    expect(within(core).getByRole('link', { name: 'MEDS: Building Models and Tools' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1145/meds'
    );
    expect(within(core).getByText('A, B, C et al.')).toBeInTheDocument();
    expect(within(core).getByText('KDD · 2025 · 20 citations')).toBeInTheDocument();
    expect(within(core).getByText('MEDS (KDD 2025)')).toBeInTheDocument();
  });

  it('lists citing papers newest first, with links, details and the MEDS papers they cite', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    expect(screen.getByText('3 papers')).toBeInTheDocument();
    expect(listedTitles()).toEqual([
      'A Newer Paper',
      'Uses MEDS Without Citing It',
      'An Older Paper About Foundation Models',
    ]);

    const list = within(screen.getByRole('region', { name: 'Papers citing MEDS' }));
    expect(list.getByRole('link', { name: 'A Newer Paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2601.00001'
    );
    expect(list.getByText('Alan Turing, Grace Hopper, Edsger Dijkstra et al.')).toBeInTheDocument();
    expect(list.getByText('2026 · 1 citation')).toBeInTheDocument();
    expect(list.getByText('ML4H · 2024 · 30 citations')).toBeInTheDocument();
    expect(list.getByText('2025')).toBeInTheDocument();
    expect(list.getAllByText('Cites')).toHaveLength(2);
    expect(list.getAllByText('ACES')).toHaveLength(2);
    expect(list.getByText('MEDS (KDD 2025)')).toBeInTheDocument();
    expect(list.getByText('Added manually')).toBeInTheDocument();
  });

  it('sorts by citation count', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sort by/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Most cited' }));

    expect(listedTitles()).toEqual([
      'An Older Paper About Foundation Models',
      'A Newer Paper',
      'Uses MEDS Without Citing It',
    ]);
  });

  it('searches titles, authors and venues, with an empty state that clears the search', () => {
    mockUsePluginData.mockReturnValue(data);
    render(<Papers />);
    const search = screen.getByRole('searchbox', { name: 'Search papers' });

    fireEvent.change(search, { target: { value: 'hopper' } });
    expect(listedTitles()).toEqual(['A Newer Paper']);
    expect(screen.getByText('1 of 3 papers match your search')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'ml4h foundation' } });
    expect(listedTitles()).toEqual(['An Older Paper About Foundation Models']);

    fireEvent.change(search, { target: { value: ' nothing matches ' } });
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(2); // Only the core papers.
    expect(screen.getByText('No papers match “nothing matches”.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(listedTitles()).toHaveLength(3);
  });

  it('renders without data', () => {
    mockUsePluginData.mockReturnValue(undefined);
    render(<Papers />);

    expect(screen.getByRole('heading', { level: 1, name: 'Papers using MEDS' })).toBeInTheDocument();
    expect(screen.queryByText(/last updated/)).not.toBeInTheDocument();
    expect(screen.getByText('No citing papers have been found yet.')).toBeInTheDocument();
  });

  it('skips unknown seeds on a paper, and details it has none of', () => {
    mockUsePluginData.mockReturnValue({
      updatedAt: 'garbage',
      seeds: [],
      papers: [{ ...base, id: 'bare', title: 'Bare Paper', url: 'https://example.org', cites: ['gone'] }],
    });
    render(<Papers />);

    expect(screen.queryByText(/last updated/)).not.toBeInTheDocument();
    const card = screen.getByRole('heading', { level: 3, name: 'Bare Paper' }).closest('.MuiCard-root');
    expect(card?.textContent).toBe('Bare Paper');
  });
});
