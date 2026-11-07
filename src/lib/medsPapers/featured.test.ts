import { findMedsPaper, shortAuthorList } from './featured';
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

describe('shortAuthorList', () => {
  const authors = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Edsger Dijkstra'];

  it('names every author when there are at most three', () => {
    expect(shortAuthorList(authors.slice(0, 1))).toBe('Ada Lovelace');
    expect(shortAuthorList(authors.slice(0, 3))).toBe('Ada Lovelace, Alan Turing, Grace Hopper');
  });

  it('names the first three authors and "et al." when there are more', () => {
    expect(shortAuthorList(authors)).toBe('Ada Lovelace, Alan Turing, Grace Hopper, et al.');
  });

  it('names as many authors as asked for', () => {
    expect(shortAuthorList(authors, 1)).toBe('Ada Lovelace, et al.');
    expect(shortAuthorList(authors, 4)).toBe(authors.join(', '));
  });
});
