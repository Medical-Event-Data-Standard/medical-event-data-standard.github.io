/** @jest-environment jsdom */
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import InstitutionMap from './InstitutionMap';
import type { InstitutionCount } from '@site/src/lib/papers/display';
import type { InstitutionLocation } from '@site/src/lib/papers/types';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build.
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
    default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
  }),
  { virtual: true }
);
jest.mock(
  '@docusaurus/useBaseUrl',
  () => ({ __esModule: true, useBaseUrlUtils: () => ({ withBaseUrl: (url: string) => url }) }),
  { virtual: true }
);

const at = (latitude: number, longitude: number): InstitutionLocation => ({
  latitude,
  longitude,
  city: null,
  country: null,
});

// Far apart, so that none of these is clustered with another at the whole map's zoom: near the map's right and left
// edges, and near its top. Two polar institutions share a place, and ten labs share another.
const labs = Array.from({ length: 10 }, (_, i) => `Lab ${i}`);
const LOCATIONS: Record<string, InstitutionLocation> = {
  'Tokyo University': at(35.68, 139.69),
  'Honolulu Institute': at(21.31, -157.86),
  'Thule Station': at(76.53, -68.7),
  'Arctic Institute': at(78.22, 15.65),
  'Polar Institute': at(78.22, 15.65),
  ...Object.fromEntries(labs.map(lab => [lab, at(-1.29, 36.82)])),
};
const INSTITUTIONS: InstitutionCount[] = [
  ...Object.keys(LOCATIONS).map(name => ({ name, papers: 1 })),
  { name: 'Nowhere A', papers: 1 },
  { name: 'Nowhere B', papers: 1 },
];
const PAPERS = INSTITUTIONS.map(({ name }) => ({ institutions: [name] }));

/** The map, holding the selection as the papers page does. */
function Harness({ institutions = INSTITUTIONS }: { institutions?: InstitutionCount[] }): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <InstitutionMap
      institutions={institutions}
      locations={LOCATIONS}
      papers={PAPERS}
      icons={{}}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

const frame = () => screen.getByRole('group', { name: 'Map of the institutions' });
const map = () => within(frame());
const pin = (name: string) => map().queryByRole('button', { name: `${name}: 1 paper` });
const zoomOut = () => map().getByRole('button', { name: 'Zoom out' });

describe('InstitutionMap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('labels the selected institution wherever it is on the map', () => {
    render(<Harness />);

    // Near the right edge, near the left edge, and near the top (where the label goes below the pin).
    for (const name of ['Tokyo University', 'Honolulu Institute', 'Thule Station']) {
      fireEvent.click(pin(name) as HTMLElement);
      expect(pin(name)).toHaveAttribute('aria-pressed', 'true');
      expect(map().getByText(name)).toBeInTheDocument();
    }

    // In a cluster near the top, chosen from its menu, as zooming can't separate institutions at one place.
    fireEvent.click(
      map().getByRole('button', { name: /^2 institutions: Arctic Institute, Polar Institute$/ })
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /Polar Institute/ }));
    expect(map().getByText('Polar Institute')).toBeInTheDocument();

    // In a cluster in the middle of the map.
    fireEvent.click(map().getByRole('button', { name: /^10 institutions:/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Lab 3/ }));
    expect(map().getByText('Lab 3')).toBeInTheDocument();
  });

  it("lists at most eight of a cluster's institutions in its tooltip", async () => {
    render(<Harness />);
    fireEvent.mouseOver(map().getByRole('button', { name: /^10 institutions:/ }));
    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getAllByRole('listitem')).toHaveLength(9);
    expect(tooltip).toHaveTextContent('Lab 7: 1 paper');
    expect(tooltip).not.toHaveTextContent('Lab 8');
    expect(tooltip).toHaveTextContent('and 2 more');
  });

  it('closes the menu of a cluster without choosing anything', () => {
    render(<Harness />);
    fireEvent.click(map().getByRole('button', { name: /^2 institutions:/ }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(map().queryByText('Arctic Institute')).not.toBeInTheDocument();
  });

  it('says how many institutions have no location', () => {
    render(<Harness />);
    expect(
      screen.getByText(/2 of the 17 institutions have no location on OpenAlex and are not shown\./)
    ).toBeInTheDocument();
  });

  it('zooms around the pointer with Ctrl and the scroll wheel, or a double click on the background', () => {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
    } as DOMRect);
    render(<Harness />);

    // Scrolling without Ctrl scrolls the page, not the map.
    fireEvent.wheel(frame(), { deltaY: -100, clientX: 500, clientY: 250 });
    expect(zoomOut()).toBeDisabled();
    fireEvent.wheel(frame(), { ctrlKey: true, deltaY: -100, clientX: 500, clientY: 250 });
    expect(zoomOut()).toBeEnabled();
    fireEvent.click(map().getByRole('button', { name: 'Show the whole map' }));

    // A double click on a pin doesn't zoom; one on the background zooms around that point, here the top left,
    // which leaves Tokyo out of view.
    fireEvent.doubleClick(pin('Tokyo University') as HTMLElement);
    expect(zoomOut()).toBeDisabled();
    fireEvent.doubleClick(frame(), { clientX: 0, clientY: 0 });
    expect(zoomOut()).toBeEnabled();
    expect(pin('Tokyo University')).not.toBeInTheDocument();
  });

  it('zooms around the selected institution only while it is in view', () => {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
    } as DOMRect);
    render(<Harness />);
    fireEvent.click(pin('Tokyo University') as HTMLElement);

    // Zooming in keeps Tokyo in view.
    fireEvent.click(map().getByRole('button', { name: 'Zoom in' }));
    expect(pin('Tokyo University')).toBeInTheDocument();

    // Once it has been moved out of view, zooming is around the map's centre, and doesn't bring it back.
    fireEvent.pointerDown(frame(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 5000, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(frame(), { pointerId: 1 });
    expect(pin('Tokyo University')).not.toBeInTheDocument();
    fireEvent.click(map().getByRole('button', { name: 'Zoom in' }));
    expect(pin('Tokyo University')).not.toBeInTheDocument();
  });

  it('drags the map only when zoomed in, from its background', () => {
    render(<Harness />);
    const visible = () => map().getAllByRole('button', { name: /(papers?|institutions: .*)$/ }).length;
    const all = visible();

    // At the whole map's zoom there is nothing to drag, and moving the pointer alone does nothing.
    fireEvent.pointerDown(frame(), { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 5000, clientY: 0, pointerId: 1 });
    expect(visible()).toBe(all);
    fireEvent.pointerUp(frame(), { pointerId: 1 });

    fireEvent.click(map().getByRole('button', { name: 'Zoom in' }));
    const zoomed = visible();
    // Pressing on a marker doesn't start a drag.
    fireEvent.pointerDown(map().getByRole('button', { name: /^10 institutions:/ }), { pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 5000, clientY: 0, pointerId: 1 });
    expect(visible()).toBe(zoomed);
    // A drag captures the pointer, where the browser supports that, so it continues outside the map; a cancelled
    // drag stops moving the map.
    const setPointerCapture = jest.fn();
    frame().setPointerCapture = setPointerCapture;
    fireEvent.pointerDown(frame(), { clientX: 0, clientY: 0, pointerId: 1 });
    expect(setPointerCapture).toHaveBeenCalled();
    fireEvent.pointerCancel(frame(), { pointerId: 1 });
    fireEvent.pointerMove(frame(), { clientX: 5000, clientY: 0, pointerId: 1 });
    expect(visible()).toBe(zoomed);
  });

  it("follows the map's width as it is resized", () => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const observe = jest.fn();
    const disconnect = jest.fn();
    let resized: (entries: { contentRect: { width: number } }[]) => void = () => {};
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: typeof resized) {
        resized = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = jest.fn();
    } as unknown as typeof ResizeObserver;
    try {
      const { unmount } = render(<Harness />);
      expect(observe).toHaveBeenCalledWith(frame());

      // Narrower maps group institutions sooner: at 50 pixels wide, all but Honolulu are in one cluster.
      React.act(() => resized([{ contentRect: { width: 50 } }]));
      expect(map().getByRole('button', { name: /^14 institutions:/ })).toBeInTheDocument();
      // A width of zero (e.g. while hidden) is ignored.
      React.act(() => resized([{ contentRect: { width: 0 } }]));
      expect(map().getByRole('button', { name: /^14 institutions:/ })).toBeInTheDocument();

      unmount();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      globalThis.ResizeObserver = original;
    }
  });
});
