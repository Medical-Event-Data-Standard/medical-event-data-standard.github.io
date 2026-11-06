// Shared between the build-time `papers` plugin (plugins/papers.ts, Node.js) and the papers page (browser).

/** Name of the build-time plugin that collects papers citing MEDS; the page reads its data with `usePluginData`. */
export const PAPERS_PLUGIN = 'papers';

/** A paper's bibliographic details, normalised from Semantic Scholar. */
export interface Paper {
  /** Semantic Scholar paperId. */
  id: string;
  title: string;
  authors: string[];
  venue: string | null;
  year: number | null;
  /** `YYYY-MM-DD` when Semantic Scholar knows it; more precise than `year` for sorting. */
  publicationDate: string | null;
  doi: string | null;
  arxivId: string | null;
  /** Where the title links to: the DOI if there is one, else arXiv, else the Semantic Scholar page. */
  url: string;
  citationCount: number | null;
}

/** One of the core MEDS papers whose citations are listed. */
export interface SeedPaper extends Paper {
  /** Short name shown on chips, e.g. "ACES". */
  label: string;
}

/** A paper listed on the papers page. */
export interface CitingPaper extends Paper {
  /** Ids of the seed papers this paper cites, in the order the seeds are configured. */
  cites: string[];
  /** Listed because it is in the `include` list of papers.yaml (it may also cite a seed). */
  manual?: boolean;
}

/** The plugin's global data, and the format of static/data/papers.snapshot.json. */
export interface PapersData {
  /** ISO timestamp of the Semantic Scholar fetch the data comes from, or null if it was never fetched. */
  updatedAt: string | null;
  seeds: SeedPaper[];
  papers: CitingPaper[];
}
