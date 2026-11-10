// Pure functions that turn Semantic Scholar and OpenAlex responses into the papers page's data. Used at build time
// by plugins/papers.ts; kept here, free of Node.js imports, so they can be unit-tested on their own.

import { sortPapers } from './display';
import type {
  CitingPaper,
  InstitutionLocation,
  InstitutionRecord,
  Paper,
  PapersData,
  SeedPaper,
} from './types';

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
  publicationDate?: string | null;
}

/** A work as returned by the OpenAlex API, limited to the fields we request. */
export interface OpenAlexWork {
  /** As a URL, e.g. `https://doi.org/10.1145/123`. */
  doi?: string | null;
  title?: string | null;
  authorships?:
    | {
        author?: { display_name?: string | null } | null;
        /** `id` is a URL, e.g. `https://openalex.org/I78577930`. */
        institutions?: { id?: string | null; display_name?: string | null }[] | null;
      }[]
    | null;
}

/** A seed paper as configured in static/data/papers.yaml. */
export interface SeedConfig {
  /** Semantic Scholar paperId. */
  id: string;
  label: string;
  /** Details shown instead of Semantic Scholar's, for seeds whose record there is wrong (e.g. a garbled title). */
  overrides?: PaperOverrides;
}

/** Details set in papers.yaml, shown instead of Semantic Scholar's. */
export type PaperOverrides = Partial<Pick<Paper, 'title' | 'authors' | 'venue' | 'year' | 'url'>>;

/** A paper in the `include` list of papers.yaml. */
export interface IncludeConfig {
  /** Identifier (see `paperMatchesId`). */
  id: string;
  /**
   * Details shown instead of Semantic Scholar's. With a `title`, the paper is listed from these details if
   * Semantic Scholar doesn't have it.
   */
  overrides?: PaperOverrides;
}

/** An entry of the `affiliations` list of papers.yaml: a paper's institutions, used instead of OpenAlex's. */
export interface AffiliationConfig {
  /** Identifier (see `paperMatchesId`). */
  id: string;
  institutions: string[];
}

/** An entry of the `institutions` list of papers.yaml. */
export interface InstitutionConfig {
  /** The institution's name, as OpenAlex or the `affiliations` list has it. */
  name: string;
  /** The name shown instead, e.g. the one the institution goes by. */
  rename?: string;
  /** Its homepage, used to find its icon if OpenAlex has none (or a wrong one). */
  homepage?: string;
  /** Shown on its own, although OpenAlex records it as part of another listed institution (see `rollUpInstitutions`). */
  separate?: boolean;
}

/** An entry of the `merge` list of papers.yaml: a record of the same work as another, listed as that one. */
export interface MergeConfig {
  /** Identifier (see `paperMatchesId`) of the record that is not listed. */
  id: string;
  /** Identifier of the record it is listed as. */
  into: string;
}

/** The parsed contents of static/data/papers.yaml. */
export interface PapersConfig {
  seeds: SeedConfig[];
  /** Papers to list even though they cite no seed. */
  include: IncludeConfig[];
  /** Identifiers of papers never to list, e.g. ones that cite MEDS without using it. */
  exclude: string[];
  /** Records that Semantic Scholar has of a work it also has another record of. */
  merge: MergeConfig[];
  /** Institutions of papers that OpenAlex has no (or wrong) affiliations for. */
  affiliations: AffiliationConfig[];
  /** Names and homepages of institutions, used instead of OpenAlex's. */
  institutions: InstitutionConfig[];
}

/** What a (possibly failed or partial) Semantic Scholar fetch returned. */
export interface LiveFetch {
  /** Seed metadata, by seed id. */
  seeds: Map<string, S2Paper>;
  /** Papers citing each seed, by seed id. */
  citations: Map<string, S2Paper[]>;
  /** Seeds whose citation list could not be fetched completely. */
  incompleteSeeds: Set<string>;
  /** Papers fetched for the `include` list, by identifier; null if Semantic Scholar doesn't have the paper. */
  included: Map<string, S2Paper | null>;
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
  };
}

/** The `Paper` fields of a paper, without any extra fields (like a citing paper's `cites`). */
function paperDetails(paper: Paper): Paper {
  const { id, title, authors, venue, year, publicationDate, doi, arxivId, url } = paper;
  return { id, title, authors, venue, year, publicationDate, doi, arxivId, url };
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

/**
 * A paper made from the details in papers.yaml alone, for papers Semantic Scholar doesn't have. Its id is the
 * (normalised) identifier from papers.yaml, and it links to the given `url`, else its DOI, arXiv or Semantic
 * Scholar page.
 */
export function paperFromDetails(identifier: string, details: PaperOverrides & { title: string }): Paper {
  const separator = identifier.indexOf(':');
  const prefix = separator === -1 ? null : identifier.slice(0, separator);
  const value = identifier.slice(separator + 1);
  const doi = prefix === 'DOI' ? value : null;
  const arxivId = prefix === 'ARXIV' ? value : null;
  return {
    id: identifier,
    authors: [],
    venue: null,
    year: null,
    publicationDate: null,
    doi,
    arxivId,
    url: doi
      ? `https://doi.org/${doi}`
      : arxivId
        ? `https://arxiv.org/abs/${arxivId}`
        : semanticScholarUrl(identifier),
    ...details,
  };
}

/** An included paper made from its details in papers.yaml, if they include a title; else null. */
const ownDetails = ({ id, overrides }: IncludeConfig): Paper | null =>
  overrides?.title ? paperFromDetails(id, { ...overrides, title: overrides.title }) : null;

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
 * filled in from the snapshot, since papers rarely stop citing something. An included paper that Semantic Scholar
 * doesn't have is listed from its details in papers.yaml. Papers citing several seeds are merged into one entry,
 * the seeds themselves are never listed as citing papers, and `exclude` is applied last.
 *
 * A record in the `merge` list is listed as the record it is merged into, which then cites every seed either cites
 * (and counts as added by hand if either is). If that record isn't listed, the merged one is listed as it is.
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
    return { ...paperFromDetails(id, { title: label, ...overrides }), label };
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
      // Institutions are added afterwards, by `attachInstitutions`.
      papers.set(paper.id, {
        ...paperDetails(paper),
        cites: [...cites],
        ...(manual ? { manual: true } : {}),
        institutions: [],
      });
    }
  };

  // Live data first, so that it wins over the snapshot's copy of the same paper.
  for (const { id } of config.seeds) {
    for (const raw of live.citations.get(id) ?? []) add(normalizePaper(raw), [id], false);
  }
  for (const include of config.include) {
    const raw = live.included.get(include.id);
    // A paper Semantic Scholar doesn't have is listed from its details in papers.yaml, if they include a title.
    add(raw === null ? ownDetails(include) : normalizePaper(raw), [], true);
  }

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
  for (const include of config.include) {
    const raw = live.included.get(include.id);
    if (raw || (raw === null && include.overrides?.title)) continue;
    // Not fetched (or not on Semantic Scholar, with no title to list it by): use the snapshot's copy, else
    // whatever details papers.yaml gives.
    const saved = snapshot?.papers.find(paper => paperMatchesId(paper, include.id));
    add(saved ?? ownDetails(include), [], true);
    if (saved) fromSnapshot.push(`included paper ${include.id}`);
    else if (!include.overrides?.title) missing.push(`included paper ${include.id}`);
  }
  // An included paper's details in papers.yaml win over Semantic Scholar's and the snapshot's.
  for (const { id: identifier, overrides } of config.include) {
    if (!overrides) continue;
    for (const paper of papers.values()) {
      if (paperMatchesId(paper, identifier)) Object.assign(paper, overrides);
    }
  }
  for (const { id, into } of config.merge) {
    const all = [...papers.values()];
    const kept = all.find(paper => paperMatchesId(paper, into) && !paperMatchesId(paper, id));
    if (!kept) continue;
    for (const paper of all.filter(paper => paper !== kept && paperMatchesId(paper, id))) {
      kept.cites = [...new Set([...kept.cites, ...paper.cites])];
      if (paper.manual) kept.manual = true;
      papers.delete(paper.id);
    }
  }

  const seedIds = new Set([...config.seeds.map(seed => seed.id), ...seeds.map(seed => seed.id)]);
  const seedOrder = (id: string): number => config.seeds.findIndex(seed => seed.id === id);
  const listed = [...papers.values()]
    .filter(paper => !seedIds.has(paper.id))
    .filter(paper => !config.exclude.some(identifier => paperMatchesId(paper, identifier)))
    .map(paper => ({ ...paper, cites: [...paper.cites].sort((a, b) => seedOrder(a) - seedOrder(b)) }));

  return { seeds, papers: sortPapers(listed), fromSnapshot, missing };
}

/** A function giving the name an institution is shown by: its `rename` in papers.yaml, else its own. */
export function institutionRenamer(institutions: readonly InstitutionConfig[]): (name: string) => string {
  const renames = new Map(institutions.flatMap(({ name, rename }) => (rename ? [[name, rename]] : [])));
  return name => renames.get(name) ?? name;
}

/** An institution as returned by the OpenAlex API, limited to the fields we request. */
export interface OpenAlexInstitution {
  /** A URL, e.g. `https://openalex.org/I97018004`. */
  id?: string | null;
  display_name?: string | null;
  /** URLs of the institution and of every institution it is part of. */
  lineage?: (string | null)[] | null;
  homepage_url?: string | null;
  geo?: {
    city?: string | null;
    country_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

/** An OpenAlex id without its URL prefix, e.g. `I97018004`. */
export const openAlexShortId = (id: string): string => id.replace(/^https?:\/\/openalex\.org\//i, '');

const coordinate = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max;

/** An OpenAlex institution as the page records it, and its homepage; null if it has no id. */
export function institutionRecord(
  raw: OpenAlexInstitution | null | undefined
): { record: InstitutionRecord; homepage: string | null } | null {
  const url = cleanText(raw?.id);
  if (!raw || !url) return null;
  const id = openAlexShortId(url);
  const { latitude, longitude, city, country_code } = raw.geo ?? {};
  const lineage = (raw.lineage ?? []).flatMap(item => {
    const text = cleanText(item);
    return text ? [openAlexShortId(text)] : [];
  });
  return {
    record: {
      id,
      partOf: [...new Set(lineage)].filter(other => other !== id),
      location:
        coordinate(latitude, 90) && coordinate(longitude, 180)
          ? { latitude, longitude, city: cleanText(city), country: cleanText(country_code) }
          : null,
    },
    homepage: cleanText(raw.homepage_url),
  };
}

/**
 * What each institution among `names` is shown as, if not as itself: the other listed institutions that OpenAlex
 * records it as part of (its `lineage`), leaving out those that are themselves shown as others. For example,
 * "Stanford Medicine" is shown as "Stanford University" when both are listed. Institutions without a record, and
 * those in `separate`, are shown as themselves.
 */
export function rollUpInstitutions(
  names: Iterable<string>,
  records: Readonly<Record<string, InstitutionRecord>>,
  separate: ReadonlySet<string> = new Set()
): Map<string, string[]> {
  // The listed institutions that have a record, which is all that can be rolled up or rolled into.
  const recordOf = new Map(
    [...new Set(names)].flatMap(name => (records[name] ? [[name, records[name]] as const] : []))
  );
  const listed = [...recordOf.keys()];
  const nameOf = new Map([...recordOf].map(([name, record]) => [record.id, name]));
  const ancestors = (name: string): string[] =>
    (recordOf.get(name) as InstitutionRecord).partOf.flatMap(id => {
      const ancestor = nameOf.get(id);
      return ancestor && ancestor !== name ? [ancestor] : [];
    });
  const rolledUp = (name: string): boolean => !separate.has(name) && ancestors(name).length > 0;

  const shownAs = new Map<string, string[]>();
  for (const name of listed.filter(rolledUp)) {
    const top = ancestors(name).filter(ancestor => !rolledUp(ancestor));
    if (top.length > 0) shownAs.set(name, top);
  }
  return shownAs;
}

/**
 * The papers with their institutions as shown: rolled up into the institutions they are part of
 * (`rollUpInstitutions`, unless papers.yaml keeps them `separate`), then renamed as papers.yaml says, without
 * duplicates.
 */
export function showInstitutions(
  papers: readonly CitingPaper[],
  records: Readonly<Record<string, InstitutionRecord>>,
  institutions: readonly InstitutionConfig[]
): CitingPaper[] {
  const separate = new Set(institutions.filter(({ separate }) => separate).map(({ name }) => name));
  const shownAs = rollUpInstitutions(
    papers.flatMap(paper => paper.institutions),
    records,
    separate
  );
  const rename = institutionRenamer(institutions);
  return papers.map(paper => ({
    ...paper,
    institutions: [...new Set(paper.institutions.flatMap(name => shownAs.get(name) ?? [name]).map(rename))],
  }));
}

/**
 * Values given by institution name (e.g. homepages or locations from OpenAlex), for the shown institutions
 * `names`: each one's own value, else that of an institution papers.yaml renames to it.
 */
export function byShownName<T>(
  names: Iterable<string>,
  values: ReadonlyMap<string, T>,
  institutions: readonly InstitutionConfig[]
): Map<string, T> {
  const rename = institutionRenamer(institutions);
  const shown = new Set(names);
  const result = new Map<string, T>();
  for (const name of shown) if (values.has(name)) result.set(name, values.get(name) as T);
  for (const [name, value] of values) {
    const as = rename(name);
    if (as !== name && shown.has(as) && !result.has(as)) result.set(as, value);
  }
  return result;
}

/** The locations of the shown institutions `names`, from their records (see `byShownName`); those without one are left out. */
export function institutionLocations(
  names: Iterable<string>,
  records: Readonly<Record<string, InstitutionRecord>>,
  institutions: readonly InstitutionConfig[]
): Record<string, InstitutionLocation> {
  const locations = new Map(
    Object.entries(records).flatMap(([name, { location }]) => (location ? [[name, location]] : []))
  );
  return Object.fromEntries(byShownName(names, locations, institutions));
}

/** The DOI OpenAlex knows a paper by: its own DOI, else the DOI arXiv assigns it; in lower case. */
export function openAlexDoi(paper: Paper): string | null {
  if (paper.doi) return paper.doi.toLowerCase();
  return paper.arxivId ? `10.48550/arxiv.${paper.arxivId.toLowerCase()}` : null;
}

/** A DOI as OpenAlex gives it (`https://doi.org/10.1/X`) without its URL prefix, in lower case. */
export function doiFromUrl(doi: string | null | undefined): string | null {
  const text = cleanText(doi);
  return text ? text.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase() : null;
}

/** The institutions of a work's authors, without duplicates, in author order: their names and OpenAlex ids. */
export function institutionRecordsOfWork(
  work: OpenAlexWork | null | undefined
): { name: string; id: string | null }[] {
  const records = new Map<string, string | null>();
  for (const authorship of work?.authorships ?? []) {
    for (const institution of authorship?.institutions ?? []) {
      const name = cleanText(institution?.display_name);
      const url = cleanText(institution?.id);
      const id = url ? openAlexShortId(url) : null;
      if (name && !records.get(name)) records.set(name, id);
    }
  }
  return [...records].map(([name, id]) => ({ name, id }));
}

/** The names of the institutions of a work's authors, without duplicates, in author order. */
export function institutionsOfWork(work: OpenAlexWork | null | undefined): string[] {
  return institutionRecordsOfWork(work).map(({ name }) => name);
}

/**
 * The base name of an institution's icon in static/img/institutions, e.g. `columbia-university` (the file is
 * `columbia-university.png`, `.jpg`, `.gif` or `.ico`).
 */
export function institutionIconSlug(name: string): string {
  return normalizeText(name).replace(/ /g, '-') || 'institution';
}

const IMAGE_SIGNATURES: [string, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46, 0x38]],
  ['ico', [0x00, 0x00, 0x01, 0x00]],
];

/** SVG features that can run code or load other resources when the file is opened on its own. */
const UNSAFE_SVG =
  /<script|<foreignobject|\bon[a-z]+\s*=|javascript:|<iframe|<embed|<object|\bhref\s*=\s*(?!["']?#)/i;

/** The file extensions an institution's icon can have. */
export const ICON_EXTENSIONS = [...IMAGE_SIGNATURES.map(([extension]) => extension), 'svg'];

/**
 * The extension of the image type of `bytes`, if it is one an icon can have: PNG, JPEG, GIF or ICO, or an SVG
 * without scripts, event handlers or links to other resources. Else null.
 */
export function iconExtension(bytes: Uint8Array): string | null {
  const match = IMAGE_SIGNATURES.find(([, signature]) => signature.every((byte, i) => bytes[i] === byte));
  if (match) return match[0];
  const text = new TextDecoder().decode(bytes.slice(0, 200_000));
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(text) &&
    !UNSAFE_SVG.test(text)
    ? 'svg'
    : null;
}

/**
 * The URLs of the icons a web page links to (`<link rel="icon">`, `apple-touch-icon` and the like), resolved
 * against `pageUrl`, best first: Apple touch icons (usually 180 pixels), then other icons, larger sizes first.
 * Data URLs and mask icons are left out.
 */
export function iconLinks(html: string, pageUrl: string): string[] {
  const attribute = (tag: string, name: string): string | null =>
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
      .exec(tag)
      ?.slice(1)
      .find(value => value !== undefined) ?? null;
  const links = (html.match(/<link\b[^>]*>/gi) ?? []).flatMap(tag => {
    const rel = attribute(tag, 'rel')?.toLowerCase() ?? '';
    const href = attribute(tag, 'href');
    if (!href || !/\bicon\b/.test(rel) || rel.includes('mask-icon') || /^\s*data:/i.test(href)) return [];
    let url: string;
    try {
      url = new URL(href.trim(), pageUrl).href;
    } catch {
      return [];
    }
    const size = Math.max(0, ...(attribute(tag, 'sizes') ?? '').split(/\s+/).map(s => parseInt(s, 10) || 0));
    return [{ url, apple: rel.includes('apple-touch-icon'), size }];
  });
  links.sort((a, b) => Number(b.apple) - Number(a.apple) || b.size - a.size);
  return [...new Set(links.map(({ url }) => url))];
}

/**
 * Text reduced to lower-case words, without accents, markup or punctuation: for comparing titles and names
 * loosely, and for OpenAlex's title search (whose filter syntax gives commas and colons a meaning).
 */
export function normalizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const surname = (name: string): string => {
  const words = normalizeText(name).split(' ');
  return words[words.length - 1];
};

/**
 * True if an OpenAlex work (found by searching for the paper's title) is the paper: it has the same title and, if
 * both list authors, shares an author's surname.
 */
export function isSameWork(paper: Paper, work: OpenAlexWork): boolean {
  const title = normalizeText(paper.title);
  if (!title || normalizeText(work.title ?? '') !== title) return false;
  const theirs = new Set(
    (work.authorships ?? [])
      .map(authorship => surname(authorship?.author?.display_name ?? ''))
      .filter(Boolean)
  );
  if (paper.authors.length === 0 || theirs.size === 0) return true;
  return paper.authors.some(name => theirs.has(surname(name)));
}

/**
 * Sets each paper's institutions: from the `affiliations` list of papers.yaml if it is there, else as fetched
 * from OpenAlex (`fetched`, by paper id), else from the snapshot. Also returns how many papers were neither in
 * papers.yaml nor fetched.
 */
export function attachInstitutions(
  papers: readonly CitingPaper[],
  affiliations: readonly AffiliationConfig[],
  fetched: ReadonlyMap<string, string[]>,
  snapshot: PapersData | null
): { papers: CitingPaper[]; notFetched: number } {
  let notFetched = 0;
  const withInstitutions = papers.map(paper => {
    const configured = affiliations.find(({ id }) => paperMatchesId(paper, id));
    const live = configured ? configured.institutions : fetched.get(paper.id);
    if (!live) notFetched++;
    const institutions = live ?? snapshot?.papers.find(saved => saved.id === paper.id)?.institutions ?? [];
    return { ...paper, institutions: [...institutions] };
  });
  return { papers: withInstitutions, notFetched };
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
  const isRecord = (record: unknown): boolean => {
    if (record === null || typeof record !== 'object') return false;
    const { id, partOf, location } = record as InstitutionRecord;
    return (
      typeof id === 'string' &&
      Array.isArray(partOf) &&
      (location === null ||
        (typeof location === 'object' &&
          coordinate(location.latitude, 90) &&
          coordinate(location.longitude, 180)))
    );
  };
  return (
    (data.updatedAt === null || typeof data.updatedAt === 'string') &&
    Array.isArray(data.seeds) &&
    data.seeds.every(isPaper) &&
    Array.isArray(data.papers) &&
    data.papers.every(
      paper =>
        isPaper(paper) &&
        Array.isArray((paper as CitingPaper).cites) &&
        Array.isArray((paper as CitingPaper).institutions)
    ) &&
    (data.institutions === undefined ||
      (data.institutions !== null &&
        typeof data.institutions === 'object' &&
        Object.values(data.institutions).every(isRecord)))
  );
}
