/** @jest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { usePluginData } from '@docusaurus/useGlobalData';

import PackageCard from './PackageCard';
import { EcosystemMetadata } from '@site/src/lib/ecosystem/types';

// `@docusaurus/useGlobalData` is a webpack alias that only exists inside a Docusaurus build.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
const mockUsePluginData = jest.mocked(usePluginData);

const metadata: EcosystemMetadata = {
  'org/repo': { stars: 42, lastUpdated: '2026-01-02T00:00:00Z', release: 'v1.0.0' },
};

describe('PackageCard', () => {
  beforeEach(() => mockUsePluginData.mockReset());

  it('shows the stars and release fetched at build time, plus links', () => {
    mockUsePluginData.mockReturnValue(metadata);
    render(
      <PackageCard
        pkg={{
          name: 'My Package',
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
    expect(screen.getByText('My Package')).toBeInTheDocument();
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
  });

  it('omits stars and release when no metadata was fetched for the repo', () => {
    mockUsePluginData.mockReturnValue(undefined);
    render(<PackageCard pkg={{ name: 'Bare Package', githubRepo: 'org/other' }} />);

    expect(screen.getByText('Bare Package')).toBeInTheDocument();
    expect(screen.queryByText(/stars/)).not.toBeInTheDocument();
    expect(screen.queryByText(/📦/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument();
  });
});
