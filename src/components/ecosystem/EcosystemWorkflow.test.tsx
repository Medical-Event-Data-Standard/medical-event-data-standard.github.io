/** @jest-environment jsdom */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { parse } from 'yaml';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import EcosystemWorkflow from './EcosystemWorkflow';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { parseCategoryMap } from '@site/src/lib/ecosystem/utils';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build. The tiles' PackageCard
// uses them; without metadata, it shows no stars or releases.
jest.mock('@docusaurus/useGlobalData', () => ({ usePluginData: jest.fn() }), { virtual: true });
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
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

const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
const ecosystemYaml = parse(fs.readFileSync(yamlPath, 'utf8')) as Record<string, RawCategory>;

// jsdom does not lay out pages, so it has neither `scrollIntoView` nor `matchMedia`.
const scrollIntoView = jest.fn();
let media: { wide: boolean; reducedMotion: boolean };

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  media = { wide: true, reducedMotion: false };
  window.matchMedia = jest.fn((query: string) => ({
    matches:
      (query === '(min-width: 997px)' && media.wide) ||
      (query === '(prefers-reduced-motion: reduce)' && media.reducedMotion),
  })) as unknown as typeof window.matchMedia;
  window.history.replaceState(null, '', '/docs/intro_pages/ecosystem_workflow');
});

afterAll(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

/** The elements that `scrollIntoView` was called on, with its options. */
function scrolledIntoView(): [Element, ScrollIntoViewOptions][] {
  return scrollIntoView.mock.contexts.map((element, index) => [
    element as Element,
    scrollIntoView.mock.calls[index][0],
  ]);
}

const tiles = () => within(screen.getByRole('region', { name: 'Tools by step' }));
const flowchart = () => within(screen.getByRole('list', { name: 'Steps of the MEDS workflow' }));

describe('EcosystemWorkflow', () => {
  it('shows a tile for every tool, grouped by step, with the ids that the tools in the flowchart link to', () => {
    render(<EcosystemWorkflow data={ecosystemYaml} />);

    expect(tiles().getAllByRole('group')).toHaveLength(
      Object.keys(parseCategoryMap(ecosystemYaml).packages).length
    );
    expect(
      tiles()
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent)
    ).toEqual([
      'Convert your data to MEDS',
      'Explore and inspect',
      'Pre-process and load',
      'Define a prediction task',
      'Build models',
      'Evaluate',
      'Benchmark and share',
      'Across the workflow',
    ]);

    const aces = tiles().getByRole('group', { name: 'ACES' });
    expect(aces).toHaveAttribute('id', 'tool-aces');
    expect(aces).toHaveAttribute('tabindex', '-1');
    expect(within(aces).getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/justin13601/ACES'
    );

    // Every tool in the flowchart links to exactly one element: its tile.
    const chips = screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('#tool-'));
    expect(chips.length).toBeGreaterThan(50);
    for (const chip of chips) {
      const matches = document.querySelectorAll(`[id="${chip.getAttribute('href')!.slice(1)}"]`);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toHaveAccessibleName(chip.textContent!);
    }

    // Nothing is selected yet.
    expect(document.querySelector('[aria-current]')).toBeNull();
    expect(document.querySelector('[data-highlight]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the flowchart' })).not.toBeInTheDocument();
  });

  it("scrolls the tiles to a clicked tool's tile, highlights it and moves the focus to it", () => {
    render(<EcosystemWorkflow data={ecosystemYaml} />);
    const chip = flowchart().getByRole('link', { name: 'ACES' });
    const tile = tiles().getByRole('group', { name: 'ACES' });

    // The click is handled here, rather than by the browser.
    expect(fireEvent.click(chip)).toBe(false);

    // Beside the flowchart, the tiles scroll just enough to show the tile, leaving the page where it is.
    expect(scrolledIntoView()).toEqual([[tile, { behavior: 'smooth', block: 'nearest' }]]);
    expect(tile).toHaveFocus();
    expect(window.location.hash).toBe('#tool-aces');
    expect(chip).toHaveAttribute('aria-current', 'true');
    const highlight = tile.querySelector('[data-highlight]');
    expect(highlight).toBeInTheDocument();

    // Clicking the tool again plays the highlight again.
    fireEvent.click(chip);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(tile.querySelector('[data-highlight]')).not.toBe(highlight);
    expect(tile.querySelector('[data-highlight]')).toBeInTheDocument();

    // Selecting another tool moves the selection, and the highlight, to it.
    const tabular = flowchart().getByRole('link', { name: 'MEDS-Tab' });
    fireEvent.click(tabular);
    const tabularTile = tiles().getByRole('group', { name: 'MEDS-Tab' });
    expect(tabularTile).toHaveFocus();
    expect(window.location.hash).toBe('#tool-meds-tab');
    expect(tabular).toHaveAttribute('aria-current', 'true');
    expect(chip).not.toHaveAttribute('aria-current');
    expect(tile.querySelector('[data-highlight]')).toBeNull();
    expect(tabularTile.querySelector('[data-highlight]')).toBeInTheDocument();
  });

  it('below the flowchart, scrolls the page to the tile, which links back to the tool in the flowchart', () => {
    media.wide = false;
    render(<EcosystemWorkflow data={ecosystemYaml} />);
    const chip = flowchart().getByRole('link', { name: 'ACES' });
    const tile = tiles().getByRole('group', { name: 'ACES' });

    fireEvent.click(chip);
    expect(scrolledIntoView()).toEqual([[tile, { behavior: 'smooth', block: 'start' }]]);

    // Only the selected tile has a way back.
    expect(screen.getAllByRole('link', { name: 'Back to the flowchart' })).toHaveLength(1);
    const back = within(tile).getByRole('link', { name: 'Back to the flowchart' });
    // Without JavaScript, it goes to the top of the flowchart.
    expect(back).toHaveAttribute('href', '#ecosystem-flowchart');
    expect(document.getElementById('ecosystem-flowchart')).toContainElement(chip);

    scrollIntoView.mockClear();
    expect(fireEvent.click(back)).toBe(false);
    expect(scrolledIntoView()).toEqual([[chip, { behavior: 'smooth', block: 'center' }]]);
    expect(chip).toHaveFocus();
    // The tool stays selected.
    expect(window.location.hash).toBe('#tool-aces');
    expect(chip).toHaveAttribute('aria-current', 'true');
  });

  it('neither scrolls smoothly nor plays the highlight if reduced motion is preferred', () => {
    media.reducedMotion = true;
    media.wide = false;
    render(<EcosystemWorkflow data={ecosystemYaml} />);
    const chip = flowchart().getByRole('link', { name: 'ACES' });
    const tile = tiles().getByRole('group', { name: 'ACES' });

    fireEvent.click(chip);
    expect(scrolledIntoView()).toEqual([[tile, { behavior: 'auto', block: 'start' }]]);
    expect(tile).toHaveFocus();
    expect(chip).toHaveAttribute('aria-current', 'true');
    expect(tile.querySelector('[data-highlight]')).toBeNull();

    scrollIntoView.mockClear();
    fireEvent.click(within(tile).getByRole('link', { name: 'Back to the flowchart' }));
    expect(scrolledIntoView()).toEqual([[chip, { behavior: 'auto', block: 'center' }]]);
  });

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'])(
    'leaves a click with the %s held, such as to open a new tab, to the browser',
    modifier => {
      render(<EcosystemWorkflow data={ecosystemYaml} />);
      const chip = flowchart().getByRole('link', { name: 'ACES' });

      expect(fireEvent.click(chip, { [modifier]: true })).toBe(true);
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(window.location.hash).toBe('');
      expect(chip).not.toHaveAttribute('aria-current');
    }
  );

  it("selects the tool in the URL's hash when the page opens, and when the hash changes", () => {
    window.history.replaceState(null, '', '#tool-aces');
    const { unmount } = render(<EcosystemWorkflow data={ecosystemYaml} />);
    const aces = tiles().getByRole('group', { name: 'ACES' });

    // Scrolled into view at once, and without taking the focus from wherever it is.
    expect(scrolledIntoView()).toEqual([[aces, { behavior: 'auto', block: 'nearest' }]]);
    expect(aces).not.toHaveFocus();
    expect(flowchart().getByRole('link', { name: 'ACES' })).toHaveAttribute('aria-current', 'true');
    expect(aces.querySelector('[data-highlight]')).toBeInTheDocument();

    window.history.replaceState(null, '', '#tool-meds-tab');
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(scrolledIntoView()[1]).toEqual([
      tiles().getByRole('group', { name: 'MEDS-Tab' }),
      { behavior: 'auto', block: 'nearest' },
    ]);
    expect(flowchart().getByRole('link', { name: 'MEDS-Tab' })).toHaveAttribute('aria-current', 'true');

    // Other hashes, such as of a heading, are left alone.
    window.history.replaceState(null, '', '#ecosystem-flowchart');
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(flowchart().getByRole('link', { name: 'MEDS-Tab' })).toHaveAttribute('aria-current', 'true');

    unmount();
    window.history.replaceState(null, '', '#tool-aces');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('gives a tool listed at several steps one tile, at the first, which all its chips link to', () => {
    // Two categories listing a package of the same name are reported while parsing.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <EcosystemWorkflow
        data={{
          preprocessing: {
            name: 'Preprocessing',
            stage: 'preprocess',
            packages: [{ name: 'Shared tool', github_repo: 'org/shared' }],
          },
          modeling: {
            name: 'Modeling',
            stage: 'model',
            packages: [{ name: 'Model' }, { name: 'Shared tool', github_repo: 'org/shared' }],
          },
        }}
      />
    );
    warn.mockRestore();

    const chips = flowchart().getAllByRole('link', { name: 'Shared tool' });
    expect(chips.map(chip => chip.getAttribute('href'))).toEqual(['#tool-shared-tool', '#tool-shared-tool']);
    expect(document.querySelectorAll('[id="tool-shared-tool"]')).toHaveLength(1);
    expect(
      tiles()
        .getAllByRole('group')
        .map(tile => tile.id)
    ).toEqual(['tool-shared-tool', 'tool-model']);

    // Clicking the tool at its second step goes to its tile at the first.
    fireEvent.click(chips[1]);
    const tile = tiles().getByRole('group', { name: 'Shared tool' });
    expect(scrolledIntoView()).toEqual([[tile, { behavior: 'smooth', block: 'nearest' }]]);
    expect(tile).toHaveFocus();
    for (const chip of chips) expect(chip).toHaveAttribute('aria-current', 'true');
  });
});
