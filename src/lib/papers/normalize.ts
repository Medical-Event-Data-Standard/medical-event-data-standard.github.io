// Pure functions that turn Semantic Scholar responses into the papers page's data. Used at build time by
// plugins/papers.ts; kept here, free of Node.js imports, so they can be unit-tested on their own.

import { sortPapers } from './display';
import type { CitingPaper, Paper, PapersData, SeedPaper } from './types';

/** A paper as returned by the Semantic Scholar Graph API, limited to the fields we request. */
export interface S2Paper {
  paperId?: string | null;
  title?: string | null;
  year?: number | null;
  venue?: string | null;
  publicationVenue?: { name?: string | null } | null;
  authors?: { name?: string | null }[] | null;
  externalIds?: Record<string, string | number | null> | null;
  url?: string | null;
  citationCount?: number | null;
  publicationDate?: string | null;
}

/** A seed paper as configured in static/data/papers.yaml. */
export interface SeedConfig {
  /** Semantic Scholar paperId. */
  id: string;
  label: string;
  /** Details shown instead of Semantic Scholar's, for seeds whose record there is wrong (e.g. a garbled title). */
  overrides?: SeedOverrides;
}

export type SeedOverrides = Partial<Pick<Paper, 'title' | 'authors' | 'venue' | 'year' | 'url'>>;

/** The parsed contents of static/data/papers.yaml. */
export interface PapersConfig {
  seeds: SeedConfig[];
  /** Identifiers (see `paperMatchesId`) of papers to list even though they cite no seed. */
  include: string[];
  /** Identifiers of papers never to list, e.g. ones that cite MEDS without using it. */
  exclude: string[];
}

/** What a (possibly failed or partial) Semantic Scholar fetch returned. */
export interface LiveFetch {
  /** Seed metadata, by seed id. */
  seeds: Map<string, S2Paper>;
  /** Papers citing each seed, by seed id. */
  citations: Map<string, S2Paper[]>;
  /** Seeds whose citation list could not be fetched completely. */
  incompleteSeeds: Set<string>;
  /** Papers fetched for the `include` list, by identifier. */
  included: Map<string, S2Paper>;
}

export function emptyLiveFetch(): LiveFetch {
  return { seeds: new Map(), citations: new Map(), incompleteSeeds: new Set(), included: new Map() };
}

export const semanticScholarUrl = (paperId: string): string =>
  `https://www.semanticscholar.org/paper/${paperId}`;

const cleanText = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text || null;
};

/** Semantic Scholar names arXiv "arXiv.org"; everything else is shown as Semantic Scholar has it. */
function cleanVenue(paper: S2Paper): string | null {
  const venue = cleanText(paper.publicationVenue?.name) ?? cleanText(paper.venue);
  return venue === 'arXiv.org' ? 'arXiv' : venue;
}

/** Normalises a Semantic Scholar paper; returns null for records without an id or title, which we can't list. */
export function normalizePaper(raw: S2Paper | null | undefined): Paper | null {
  const id = cleanText(raw?.paperId);
  const title = cleanText(raw?.title);
  if (!raw || !id || !title) return null;

  const doi = cleanText(raw.externalIds?.DOI);
  const arxivId = cleanText(raw.externalIds?.ArXiv);
  const publicationDate = cleanText(raw.publicationDate);
  const year =
    typeof raw.year === 'number'
      ? raw.year
      : publicationDate
        ? Number(publicationDate.slice(0, 4)) || null
        : null;

  return {
    id,
    title,
    authors: (raw.authors ?? [])
      .map(author => cleanText(author?.name))
      .filter((name): name is string => !!name),
    venue: cleanVenue(raw),
    year,
    publicationDate,
    doi,
    arxivId,
    url: doi
      ? `https://doi.org/${doi}`
      : arxivId
        ? `https://arxiv.org/abs/${arxivId}`
        : (cleanText(raw.url) ?? semanticScholarUrl(id)),
    citationCount: typeof raw.citationCount === 'number' ? raw.citationCount : null,
  };
}

/** The `Paper` fields of a paper, without any extra fields (like a citing paper's `cites`). */
function paperDetails(paper: Paper): Paper {
  const { id, title, authors, venue, year, publicationDate, doi, arxivId, url, citationCount } = paper;
  return { id, title, authors, venue, year, publicationDate, doi, arxivId, url, citationCount };
}

/**
 * True if `identifier` (from papers.yaml) refers to `paper`. Identifiers are a Semantic Scholar paperId,
 * `DOI:<doi>` or `ARXIV:<arXiv id>` (prefixes and DOIs are case-insensitive; an arXiv version suffix is ignored).
 */
export function paperMatchesId(paper: Paper, identifier: string): boolean {
  const separator = identifier.indexOf(':');
  if (separator === -1) return paper.id === identifier.trim();
  const prefix = identifier.slice(0, separator).trim().toUpperCase();
  const value = identifier
    .slice(separator + 1)
    .trim()
    .toLowerCase();
  if (prefix === 'DOI') return paper.doi?.toLowerCase() === value;
  if (prefix === 'ARXIV') return paper.arxivId?.toLowerCase() === value.replace(/v\d+$/, '');
  return false;
}

export interface BuildResult {
  seeds: SeedPaper[];
  papers: CitingPaper[];
  /** Parts that were not fetched live and were filled in from the snapshot instead. */
  fromSnapshot: string[];
  /** Parts that were neither fetched live nor in the snapshot. */
  missing: string[];
}

/**
 * Combines a live fetch with the committed snapshot into the page's seeds and papers.
 *
 * Whatever was fetched live is used as is; anything that failed (a seed's metadata, a seed's citation list, an
 * included paper) is taken from the snapshot instead. A seed whose citation list came back empty is also
 * filled in from the snapshot, since papers rarely stop citing something. Papers citing several seeds are merged
 * into one entry, the seeds themselves are never listed as citing papers, and `exclude` is applied last.
 */
export function buildPapersData(
  config: PapersConfig,
  live: LiveFetch,
  snapshot: PapersData | null
): BuildResult {
  const fromSnapshot: string[] = [];
  const missing: string[] = [];

  const seeds: SeedPaper[] = config.seeds.map(({ id, label, overrides }) => {
    const fetched = normalizePaper(live.seeds.get(id));
    if (fetched) return { ...fetched, ...overrides, id, label };
    const saved = snapshot?.seeds.find(seed => seed.id === id);
    if (saved) {
      fromSnapshot.push(`details of ${label}`);
      return { ...paperDetails(saved), ...overrides, label };
    }
    missing.push(`details of ${label}`);
    return {
      id,
      label,
      title: label,
      authors: [],
      venue: null,
      year: null,
      publicationDate: null,
      doi: null,
      arxivId: null,
      url: semanticScholarUrl(id),
      citationCount: null,
      ...overrides,
    };
  });

  const papers = new Map<string, CitingPaper>();
  const add = (paper: Paper | null, cites: string[], manual: boolean): void => {
    if (!paper) return;
    const existing = papers.get(paper.id);
    if (existing) {
      existing.cites = [...new Set([...existing.cites, ...cites])];
      if (manual) existing.manual = true;
    } else {
      // Copy only the details, so a snapshot paper's own `cites`/`manual` are replaced rather than carried over.
      papers.set(paper.id, {
        ...paperDetails(paper),
        cites: [...cites],
        ...(manual ? { manual: true } : {}),
      });
    }
  };

  // Live data first, so that it wins over the snapshot's copy of the same paper.
  for (const { id } of config.seeds) {
    for (const raw of live.citations.get(id) ?? []) add(normalizePaper(raw), [id], false);
  }
  for (const identifier of config.include) add(normalizePaper(live.included.get(identifier)), [], true);

  for (const { id, label } of config.seeds) {
    const fetched = live.citations.get(id);
    const failed = !fetched || live.incompleteSeeds.has(id);
    if (!failed && fetched.length > 0) continue;
    const saved = snapshot?.papers.filter(paper => paper.cites.includes(id)) ?? [];
    saved.forEach(paper => add(paper, [id], false));
    // A seed in the snapshot with no citing papers there is known to have none, which is not "missing".
    if (failed || saved.length > 0) {
      const known = saved.length > 0 || !!snapshot?.seeds.some(seed => seed.id === id);
      (known ? fromSnapshot : missing).push(`papers citing ${label}`);
    }
  }
  for (const identifier of config.include) {
    if (live.included.has(identifier)) continue;
    const saved = snapshot?.papers.find(paper => paperMatchesId(paper, identifier));
    add(saved ?? null, [], true);
    (saved ? fromSnapshot : missing).push(`included paper ${identifier}`);
  }

  const seedIds = new Set([...config.seeds.map(seed => seed.id), ...seeds.map(seed => seed.id)]);
  const seedOrder = (id: string): number => config.seeds.findIndex(seed => seed.id === id);
  const listed = [...papers.values()]
    .filter(paper => !seedIds.has(paper.id))
    .filter(paper => !config.exclude.some(identifier => paperMatchesId(paper, identifier)))
    .map(paper => ({ ...paper, cites: [...paper.cites].sort((a, b) => seedOrder(a) - seedOrder(b)) }));

  return { seeds, papers: sortPapers(listed, 'newest'), fromSnapshot, missing };
}

/** Checks the shape of a parsed snapshot file, so a corrupt one is ignored rather than breaking the page. */
export function isPapersData(value: unknown): value is PapersData {
  if (value === null || typeof value !== 'object') return false;
  const data = value as Partial<PapersData>;
  const isPaper = (paper: unknown): boolean =>
    paper !== null &&
    typeof paper === 'object' &&
    typeof (paper as Paper).id === 'string' &&
    typeof (paper as Paper).title === 'string' &&
    Array.isArray((paper as Paper).authors);
  return (
    (data.updatedAt === null || typeof data.updatedAt === 'string') &&
    Array.isArray(data.seeds) &&
    data.seeds.every(isPaper) &&
    Array.isArray(data.papers) &&
    data.papers.every(paper => isPaper(paper) && Array.isArray((paper as CitingPaper).cites))
  );
}
