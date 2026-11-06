/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import HomepageTimeline from '.';
import { formatPaperDate, parseMedsPapers, sortPapersByDate } from '@site/src/lib/medsPapers/timeline';

// Jest cannot load CSS: give each class its own name, so the tests can check which classes are applied.
jest.mock(
  './styles.module.css',
  () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })
);

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'meds_papers.yaml');
const medsPapersYaml: unknown = parse(fs.readFileSync(yamlPath, 'utf8'));

const listItems = () =>
  within(screen.getByRole('list', { name: 'Key MEDS papers, oldest first' })).getAllByRole('listitem');

describe('HomepageTimeline', () => {
  it('lists every paper of static/data/meds_papers.yaml in date order, linking to the paper', () => {
    render(<HomepageTimeline data={medsPapersYaml} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Key MEDS papers' })).toBeInTheDocument();
    const expected = sortPapersByDate(parseMedsPapers(medsPapersYaml));
    const items = listItems();
    expect(items).toHaveLength(expected.length);

    items.forEach((item, index) => {
      const paper = expected[index];
      const card = within(item);
      expect(card.getByRole('heading', { level: 3 })).toHaveTextContent(paper.label);
      expect(card.getByText(formatPaperDate(paper))).toBeInTheDocument();
      expect(card.getByText(paper.venue, { exact: false })).toBeInTheDocument();
      expect(card.getByText(paper.summary)).toBeInTheDocument();

      const link = card.getByRole('link');
      expect(link).toHaveAccessibleName(paper.title);
      expect(link).toHaveAttribute('href', paper.url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('places the papers in date order whatever their order in the file, alternating above and below the axis', () => {
    const paper = (label: string, year: number, month: number) => ({
      label,
      title: `The ${label} paper`,
      venue: 'A Venue',
      year,
      month,
      url: `https://example.org/${label}`,
      summary: `What ${label} is.`,
    });
    const { container } = render(
      <HomepageTimeline
        data={{ papers: [paper('ACES', 2025, 4), paper('MEDS', 2024, 5), paper('MEDS-Torch', 2024, 12)] }}
      />
    );

    const items = listItems();
    expect(items.map(item => within(item).getByRole('heading').textContent)).toEqual([
      'MEDS',
      'MEDS-Torch',
      'ACES',
    ]);
    expect(items.map(item => within(item).getByRole('link').getAttribute('href'))).toEqual([
      'https://example.org/MEDS',
      'https://example.org/MEDS-Torch',
      'https://example.org/ACES',
    ]);
    expect(items.map(item => item.querySelector('time')?.getAttribute('datetime'))).toEqual([
      '2024-05',
      '2024-12',
      '2025-04',
    ]);
    expect(items.map(item => item.className)).toEqual(['entry above', 'entry below', 'entry above']);
    expect(items.map(item => item.style.gridColumn)).toEqual(['1 / span 4', '3 / span 4', '5 / span 4']);

    // Each year is labelled once, on its first paper; the labels only repeat the cards' dates.
    const yearLabels = [...container.querySelectorAll('.year')];
    expect(yearLabels.map(label => label.textContent)).toEqual(['2024', '2025']);
    for (const label of yearLabels) expect(label).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('list').style.getPropertyValue('--timeline-columns')).toBe('8');
  });

  it('fails, naming the paper, when the data is invalid', () => {
    // React logs the error thrown while rendering; keep it out of the test output.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<HomepageTimeline data={{ papers: [{ label: 'MEDS' }] }} />)).toThrow(
      'Invalid entry in static/data/meds_papers.yaml at papers[0]'
    );
    consoleError.mockRestore();
  });
});
