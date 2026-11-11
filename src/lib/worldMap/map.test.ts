import { describe, expect, it } from '@jest/globals';
import {
  centreView,
  clusterSize,
  fitView,
  isInView,
  mapMarkers,
  MAX_ZOOM,
  panView,
  PIN_SIZE_PX,
  pinSize,
  project,
  viewBox,
  viewCentre,
  viewSize,
  WHOLE_MAP,
  zoomView,
} from './map';
import { WORLD_LAND_PATH } from './worldOutline';

const at = (latitude: number, longitude: number) => ({ latitude, longitude, city: null, country: null });

describe('the map projection', () => {
  it('places longitude on x and latitude, north up, on y, showing the whole world but Antarctica', () => {
    expect(project(at(52.4, 13.1))).toEqual({ x: 13.1, y: -52.4 });
    expect(viewBox(WHOLE_MAP)).toBe('-180 -84 360 142');
  });

  it('has a land outline made of closed paths within the map', () => {
    expect(WORLD_LAND_PATH).toMatch(/^M-?[\d.]+ -?[\d.]+l/);
    expect(WORLD_LAND_PATH.endsWith('z')).toBe(true);
    const starts = [...WORLD_LAND_PATH.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [+x, +y]);
    expect(starts.length).toBeGreaterThan(100);
    expect(starts.every(([x, y]) => Math.abs(x) <= 180 && y >= -84 && y <= 90)).toBe(true);
  });
});

describe('zooming and panning', () => {
  it('zooms in and out around a point that stays put, within the map', () => {
    const zoomed = zoomView(WHOLE_MAP, 2);
    expect(zoomed).toEqual({ x: -90, y: -84 + 142 / 4, zoom: 2 });
    expect(viewCentre(zoomed)).toEqual(viewCentre(WHOLE_MAP));
    expect(viewSize(2)).toEqual({ width: 180, height: 71 });

    // Zooming around New York keeps it at the same place in the view.
    const newYork = project(at(40.7, -74));
    const around = zoomView(WHOLE_MAP, 4, newYork);
    const share = (view: typeof around) => ({
      x: (newYork.x - view.x) / viewSize(view.zoom).width,
      y: (newYork.y - view.y) / viewSize(view.zoom).height,
    });
    expect(share(around).x).toBeCloseTo(share(WHOLE_MAP).x);
    expect(share(around).y).toBeCloseTo(share(WHOLE_MAP).y);

    expect(zoomView(WHOLE_MAP, 0.5)).toEqual(WHOLE_MAP);
    expect(zoomView(zoomView(WHOLE_MAP, 1000), 2).zoom).toBe(MAX_ZOOM);
  });

  it('pans and centres within the edges of the map', () => {
    const zoomed = zoomView(WHOLE_MAP, 4);
    expect(panView(zoomed, 10, -5)).toEqual({ ...zoomed, x: zoomed.x + 10, y: zoomed.y - 5 });
    expect(panView(zoomed, -1000, 1000)).toEqual({ x: -180, y: 58 - 142 / 4, zoom: 4 });
    expect(panView(WHOLE_MAP, 50, 50)).toEqual(WHOLE_MAP);

    const delhi = project(at(28.6, 77.2));
    expect(viewCentre(centreView(zoomed, delhi))).toEqual(delhi);
    // Near the edge, the point is as close to the centre as the map allows.
    expect(centreView(zoomed, project(at(80, 179))).x).toBe(180 - 90);
  });

  it('tells whether a point is in view, optionally away from the edges', () => {
    const view = centreView(zoomView(WHOLE_MAP, 4), { x: 0, y: -50 });
    expect(isInView(view, { x: 0, y: -50 })).toBe(true);
    expect(isInView(view, { x: 44, y: -50 })).toBe(true);
    expect(isInView(view, { x: 44, y: -50 }, 0.05)).toBe(false);
    expect(isInView(view, { x: 100, y: -50 })).toBe(false);
    expect(isInView(WHOLE_MAP, project(at(-70, 0)))).toBe(false);
  });
});

describe('mapMarkers', () => {
  const place = (name: string, weight: number, location: ReturnType<typeof at>) => ({
    name,
    location,
    weight,
  });
  const newYork = at(40.71427, -74.00597);
  const cambridge = at(42.3751, -71.10561);
  const places = [
    place('Columbia University', 5, newYork),
    place('Harvard University', 4, cambridge),
    place('New York University', 3, newYork),
    place('Massachusetts Institute of Technology', 2, cambridge),
    // 1.4 units from New York on the map.
    place('Yale University', 1, at(41.30815, -72.92816)),
    // 0.04 units from Cambridge.
    place('Tufts University', 1, at(42.41843, -71.10616)),
  ];
  const names = (markers: ReturnType<typeof mapMarkers>) =>
    markers.map(marker => marker.places.map(({ name }) => name));

  it('gives a place the marker of the first place with more weight closer than `near`', () => {
    expect(mapMarkers(places, 1)).toEqual([
      { location: newYork, places: [places[0], places[2]], weight: 8 },
      { location: cambridge, places: [places[1], places[3], places[5]], weight: 7 },
      { location: places[4].location, places: [places[4]], weight: 1 },
    ]);
    // Zoomed out further, New Haven joins New York.
    expect(names(mapMarkers(places, 2))).toEqual([
      ['Columbia University', 'New York University', 'Yale University'],
      ['Harvard University', 'Massachusetts Institute of Technology', 'Tufts University'],
    ]);
    // Zoomed in, only places at the same location share a marker.
    expect(names(mapMarkers(places, 0.01))).toEqual([
      ['Columbia University', 'New York University'],
      ['Harvard University', 'Massachusetts Institute of Technology'],
      ['Yale University'],
      ['Tufts University'],
    ]);
  });

  it("weighs a marker as asked, e.g. by its places' distinct papers", () => {
    expect(mapMarkers(places, 1, members => members.length).map(marker => marker.weight)).toEqual([2, 3, 1]);
  });

  it('measures from the marker, so that markers do not grow into chains', () => {
    // Middle is 0.8 from West and East; East is 1.6 from West.
    const chain = [place('West', 3, at(0, 0)), place('Middle', 2, at(0, 0.8)), place('East', 1, at(0, 1.6))];
    const markers = mapMarkers(chain, 1);
    expect(names(markers)).toEqual([['West', 'Middle'], ['East']]);
    expect(markers[1].location).toEqual(at(0, 1.6));
  });
});

describe('fitView', () => {
  it('zooms in on points so they take up half the view, centred on them', () => {
    const view = fitView([
      { x: 0, y: -50 },
      { x: 10, y: -45 },
    ]);
    // Limited by the height: 5 units of the map's 142.
    expect(view?.zoom).toBeCloseTo(142 / 10);
    expect(viewCentre(view!)).toEqual({ x: 5, y: -47.5 });
    // A tall spread is limited by the height, and points along a line by their one spread.
    expect(
      fitView([
        { x: 0, y: 0 },
        { x: 1, y: 20 },
      ])?.zoom
    ).toBeCloseTo(142 / 40);
    expect(
      fitView([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ])?.zoom
    ).toBe(MAX_ZOOM);
    expect(
      fitView([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ])?.zoom
    ).toBe(MAX_ZOOM);
  });

  it('gives nothing for points at one place, which no zoom separates', () => {
    expect(
      fitView([
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ])
    ).toBeNull();
    expect(fitView([{ x: 1, y: 2 }])).toBeNull();
  });
});

describe('clusterSize', () => {
  it('is wider for a two-digit number of places', () => {
    expect([clusterSize(2), clusterSize(9), clusterSize(10)]).toEqual([30, 30, 36]);
  });
});

describe('pinSize', () => {
  it('grows with the square root of the weight, between a smallest and a largest size', () => {
    expect(pinSize(1, 21)).toBe(PIN_SIZE_PX.min);
    expect(pinSize(21, 21)).toBe(PIN_SIZE_PX.max);
    expect(pinSize(40, 21)).toBe(PIN_SIZE_PX.max);
    expect(pinSize(6, 21)).toBe(Math.round(PIN_SIZE_PX.min + (PIN_SIZE_PX.max - PIN_SIZE_PX.min) / 2));
    expect(pinSize(1, 1)).toBe(PIN_SIZE_PX.min);
  });
});
