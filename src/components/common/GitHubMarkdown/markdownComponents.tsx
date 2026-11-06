import React from 'react';
import Link from '@docusaurus/Link';
import Admonition from '@theme/Admonition';
import Heading from '@theme/Heading';

import { GitHubMarkdownSource, isExternalUrl, resolveMarkdownUrl } from '@site/src/lib/githubMarkdown/urls';
import { GitHubAlertType } from '@site/src/lib/githubMarkdown/tree';

type BlockquoteProps = React.ComponentProps<'blockquote'> & { 'data-github-alert'?: GitHubAlertType };
type HeadingProps = React.ComponentProps<'h2'>;

/** The elements of a rendered markdown file that are rendered by a custom component. */
export type MarkdownComponents = {
  a: React.FC<React.ComponentProps<'a'>>;
  img: React.FC<React.ComponentProps<'img'>>;
  blockquote: React.FC<BlockquoteProps>;
  h1: React.FC<HeadingProps>;
  h2: React.FC<HeadingProps>;
  h3: React.FC<HeadingProps>;
  h4: React.FC<HeadingProps>;
  h5: React.FC<HeadingProps>;
  h6: React.FC<HeadingProps>;
};

const heading = (as: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') => {
  const MarkdownHeading = (props: HeadingProps) => <Heading as={as} {...props} />;
  MarkdownHeading.displayName = `MarkdownHeading(${as})`;
  return MarkdownHeading;
};

// Headings and GitHub alerts render the way they do in the rest of the docs (with anchor links and as
// admonitions); neither depends on where the markdown file comes from.
const MarkdownBlockquote = ({ 'data-github-alert': alert, children, ...props }: BlockquoteProps) =>
  alert ? <Admonition type={alert}>{children}</Admonition> : <blockquote {...props}>{children}</blockquote>;

const headings = {
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  h5: heading('h5'),
  h6: heading('h6'),
};

/**
 * The components to render a markdown file from `source` with. Relative links and images in the file point to the
 * file on GitHub and its raw contents at `source.version` (see `resolveMarkdownUrl`); other links go through
 * Docusaurus' `Link`, opening in a new tab when they leave the site.
 */
export function createMarkdownComponents(source: GitHubMarkdownSource): MarkdownComponents {
  const MarkdownLink = ({ href, children, ...props }: React.ComponentProps<'a'>) => {
    const target = resolveMarkdownUrl(href, source, 'link');
    if (!target) return <span {...props}>{children}</span>;
    if (target.startsWith('#')) {
      return (
        <a href={target} {...props}>
          {children}
        </a>
      );
    }
    const newTab = isExternalUrl(target) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
    return (
      <Link to={target} {...newTab} {...props}>
        {children}
      </Link>
    );
  };

  const MarkdownImage = ({ src, alt, ...props }: React.ComponentProps<'img'>) => (
    <img src={resolveMarkdownUrl(src, source, 'image')} alt={alt ?? ''} {...props} />
  );

  return { a: MarkdownLink, img: MarkdownImage, blockquote: MarkdownBlockquote, ...headings };
}
