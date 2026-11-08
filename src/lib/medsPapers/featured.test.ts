import { findMedsPaper } from './featured';
import { MedsPaper } from './timeline';

const paper = (label: string): MedsPaper => ({
  label,
  title: `The ${label} paper`,
  venue: 'A Venue',
  year: 2024,
  url: `https://example.org/${label}`,
  summary: `What ${label} is.`,
});

describe('findMedsPaper', () => {
  const papers = [paper('MEDS'), paper('MEDS review')];

  it('finds the paper with the given label', () => {
    expect(findMedsPaper(papers, 'MEDS review')).toBe(papers[1]);
    expect(findMedsPaper(papers, 'MEDS')).toBe(papers[0]);
  });

  it('fails on a missing label, naming the file and the labels there are', () => {
    expect(() => findMedsPaper(papers, 'MEDS-Tab')).toThrow(
      'No paper labelled "MEDS-Tab" in static/data/meds_papers.yaml; its labels are "MEDS", "MEDS review".'
    );
  });
});
