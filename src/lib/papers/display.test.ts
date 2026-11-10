import { describe, expect, it } from '@jest/globals';
import { countInstitutions, formatAuthors, formatDate, matchesQuery, sortPapers } from './display';
import type { Paper } from './types';

const paper = (overrides: Partial<Paper>): Paper => ({
  id: 'id',
  title: 'Title',
  authors: [],
  venue: null,
  year: null,
  publicationDate: null,
  doi: null,
  arxivId: null,
  url: 'https://example.org',
  ...overrides,
});

describe('sortPapers', () => {
  const papers = [
    paper({ id: 'year-only', title: 'B', year: 2025 }),
    paper({ id: 'dated', title: 'C', year: 2025, publicationDate: '2025-03-01' }),
    paper({ id: 'undated', title: 'D' }),
    paper({ id: 'old', title: 'E', year: 2024, publicationDate: '2024-12-31' }),
    paper({ id: 'tie-a', title: 'A', year: 2024, publicationDate: '2024-12-31' }),
  ];

  it('sorts newest first, with year-only dates before dated papers of that year and undated papers last', () => {
    expect(sortPapers(papers).map(p => p.id)).toEqual(['dated', 'year-only', 'tie-a', 'old', 'undated']);
  });

  it('keeps the input order of papers that tie on everything', () => {
    const twins = [paper({ id: 'first' }), paper({ id: 'second' })];
    expect(sortPapers(twins).map(p => p.id)).toEqual(['first', 'second']);
  });

  it('does not modify its input', () => {
    const before = papers.map(p => p.id);
    sortPapers(papers);
    expect(papers.map(p => p.id)).toEqual(before);
  });
});

describe('matchesQuery', () => {
  const p = {
    ...paper({ title: 'Foundation Models for EHR', authors: ['Ada Lovelace'], venue: 'ML4H' }),
    institutions: ['Columbia University'],
  };

  it('matches every term case-insensitively against the title, authors, venue and institutions', () => {
    expect(matchesQuery(p, 'foundation')).toBe(true);
    expect(matchesQuery(p, 'LOVELACE ehr')).toBe(true);
    expect(matchesQuery(p, '  ml4h  ')).toBe(true);
    expect(matchesQuery(p, 'columbia models')).toBe(true);
    expect(matchesQuery(p, 'lovelace nature')).toBe(false);
  });

  it('matches everything for an empty query', () => {
    expect(matchesQuery(p, '')).toBe(true);
    expect(matchesQuery(paper({ venue: null }), '   ')).toBe(true);
  });
});

describe('countInstitutions', () => {
  it('counts papers per institution, most papers first and then alphabetically', () => {
    expect(
      countInstitutions([
        { institutions: ['Yale University', 'Columbia University'] },
        { institutions: ['Columbia University', 'Columbia University'] },
        { institutions: ['ETH Zurich'] },
        { institutions: [] },
      ])
    ).toEqual([
      { name: 'Columbia University', papers: 2 },
      { name: 'ETH Zurich', papers: 1 },
      { name: 'Yale University', papers: 1 },
    ]);
    expect(countInstitutions([])).toEqual([]);
  });
});

describe('formatAuthors', () => {
  it('lists up to `max` authors and truncates longer lists with "et al."', () => {
    expect(formatAuthors([])).toBe('');
    expect(formatAuthors(['A', 'B', 'C'])).toBe('A, B, C');
    expect(formatAuthors(['A', 'B', 'C', 'D'])).toBe('A, B, C et al.');
    expect(formatAuthors(['A', 'B'], 1)).toBe('A et al.');
  });
});

describe('formatDate', () => {
  it('formats a timestamp as a UTC date', () => {
    expect(formatDate('2026-11-06T23:30:00.000Z')).toBe('6 November 2026');
  });

  it('returns null for missing or invalid timestamps', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('not a date')).toBeNull();
  });
});
