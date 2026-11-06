/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { createMarkdownComponents } from './markdownComponents';

// `@docusaurus/*` and `@theme/*` modules are webpack aliases that only exist inside a Docusaurus build. These
// stand-ins render plain elements, marked so the tests can check which component was used.
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
jest.mock(
  '@theme/Admonition',
  () => ({
    __esModule: true,
    default: ({ type, children }: React.PropsWithChildren<{ type: string }>) => (
      <div data-admonition={type}>{children}</div>
    ),
  }),
  { virtual: true }
);
jest.mock(
  '@theme/Heading',
  () => {
    const { createElement } = jest.requireActual<typeof import('react')>('react');
    return {
      __esModule: true,
      default: ({ as, ...props }: { as: string }) =>
        createElement(as, { ...props, 'data-theme-heading': true }),
    };
  },
  { virtual: true }
);

const components = createMarkdownComponents({ repo: 'Org/repo', version: '0.4.1', path: 'README.md' });
const { a: MarkdownLink, img: MarkdownImage, blockquote: MarkdownBlockquote } = components;

describe('the link renderer', () => {
  it('points relative links to the file on GitHub, in a new tab', () => {
    render(<MarkdownLink href="CONTRIBUTORS.md">contributors</MarkdownLink>);
    const link = screen.getByRole('link', { name: 'contributors' });
    expect(link).toHaveAttribute('href', 'https://github.com/Org/repo/blob/0.4.1/CONTRIBUTORS.md');
    expect(link).toHaveAttribute('data-docusaurus-link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves absolute links alone and opens them in a new tab', () => {
    render(
      <MarkdownLink href="https://pypi.org/project/meds/" title="PyPI">
        meds
      </MarkdownLink>
    );
    const link = screen.getByRole('link', { name: 'meds' });
    expect(link).toHaveAttribute('href', 'https://pypi.org/project/meds/');
    expect(link).toHaveAttribute('title', 'PyPI');
    expect(link).toHaveAttribute('data-docusaurus-link');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('keeps non-web links such as mailto in the current tab', () => {
    render(<MarkdownLink href="mailto:someone@example.org">mail us</MarkdownLink>);
    const link = screen.getByRole('link', { name: 'mail us' });
    expect(link).toHaveAttribute('href', 'mailto:someone@example.org');
    expect(link).not.toHaveAttribute('target');
  });

  it('renders in-page anchors as plain links', () => {
    render(<MarkdownLink href="#philosophy">Philosophy</MarkdownLink>);
    const link = screen.getByRole('link', { name: 'Philosophy' });
    expect(link).toHaveAttribute('href', '#philosophy');
    expect(link).not.toHaveAttribute('data-docusaurus-link');
    expect(link).not.toHaveAttribute('target');
  });

  it('renders the text of a link with an unsafe or missing URL without a link', () => {
    render(
      <>
        <MarkdownLink href="javascript:alert(1)">unsafe</MarkdownLink>
        <MarkdownLink>missing</MarkdownLink>
      </>
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('unsafe')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
  });
});

describe('the image renderer', () => {
  it('loads relative images from raw.githubusercontent at the shown version', () => {
    render(<MarkdownImage src="static/data_figure.svg" alt="The MEDS data schema" />);
    expect(screen.getByRole('img', { name: 'The MEDS data schema' })).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/Org/repo/0.4.1/static/data_figure.svg'
    );
  });

  it('leaves absolute image URLs alone', () => {
    render(<MarkdownImage src="https://img.shields.io/pypi/v/meds" alt="PyPI - Version" title="version" />);
    const img = screen.getByRole('img', { name: 'PyPI - Version' });
    expect(img).toHaveAttribute('src', 'https://img.shields.io/pypi/v/meds');
    expect(img).toHaveAttribute('title', 'version');
  });

  it('gives images without alt text an empty one', () => {
    const { container } = render(<MarkdownImage src="https://example.org/x.png" />);
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});

describe('the blockquote renderer', () => {
  it('renders GitHub alerts as admonitions', () => {
    render(<MarkdownBlockquote data-github-alert="important">Read this.</MarkdownBlockquote>);
    expect(screen.getByText('Read this.')).toHaveAttribute('data-admonition', 'important');
  });

  it('renders other blockquotes as blockquotes', () => {
    render(<MarkdownBlockquote cite="https://example.org">Quoted.</MarkdownBlockquote>);
    const quote = screen.getByText('Quoted.');
    expect(quote.tagName).toBe('BLOCKQUOTE');
    expect(quote).toHaveAttribute('cite', 'https://example.org');
  });
});

describe('the heading renderers', () => {
  it.each([1, 2, 3, 4, 5, 6] as const)('render h%i through the theme Heading, keeping the id', level => {
    const Heading = components[`h${level}`];
    render(<Heading id="philosophy">Philosophy</Heading>);
    const heading = screen.getByRole('heading', { level, name: 'Philosophy' });
    expect(heading).toHaveAttribute('id', 'philosophy');
    expect(heading).toHaveAttribute('data-theme-heading');
  });
});
