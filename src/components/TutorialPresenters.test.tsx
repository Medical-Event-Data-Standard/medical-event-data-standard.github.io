/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { TutorialPresenter, TutorialPresenters } from './TutorialPresenters';

// `@docusaurus/Link` is a webpack alias that only exists inside a Docusaurus build. This stand-in renders a
// plain anchor, marked so the tests can check that links are routed through Docusaurus' Link.
jest.mock(
  '@docusaurus/Link',
  () => {
    const { createElement, forwardRef } = jest.requireActual<typeof import('react')>('react');
    return {
      __esModule: true,
      default: forwardRef<HTMLAnchorElement, { to?: string; href?: string }>(({ to, href, ...props }, ref) =>
        createElement('a', { ...props, ref, href: to ?? href, 'data-docusaurus-link': true })
      ),
    };
  },
  { virtual: true }
);

describe('TutorialPresenter', () => {
  it("links the presenter's name to their page through Docusaurus Link", () => {
    render(
      <TutorialPresenter
        name="Jane Doe"
        affiliation="Example University"
        bio="Works on clinical ML."
        url="https://example.org/jane"
        photoUrl="/img/jane.jpg"
      />
    );
    const link = screen.getByRole('link', { name: 'Jane Doe' });
    expect(link).toHaveAttribute('href', 'https://example.org/jane');
    expect(link).toHaveAttribute('data-docusaurus-link');
    expect(screen.getByRole('img', { name: "Jane Doe's photo" })).toHaveAttribute('src', '/img/jane.jpg');
    expect(screen.getByText('Example University')).toBeInTheDocument();
    expect(screen.getByText('Works on clinical ML.')).toBeInTheDocument();
  });

  it('shows the name as plain text when there is no url', () => {
    render(<TutorialPresenter name="John Roe" affiliation="Example Lab" photoUrl="/img/john.jpg" />);
    expect(screen.getByText('John Roe')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('TutorialPresenters', () => {
  it('renders every presenter in the grid', () => {
    render(
      <TutorialPresenters>
        <TutorialPresenter name="Jane Doe" affiliation="Example University" photoUrl="/img/jane.jpg" />
        <TutorialPresenter name="John Roe" affiliation="Example Lab" photoUrl="/img/john.jpg" />
      </TutorialPresenters>
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('John Roe')).toBeInTheDocument();
  });
});
