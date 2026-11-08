// Picks the paper featured on the home page (src/components/FeaturedPaper) from the main MEDS papers of
// static/data/meds_papers.yaml. The home page is rendered at build time, so a featured paper that is missing from
// the file fails the build instead of leaving an empty box.

import { MEDS_PAPERS_SOURCE, MedsPaper } from './timeline';

/** Returns the paper with the given label, or throws an error naming the labels there are. */
export function findMedsPaper(papers: readonly MedsPaper[], label: string): MedsPaper {
  const paper = papers.find(candidate => candidate.label === label);
  if (paper === undefined) {
    const labels = papers.map(candidate => JSON.stringify(candidate.label)).join(', ');
    throw new Error(
      `No paper labelled ${JSON.stringify(label)} in ${MEDS_PAPERS_SOURCE}; its labels are ${labels}.`
    );
  }
  return paper;
}
