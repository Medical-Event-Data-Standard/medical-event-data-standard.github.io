// The zoomable world map (src/components/common/WorldMap.tsx) that the papers page and the dataset statistics page
// share: its projection, zooming and panning, and where its pins go. Kept free of React so it can be unit-tested,
// and used by scripts/build-world-outline.ts for the map's extent.

/** A place on the earth, in degrees. */
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/** The latitudes and longitudes the map shows, in degrees: the whole world except Antarctica. */
export const MAP_BOUNDS = { north: 84, south: -58, west: -180, east: 180 } as const;

/** A point on the map: an equirectangular projection, with x the longitude and y minus the latitude. */
export interface MapPoint {
  x: number;
  y: number;
}

export const project = ({ latitude, longitude }: GeoLocation): MapPoint => ({
  x: longitude,
  y: -latitude,
});

const WHOLE = {
  x: MAP_BOUNDS.west,
  y: -MAP_BOUNDS.north,
  width: MAP_BOUNDS.east - MAP_BOUNDS.west,
  height: MAP_BOUNDS.north - MAP_BOUNDS.south,
};

/** The part of the map shown: its top left corner, in the units of `project`, and how far it is zoomed in. */
export interface MapView {
  x: number;
  y: number;
  zoom: number;
}

export const WHOLE_MAP: MapView = { x: WHOLE.x, y: WHOLE.y, zoom: 1 };
export const MAX_ZOOM = 32;

/** The width and height of the part of the map a view shows, in the units of `project`. */
export const viewSize = (zoom: number): { width: number; height: number } => ({
  width: WHOLE.width / zoom,
  height: WHOLE.height / zoom,
});

/** The SVG viewBox of a view. */
export const viewBox = ({ x, y, zoom }: MapView): string => {
  const { width, height } = viewSize(zoom);
  return [x, y, width, height].join(' ');
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** A view zoomed in no further than `MAX_ZOOM` and out no further than the whole map, and kept within it. */
function within({ x, y, zoom }: MapView): MapView {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const { width, height } = viewSize(z);
  return {
    x: clamp(x, WHOLE.x, WHOLE.x + WHOLE.width - width),
    y: clamp(y, WHOLE.y, WHOLE.y + WHOLE.height - height),
    zoom: z,
  };
}

/** The point at the centre of a view. */
export const viewCentre = (view: MapView): MapPoint => {
  const { width, height } = viewSize(view.zoom);
  return { x: view.x + width / 2, y: view.y + height / 2 };
};

/** A view zoomed in by `factor` (out if below 1), keeping `focus` where it is on the screen. */
export function zoomView(view: MapView, factor: number, focus: MapPoint = viewCentre(view)): MapView {
  const zoom = clamp(view.zoom * factor, 1, MAX_ZOOM);
  const scale = view.zoom / zoom;
  return within({ x: focus.x - (focus.x - view.x) * scale, y: focus.y - (focus.y - view.y) * scale, zoom });
}

/** A view moved by `dx` and `dy`, in the units of `project`. */
export const panView = (view: MapView, dx: number, dy: number): MapView =>
  within({ ...view, x: view.x + dx, y: view.y + dy });

/** A view with `point` at its centre, as far as the edges of the map allow. */
export const centreView = (view: MapView, point: MapPoint): MapView => {
  const { width, height } = viewSize(view.zoom);
  return within({ ...view, x: point.x - width / 2, y: point.y - height / 2 });
};

/** True if `point` is in the view, at least `margin` (a fraction of the view's size) from its edges. */
export function isInView(view: MapView, point: MapPoint, margin = 0): boolean {
  const { width, height } = viewSize(view.zoom);
  return (
    point.x >= view.x + width * margin &&
    point.x <= view.x + width * (1 - margin) &&
    point.y >= view.y + height * margin &&
    point.y <= view.y + height * (1 - margin)
  );
}

/** Something shown on the map, such as an institution: a pin of its own unless it is grouped with others. */
export interface MapPlace {
  /** Unique among the places; names it in labels, tooltips and menus. */
  name: string;
  location: GeoLocation;
  /** How much it stands for, e.g. a number of papers: places with more are drawn over others, and grouped first. */
  weight: number;
}

export interface MapMarker {
  /** Where the marker is: the location of its first place. */
  location: GeoLocation;
  /** The places it stands for, in the order given (largest weight first). */
  places: MapPlace[];
  /** What it stands for, which sets a pin's size: by default the sum of its places' weights. */
  weight: number;
}

/**
 * The map's markers. Places are taken in the order given, which must be largest weight first: each shares the marker
 * of the first place before it that is less than `near` away on the map (in the units of `project`), and otherwise
 * gets a marker of its own, at its location. `weigh` gives a marker's weight from its places, e.g. the number of
 * distinct papers of a group of institutions, which the sum of their papers would overcount.
 */
export function mapMarkers(
  places: readonly MapPlace[],
  near: number,
  weigh: (places: MapPlace[]) => number = members => members.reduce((sum, place) => sum + place.weight, 0)
): MapMarker[] {
  const pins: { location: GeoLocation; point: MapPoint; places: MapPlace[] }[] = [];
  for (const place of places) {
    const point = project(place.location);
    const pin = pins.find(other => Math.hypot(other.point.x - point.x, other.point.y - point.y) < near);
    if (pin) pin.places.push(place);
    else pins.push({ location: place.location, point, places: [place] });
  }
  return pins.map(({ location, places: members }) => ({ location, places: members, weight: weigh(members) }));
}

/**
 * A place is grouped with a place of at least its weight that is closer than this, in pixels: groups of several
 * places are shown as a cluster.
 */
export const CLUSTER_SPACING_PX = 40;

/** The diameter of a cluster's circle in pixels: larger from 10 places on, as its number gets wider. */
export const clusterSize = (institutions: number): number => (institutions < 10 ? 30 : 36);

/**
 * The view that fits all `points` with room to spare around them, centred on them; null if they are all at one
 * place, so that no zoom would separate them.
 */
export function fitView(points: readonly MapPoint[]): MapView | null {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const [width, height] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  if (!(width > 0 || height > 0)) return null;
  // The points take up at most half of the view's width and height.
  const zoom = Math.min(
    width ? WHOLE.width / (2 * width) : Infinity,
    height ? WHOLE.height / (2 * height) : Infinity
  );
  const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  return centreView(within({ ...WHOLE_MAP, zoom }), centre);
}

/** The height of the smallest and the largest pin, in pixels. */
export const PIN_SIZE_PX = { min: 20, max: 32 } as const;

/**
 * A pin's height in pixels: from `PIN_SIZE_PX.min` for a weight of 1 (e.g. one paper) to `PIN_SIZE_PX.max` for
 * `most` or more, growing with the square root of its weight.
 */
export function pinSize(weight: number, most: number): number {
  const share = most > 1 ? Math.sqrt(Math.min(1, Math.max(0, weight - 1) / (most - 1))) : 0;
  return Math.round(PIN_SIZE_PX.min + (PIN_SIZE_PX.max - PIN_SIZE_PX.min) * share);
}
