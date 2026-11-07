/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import FeaturedPaper, { FEATURED_PAPER_LABEL } from '.';

// Jest cannot load CSS: give each class its own name, so the tests can check which classes are applied.
jest.mock(
  './styles.module.css',
  () => new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) })
);

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'meds_papers.yaml');
const medsPapersYaml: unknown = parse(fs.readFileSync(yamlPath, 'utf8'));

const rawPaper = (overrides: Record<string, unknown> = {}) => ({
  label: 'MEDS review',
  title: 'A Review of MEDS',
  venue: 'A Journal',
  year: 2026,
  month: 5,
  url: 'https://example.org/review',
  summary: 'What the review is.',
  ...overrides,
});

describe('FeaturedPaper', () => {
  afterEach(() => jest.restoreAllMocks());

  it('features the NEJM AI review of static/data/meds_papers.yaml, linking to it', () => {
    expect(FEATURED_PAPER_LABEL).toBe('MEDS review');
    render(<FeaturedPaper data={medsPapersYaml} />);

    // A section of the page, named by its heading: the paper's title as published (per Crossref).
    const title = 'MEDS — An Emerging Data Standard and Ecosystem for Health AI Research';
    const section = screen.getByRole('region', { name: title });
    expect(section.tagName).toBe('SECTION');
    const box = within(section);
    expect(box.getByRole('heading', { level: 2 })).toHaveTextContent(title);
    expect(box.getByText('Featured paper')).toBeInTheDocument();

    const date = box.getByText('May 2026');
    expect(date.tagName).toBe('TIME');
    expect(date).toHaveAttribute('dateTime', '2026-05');
    expect(date.parentElement).toHaveTextContent(/^NEJM AI · May 2026$/);
    expect(
      box.getByText('Matthew B. A. McDermott, Ethan Steinberg, Jason A. Fries, et al.')
    ).toBeInTheDocument();
    expect(
      box.getByText(
        'Describes MEDS in detail and reviews its adoption across institutions, datasets and models.'
      )
    ).toBeInTheDocument();

    const link = box.getByRole('link', { name: 'Read in NEJM AI' });
    expect(link).toHaveAttribute('href', 'https://doi.org/10.1056/AIra2501253');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('button', 'button--primary');
  });

  it('features the paper with the given label, leaving out the author line when the file has no authors', () => {
    render(
      <FeaturedPaper
        data={{ papers: [rawPaper({ label: 'MEDS' }), rawPaper({ label: 'Other', title: 'Another Paper' })] }}
        label="Other"
      />
    );

    const section = screen.getByRole('region', { name: 'Another Paper' });
    expect(
      within(section)
        .getAllByRole('paragraph')
        .map(({ textContent }) => textContent)
    ).toEqual(['Featured paper', 'A Journal · May 2026', 'What the review is.']);
    expect(within(section).getByRole('link', { name: 'Read in A Journal' })).toHaveAttribute(
      'href',
      'https://example.org/review'
    );
  });

  it('fails, naming the labels there are, when the featured paper is missing from the file', () => {
    // React logs the error it rethrows; keep the test output clean.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<FeaturedPaper data={{ papers: [rawPaper({ label: 'MEDS' })] }} />)).toThrow(
      'No paper labelled "MEDS review" in static/data/meds_papers.yaml; its labels are "MEDS".'
    );
  });
});
