// Parses, sorts and lays out the main MEDS papers of static/data/meds_papers.yaml for the timeline on the "Welcome
// to MEDS" page (src/components/MedsPapersTimeline); the home page's featured paper (src/components/FeaturedPaper)
// is parsed here too. The pages are rendered at build time, so the errors thrown below for malformed entries fail
// the build instead of silently dropping a paper.

/** One of the main MEDS papers. The field names follow the seeds of static/data/papers.yaml where they overlap. */
export interface MedsPaper {
  /** Short name shown on the timeline, e.g. "MEDS-DEV". */
  label: string;
  /** Full title, as published. */
  title: string;
  /** Where the paper was published: a journal, conference or workshop. */
  venue: string;
  year: number;
  /** 1-12; omitted when only the year is known. */
  month?: number;
  /** Link to the paper: its DOI, the publisher's page or its OpenReview page. */
  url: string;
  /** One line on what the paper is. */
  summary: string;
  /** Semantic Scholar paperId, as in static/data/papers.yaml. */
  id?: string;
  /** The authors' full names, in order, as published. */
  authors?: string[];
}

/** The file the papers are read from, for error messages. */
export const MEDS_PAPERS_SOURCE = 'static/data/meds_papers.yaml';

const STRING_FIELDS = ['label', 'title', 'venue', 'url', 'summary', 'id'] as const;
const REQUIRED_FIELDS = ['label', 'title', 'venue', 'year', 'url', 'summary'] as const;
const KNOWN_FIELDS: ReadonlySet<string> = new Set([...STRING_FIELDS, 'year', 'month', 'authors']);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Folded YAML strings can span several lines: collapse their whitespace. Anything but a string becomes ''.
const collapseWhitespace = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

function fail(path: string, message: string): never {
  throw new Error(`Invalid entry in ${MEDS_PAPERS_SOURCE} at ${path}: ${message}`);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function parsePaper(raw: unknown, path: string): MedsPaper {
  if (!isMapping(raw)) {
    fail(path, 'expected a paper: a mapping with a label, title, venue, year, url and summary.');
  }
  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) {
      fail(path, `unknown field "${key}"; expected only ${[...KNOWN_FIELDS].join(', ')}.`);
    }
  }
  for (const key of REQUIRED_FIELDS) {
    if (raw[key] === undefined || raw[key] === null) {
      fail(path, `"${key}" is missing.`);
    }
  }

  const strings: Partial<Record<(typeof STRING_FIELDS)[number], string>> = {};
  for (const key of STRING_FIELDS) {
    const value = raw[key];
    if (value === undefined) continue;
    const text = collapseWhitespace(value);
    if (!text) {
      fail(path, `"${key}" must be a non-empty string, got ${JSON.stringify(value)}.`);
    }
    strings[key] = text;
  }

  const { year, month } = raw;
  if (!Number.isInteger(year) || (year as number) < 1900 || (year as number) > 2999) {
    fail(path, `"year" must be a four-digit year, got ${JSON.stringify(year)}.`);
  }
  if (month !== undefined && (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12)) {
    fail(path, `"month" must be a number from 1 to 12, got ${JSON.stringify(month)}.`);
  }
  if (!isHttpUrl(strings.url as string)) {
    fail(path, `"url" must be an http(s) URL, got ${JSON.stringify(strings.url)}.`);
  }
  const authors = raw.authors === undefined ? undefined : parseAuthors(raw.authors, path);

  const paper: MedsPaper = {
    label: strings.label as string,
    title: strings.title as string,
    venue: strings.venue as string,
    year: year as number,
    url: strings.url as string,
    summary: strings.summary as string,
  };
  if (month !== undefined) paper.month = month as number;
  if (strings.id !== undefined) paper.id = strings.id;
  if (authors !== undefined) paper.authors = authors;
  return paper;
}

function parseAuthors(raw: unknown, path: string): string[] {
  const authors = Array.isArray(raw) ? raw.map(collapseWhitespace) : [];
  if (authors.length === 0 || authors.includes('')) {
    fail(path, `"authors" must be a non-empty list of names, got ${JSON.stringify(raw)}.`);
  }
  return authors;
}

/** Parses the contents of static/data/meds_papers.yaml: a mapping with a non-empty list of `papers`. */
export function parseMedsPapers(raw: unknown): MedsPaper[] {
  if (!isMapping(raw) || !Array.isArray(raw.papers) || raw.papers.length === 0) {
    throw new Error(`Invalid ${MEDS_PAPERS_SOURCE}: expected a mapping with a non-empty list of "papers".`);
  }
  return raw.papers.map((paper, index) => parsePaper(paper, `papers[${index}]`));
}

/**
 * Orders papers from oldest to newest. A paper whose month is unknown sorts before the dated papers of its year;
 * papers from the same month are ordered by label, so the order never depends on the order of the YAML file.
 */
export function comparePapersByDate(a: MedsPaper, b: MedsPaper): number {
  return a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || a.label.localeCompare(b.label);
}

/** Returns the papers sorted from oldest to newest, without changing the given list. */
export function sortPapersByDate(papers: readonly MedsPaper[]): MedsPaper[] {
  return [...papers].sort(comparePapersByDate);
}

/** The paper's date for people, e.g. "May 2024", or "2024" if its month is unknown. */
export function formatPaperDate({ year, month }: Pick<MedsPaper, 'year' | 'month'>): string {
  return month === undefined ? `${year}` : `${MONTH_NAMES[month - 1]} ${year}`;
}

/** The paper's date for a `<time dateTime>` attribute, e.g. "2024-05", or "2024" if its month is unknown. */
export function paperDateTime({ year, month }: Pick<MedsPaper, 'year' | 'month'>): string {
  return month === undefined ? `${year}` : `${year}-${String(month).padStart(2, '0')}`;
}

/** A paper's place on the timeline. */
export interface TimelineEntry {
  paper: MedsPaper;
  /** Side of the axis the paper's card is on in the horizontal (wide) timeline; alternates to avoid overlap. */
  side: 'above' | 'below';
  /** CSS `grid-column` of the paper's card in the horizontal timeline. */
  gridColumn: string;
  /** The year to label on the axis just before this paper: set for the first paper of each year. */
  newYear?: number;
}

/**
 * Number of grid columns of the horizontal timeline. The papers' markers are evenly spaced, two columns apart,
 * and each card spans the four columns centred on its marker. Cards on the same side of the axis are then four
 * columns apart, so they never overlap, and the two extra columns let the first and last cards stay centred.
 */
export function timelineColumnCount(paperCount: number): number {
  return 2 * paperCount + 2;
}

/** Sorts the papers from oldest to newest and places them on the timeline. */
export function layoutTimeline(papers: readonly MedsPaper[]): TimelineEntry[] {
  return sortPapersByDate(papers).map((paper, index, sorted) => {
    const entry: TimelineEntry = {
      paper,
      side: index % 2 === 0 ? 'above' : 'below',
      gridColumn: `${2 * index + 1} / span 4`,
    };
    if (index === 0 || sorted[index - 1].year !== paper.year) entry.newYear = paper.year;
    return entry;
  });
}
