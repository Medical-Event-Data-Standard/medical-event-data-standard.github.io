/** @jest-environment jsdom */
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import WorldMap from './WorldMap';
import type { MapPlace } from '@site/src/lib/worldMap/map';

// `@docusaurus/*` modules are webpack aliases that only exist inside a Docusaurus build.
jest.mock(
  '@docusaurus/Link',
  () => ({
    __esModule: true,
    default: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
  }),
  { virtual: true }
);

// The papers page's map (src/components/papers/InstitutionMap.test.tsx) covers zooming, dragging, clusters and
// labels; these cover what another page can leave out: icons, menu details and its own marker weights.
const boston = { latitude: 42.35, longitude: -71.1 };
const PLACES: MapPlace[] = [
  { name: 'Hospital A', location: boston, weight: 1 },
  { name: 'Hospital B', location: boston, weight: 1 },
  { name: 'Clinic C', location: { latitude: 37.43, longitude: -122.17 }, weight: 1 },
];

function Harness(): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <WorldMap
      id="test-map"
      label="Map of the places"
      places={PLACES}
      noun="places"
      describe={({ name }) => `${name}: somewhere`}
      selected={selected}
      onSelect={setSelected}
      caption="Pins mark places."
    />
  );
}

const map = () => within(screen.getByRole('group', { name: 'Map of the places' }));

describe('WorldMap', () => {
  it('shows places without icons or menu details, with pins of one size, and labels the selected one', async () => {
    const { container } = render(<Harness />);
    expect(container.querySelector('#test-map')).toBeInTheDocument();
    expect(screen.getByText(/^Pins mark places\. Land outline from/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Natural Earth' })).toHaveAttribute(
      'href',
      'https://www.naturalearthdata.com/'
    );

    // By default a marker weighs as much as its places together; every pin here stands for one place.
    const clinic = map().getByRole('button', { name: 'Clinic C: somewhere' });
    expect(clinic.querySelector('svg')?.style.fontSize).toBe('20px');
    fireEvent.mouseOver(clinic);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Clinic C: somewhere');
    expect(tooltip.querySelector('img, .MuiAvatar-root')).toBeNull();
    fireEvent.mouseLeave(clinic);

    fireEvent.click(clinic);
    expect(clinic).toHaveAttribute('aria-pressed', 'true');
    expect(map().getByText('Clinic C')).toBeInTheDocument();

    // Places at one location are a cluster that lists them, by name only.
    fireEvent.click(map().getByRole('button', { name: '2 places: Hospital A, Hospital B' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map(item => item.textContent)).toEqual(['Hospital A', 'Hospital B']);
    fireEvent.click(items[0]);
    expect(map().getByText('Hospital A')).toBeInTheDocument();
  });
});
