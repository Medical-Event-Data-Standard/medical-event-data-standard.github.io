import type { CitingPaper, Paper } from './types';

/** Sort key: the publication date if known, else the year (sorting before dated papers that year). */
function dateKey(paper: Paper): string {
  return paper.publicationDate ?? (paper.year === null ? '' : String(paper.year));
}

export type SortOrder = 'newest' | 'oldest' | 'title';

const byTitle = (a: Paper, b: Paper): number =>
  a.title.localeCompare(b.title, 'en', { sensitivity: 'base', ignorePunctuation: true });

/**
 * Returns a sorted copy: newest or oldest first (undated papers last either way, ties broken by title), or by
 * title, A to Z.
 */
export function sortPapers<T extends Paper>(papers: readonly T[], order: SortOrder = 'newest'): T[] {
  const dated = (paper: Paper): boolean => dateKey(paper) !== '';
  return [...papers].sort((a, b) => {
    if (order === 'title') return byTitle(a, b) || dateKey(b).localeCompare(dateKey(a));
    if (dated(a) !== dated(b)) return dated(a) ? -1 : 1;
    const byDate = dateKey(a).localeCompare(dateKey(b));
    return (order === 'oldest' ? byDate : -byDate) || byTitle(a, b);
  });
}

/**
 * True if every whitespace-separated term of `query` occurs (case-insensitively) in the title, authors, venue or
 * institutions.
 */
export function matchesQuery(
  paper: Paper & Partial<Pick<CitingPaper, 'institutions'>>,
  query: string
): boolean {
  const haystack = [paper.title, ...paper.authors, paper.venue ?? '', ...(paper.institutions ?? [])]
    .join('\n')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every(term => haystack.includes(term));
}

export interface InstitutionCount {
  name: string;
  /** Number of papers with an author at the institution. */
  papers: number;
}

/** Every institution of the papers, with its number of papers: most papers first, then alphabetically. */
export function countInstitutions(papers: readonly Pick<CitingPaper, 'institutions'>[]): InstitutionCount[] {
  const counts = new Map<string, number>();
  for (const paper of papers) {
    for (const name of new Set(paper.institutions)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, papers: count }))
    .sort((a, b) => b.papers - a.papers || a.name.localeCompare(b.name));
}

/** Formats an author list, truncating long ones to the first `max` authors and "et al.". */
export function formatAuthors(authors: readonly string[], max = 6): string {
  if (authors.length <= max) return authors.join(', ');
  return `${authors.slice(0, max).join(', ')} et al.`;
}

/** Formats an ISO timestamp as e.g. "6 November 2026" (in UTC, so the server and browser render the same). */
export function formatDate(iso: string | null): string | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
