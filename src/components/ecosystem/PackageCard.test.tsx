/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import PackageCard from './PackageCard';
import { EcosystemPluginData } from '@site/src/lib/ecosystem/types';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
jest.mock('@docusaurus/useBaseUrl', () => ({ __esModule: true, default: (url: string) => `/base/${url}` }), {
  virtual: true,
});
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
    // MUI's Button passes a ref to the component it renders, like the real (forwardRef) Link expects.
    default: jest
      .requireActual('react')
      .forwardRef(
        (
          { to, children, ...props }: React.PropsWithChildren<{ to: string }>,
          ref: React.Ref<HTMLAnchorElement>
        ) => (
          <a ref={ref} href={to} {...props}>
            {children}
          </a>
        )
      ),
  }),
  { virtual: true }
);
const mockUsePluginData = jest.mocked(usePluginData);

const metadata: EcosystemPluginData = {
  repos: { 'org/repo': { stars: 42, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.0.0' } },
  logos: { org: 'img/ecosystem-logos/org.png' },
};

/** The `src` of the card's logo, which is its only image. */
const logoSrc = (container: HTMLElement): string | null | undefined =>
  container.querySelector('img')?.getAttribute('src');

describe('PackageCard', () => {
  beforeEach(() => mockUsePluginData.mockReset());

  it('shows the stars and release fetched at build time, plus links', () => {
    mockUsePluginData.mockReturnValue(metadata);
    render(
      <PackageCard
        pkg={{
          name: 'My Package',
          description: 'Does one useful thing with MEDS data.',
          githubRepo: 'Org/Repo',
          warn: 'Experimental',
          demoAvailable: true,
          docsUrl: 'https://docs.example.org',
          paperUrl: 'https://paper.example.org',
          pypiName: 'my-package',
        }}
      />
    );

    expect(mockUsePluginData).toHaveBeenCalledWith('ecosystem-metadata');
    expect(screen.getByRole('heading', { name: 'My Package' })).toBeInTheDocument();
    expect(screen.getByText('Does one useful thing with MEDS data.')).toBeInTheDocument();
    expect(screen.getByText('Experimental')).toBeInTheDocument();
    expect(screen.getByText(/Demo Available/)).toBeInTheDocument();
    expect(screen.getByText(/42 stars/)).toBeInTheDocument();
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/Org/Repo'
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://docs.example.org');
    expect(screen.getByRole('link', { name: 'Paper' })).toHaveAttribute('href', 'https://paper.example.org');
    expect(screen.getByRole('link', { name: 'PyPI' })).toHaveAttribute(
      'href',
      'https://pypi.org/project/my-package'
    );
    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('omits stars and release when no metadata was fetched for the repo', () => {
    mockUsePluginData.mockReturnValue(undefined);
    render(<PackageCard pkg={{ name: 'Bare Package', githubRepo: 'org/other' }} />);

    // Nothing but the name: no description, stars or release.
    expect(
      screen.getByRole('heading', { name: 'Bare Package' }).closest('.MuiCardContent-root')
    ).toHaveTextContent(/^Bare Package$/);
    expect(screen.queryByText(/stars/)).not.toBeInTheDocument();
    expect(screen.queryByText(/📦/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Data repository' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'MEDS-DEV' })).not.toBeInTheDocument();
  });

  it("shows the logo of the package's GitHub owner, served from the site, in the card's top right corner", () => {
    mockUsePluginData.mockReturnValue(metadata);
    const { container } = render(<PackageCard pkg={{ name: 'My Package', githubRepo: 'Org/Repo' }} />);

    const logo = container.querySelector('img')!;
    expect(logo).toHaveAttribute('src', '/base/img/ecosystem-logos/org.png');
    // Decorative, as the name says which package the card is for.
    expect(logo).toHaveAttribute('alt', '');
    // After the name, in the same row.
    const name = screen.getByRole('heading', { name: 'My Package' });
    expect(logo.parentElement).toBe(name.parentElement);
    expect(name.nextElementSibling).toBe(logo);
  });

  it('shows the MEDS logo when the owner has no logo, the package has no repo, or there is no metadata', () => {
    mockUsePluginData.mockReturnValue(metadata);
    const other = render(<PackageCard pkg={{ name: 'Other owner', githubRepo: 'someone/repo' }} />);
    expect(logoSrc(other.container)).toBe('/base/img/logo.svg');
    const noRepo = render(<PackageCard pkg={{ name: 'No repo' }} />);
    expect(logoSrc(noRepo.container)).toBe('/base/img/logo.svg');

    mockUsePluginData.mockReturnValue(undefined);
    const noData = render(<PackageCard pkg={{ name: 'No data', githubRepo: 'org/repo' }} />);
    expect(logoSrc(noData.container)).toBe('/base/img/logo.svg');
  });

  it('links a dataset to the page that distributes it, such as its PhysioNet project', () => {
    mockUsePluginData.mockReturnValue(metadata);
    render(
      <PackageCard
        pkg={{
          name: 'MIMIC-IV Demo',
          dataRepositoryUrl: 'https://physionet.org/content/mimic-iv-demo-meds/0.0.1/',
        }}
      />
    );

    const link = screen.getByRole('link', { name: 'Data repository' });
    expect(link).toHaveAttribute('href', 'https://physionet.org/content/mimic-iv-demo-meds/0.0.1/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links a package to its MEDS-DEV entity, within this site', () => {
    mockUsePluginData.mockReturnValue(metadata);
    render(
      <PackageCard
        pkg={{ name: 'CEHR-BERT', medsDev: { entityType: MedsEntityType.MODEL, name: 'cehrbert' } }}
      />
    );

    const link = screen.getByRole('link', { name: 'MEDS-DEV' });
    expect(link).toHaveAttribute('href', '/docs/MEDS-DEV/models');
    expect(link).toHaveAttribute('title', 'Select "cehrbert" on the MEDS-DEV models page');
    expect(link).not.toHaveAttribute('target');
  });
});
