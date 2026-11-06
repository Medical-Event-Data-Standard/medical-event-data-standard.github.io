/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ContactsBlock, LinksBlock } from './EntityBlocks';

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

describe('LinksBlock', () => {
  it('lists each external link through Docusaurus Link', () => {
    const links = ['https://example.org/paper', 'https://example.org/code'];
    render(<LinksBlock links={links} />);
    expect(screen.getByRole('heading', { name: 'External Links' })).toBeInTheDocument();
    for (const url of links) {
      const link = screen.getByRole('link', { name: url });
      expect(link).toHaveAttribute('href', url);
      expect(link).toHaveAttribute('data-docusaurus-link');
    }
  });

  it('renders nothing without links', () => {
    const { container } = render(<LinksBlock links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ContactsBlock', () => {
  it("links each contact's GitHub profile through Docusaurus Link", () => {
    render(<ContactsBlock contacts={[{ name: 'Jane Doe', github_username: 'janedoe' }]} />);
    const link = screen.getByRole('link', { name: /Jane Doe \(janedoe\)/ });
    expect(link).toHaveAttribute('href', 'https://github.com/janedoe');
    expect(link).toHaveAttribute('data-docusaurus-link');
    expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute(
      'src',
      'https://github.com/janedoe.png?size=256'
    );
  });
});
