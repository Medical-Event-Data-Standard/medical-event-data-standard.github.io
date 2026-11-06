import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';

import {
  MedsPaper,
  comparePapersByDate,
  formatPaperDate,
  layoutTimeline,
  paperDateTime,
  parseMedsPapers,
  sortPapersByDate,
  timelineColumnCount,
} from './timeline';

const paper = (overrides: Partial<MedsPaper> = {}): MedsPaper => ({
  label: 'Paper',
  title: 'A Paper',
  venue: 'A Venue',
  year: 2024,
  url: 'https://example.org/paper',
  summary: 'What the paper is.',
  ...overrides,
});

const rawPaper = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  label: 'Paper',
  title: 'A Paper',
  venue: 'A Venue',
  year: 2024,
  month: 5,
  url: 'https://example.org/paper',
  summary: 'What the paper is.',
  ...overrides,
});

describe('parseMedsPapers', () => {
  it('parses papers, collapsing whitespace and keeping the optional month and id only when given', () => {
    const papers = parseMedsPapers({
      papers: [
        rawPaper({ title: '  A   Paper\nwith a folded title ', id: 'abc123' }),
        rawPaper({ label: 'Undated', month: undefined }),
      ],
    });

    expect(papers).toEqual([
      {
        label: 'Paper',
        title: 'A Paper with a folded title',
        venue: 'A Venue',
        year: 2024,
        month: 5,
        url: 'https://example.org/paper',
        summary: 'What the paper is.',
        id: 'abc123',
      },
      {
        label: 'Undated',
        title: 'A Paper',
        venue: 'A Venue',
        year: 2024,
        url: 'https://example.org/paper',
        summary: 'What the paper is.',
      },
    ]);
    expect(papers[1]).not.toHaveProperty('month');
    expect(papers[1]).not.toHaveProperty('id');
  });

  it.each([
    ['not a mapping', ['a list']],
    ['without papers', {}],
    ['with no papers', { papers: [] }],
    ['with papers that are not a list', { papers: 'MEDS' }],
  ])('rejects a file %s', (_, raw) => {
    expect(() => parseMedsPapers(raw)).toThrow(
      'Invalid static/data/meds_papers.yaml: expected a mapping with a non-empty list of "papers".'
    );
  });

  it.each([
    ['a paper that is not a mapping', 'MEDS', 'expected a paper'],
    ['an unknown field', rawPaper({ doi: '10.1/x' }), 'unknown field "doi"'],
    ['a missing field', rawPaper({ summary: undefined }), '"summary" is missing'],
    ['a null field', rawPaper({ venue: null }), '"venue" is missing'],
    ['an empty string', rawPaper({ label: '   ' }), '"label" must be a non-empty string'],
    ['a string field that is a number', rawPaper({ title: 42 }), '"title" must be a non-empty string'],
    ['a year that is a string', rawPaper({ year: '2024' }), '"year" must be a four-digit year'],
    ['a year that is not an integer', rawPaper({ year: 2024.5 }), '"year" must be a four-digit year'],
    ['a two-digit year', rawPaper({ year: 24 }), '"year" must be a four-digit year'],
    ['a month of 0', rawPaper({ month: 0 }), '"month" must be a number from 1 to 12'],
    ['a month of 13', rawPaper({ month: 13 }), '"month" must be a number from 1 to 12'],
    ['a month that is a name', rawPaper({ month: 'May' }), '"month" must be a number from 1 to 12'],
    ['a url that is not a URL', rawPaper({ url: 'openreview IsHy2ebjIG' }), '"url" must be an http(s) URL'],
    [
      'a url that is not http(s)',
      rawPaper({ url: 'ftp://example.org/paper' }),
      '"url" must be an http(s) URL',
    ],
  ])('rejects %s, naming the paper', (_, raw, message) => {
    const parseSecond = () => parseMedsPapers({ papers: [rawPaper(), raw] });
    expect(parseSecond).toThrow('Invalid entry in static/data/meds_papers.yaml at papers[1]: ');
    expect(parseSecond).toThrow(message);
  });
});

describe('sortPapersByDate', () => {
  it('sorts by year, then month, then label, without changing the given list', () => {
    const papers = [
      paper({ label: 'B', year: 2025, month: 8 }),
      paper({ label: 'C', year: 2024, month: 12 }),
      paper({ label: 'Year only', year: 2025 }),
      paper({ label: 'A', year: 2025, month: 8 }),
      paper({ label: 'D', year: 2024, month: 5 }),
    ];
    const original = [...papers];

    expect(sortPapersByDate(papers).map(({ label }) => label)).toEqual(['D', 'C', 'Year only', 'A', 'B']);
    expect(papers).toEqual(original);
  });

  it('compares papers of the same date as equal only when their labels are equal', () => {
    expect(comparePapersByDate(paper(), paper())).toBe(0);
    expect(comparePapersByDate(paper({ year: 2023 }), paper())).toBeLessThan(0);
    expect(comparePapersByDate(paper({ month: 2 }), paper({ month: 1 }))).toBeGreaterThan(0);
  });
});

describe('paper dates', () => {
  it('formats the month and year, or only the year when the month is unknown', () => {
    expect(formatPaperDate({ year: 2024, month: 5 })).toBe('May 2024');
    expect(formatPaperDate({ year: 2024, month: 12 })).toBe('Dec 2024');
    expect(formatPaperDate({ year: 2026 })).toBe('2026');
  });

  it('gives a valid HTML date for <time>', () => {
    expect(paperDateTime({ year: 2024, month: 5 })).toBe('2024-05');
    expect(paperDateTime({ year: 2025, month: 12 })).toBe('2025-12');
    expect(paperDateTime({ year: 2026 })).toBe('2026');
  });
});

describe('layoutTimeline', () => {
  it('orders the papers by date, alternating their side and labelling each new year', () => {
    const entries = layoutTimeline([
      paper({ label: 'Third', year: 2025, month: 4 }),
      paper({ label: 'First', year: 2024, month: 5 }),
      paper({ label: 'Fourth', year: 2025, month: 8 }),
      paper({ label: 'Second', year: 2024, month: 12 }),
    ]);

    expect(
      entries.map(({ paper: { label }, side, gridColumn, newYear }) => [label, side, gridColumn, newYear])
    ).toEqual([
      ['First', 'above', '1 / span 4', 2024],
      ['Second', 'below', '3 / span 4', undefined],
      ['Third', 'above', '5 / span 4', 2025],
      ['Fourth', 'below', '7 / span 4', undefined],
    ]);
  });

  it('fits every card into the grid, with cards on the same side of the axis never overlapping', () => {
    for (const count of [1, 2, 5, 9]) {
      const entries = layoutTimeline(Array.from({ length: count }, (_, i) => paper({ year: 2000 + i })));
      const spans = entries.map(({ gridColumn, side }) => {
        const start = Number(gridColumn.split(' / span ')[0]);
        return { side, start, end: start + Number(gridColumn.split(' / span ')[1]) };
      });

      for (const { start, end } of spans) {
        expect(start).toBeGreaterThanOrEqual(1);
        expect(end).toBeLessThanOrEqual(timelineColumnCount(count) + 1);
      }
      for (const [i, a] of spans.entries()) {
        for (const b of spans.slice(i + 1)) {
          if (a.side === b.side) expect(b.start).toBeGreaterThanOrEqual(a.end);
        }
      }
    }
  });
});

describe('static/data/meds_papers.yaml', () => {
  const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'meds_papers.yaml');
  const papers = parseMedsPapers(parse(fs.readFileSync(yamlPath, 'utf8')));

  it('lists the main MEDS papers, each with a distinct label and link', () => {
    expect(papers.length).toBeGreaterThanOrEqual(5);
    expect(new Set(papers.map(({ label }) => label)).size).toBe(papers.length);
    expect(new Set(papers.map(({ url }) => url)).size).toBe(papers.length);
  });

  it('links every paper over HTTPS', () => {
    for (const { url } of papers) {
      expect(new URL(url).protocol).toBe('https:');
    }
  });

  it('dates every paper to a month that has started, as only published papers are listed', () => {
    for (const { year, month } of papers) {
      expect(new Date(year, (month ?? 1) - 1).getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});
