import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import { Box, IconButton, Menu, MenuItem, Paper, Tooltip, Typography, useTheme } from '@mui/material';
import { grey } from '@mui/material/colors';
import AddIcon from '@mui/icons-material/Add';
import PlaceIcon from '@mui/icons-material/Place';
import RemoveIcon from '@mui/icons-material/Remove';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import type { InstitutionCount } from '@site/src/lib/papers/display';
import {
  centreView,
  isInView,
  panView,
  type MapMarker,
  type MapPoint,
  type MapView,
  mapMarkers,
  MAX_ZOOM,
  CLUSTER_SPACING_PX,
  clusterSize,
  fitView,
  pinSize,
  project,
  viewBox,
  viewCentre,
  viewSize,
  WHOLE_MAP,
  zoomView,
} from '@site/src/lib/papers/map';
import type { CitingPaper, InstitutionLocation } from '@site/src/lib/papers/types';
import { WORLD_LAND_PATH } from '@site/src/lib/papers/worldOutline';
import InstitutionIcon from './InstitutionIcon';

const papersText = (count: number): string => `${count} paper${count === 1 ? '' : 's'}`;

/** The most institutions a marker's tooltip lists by name. */
const TOOLTIP_ROWS = 8;

/** The point on the map under a position on the screen, given the map's frame. */
function pointAt(frame: HTMLElement | null, view: MapView, clientX: number, clientY: number): MapPoint {
  const rect = frame?.getBoundingClientRect();
  const { width, height } = viewSize(view.zoom);
  if (!rect?.width || !rect.height) return viewCentre(view);
  return {
    x: view.x + ((clientX - rect.left) / rect.width) * width,
    y: view.y + ((clientY - rect.top) / rect.height) * height,
  };
}

/** The width of an element in pixels, kept up to date; 1000 until it is known (e.g. in tests). */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (element.clientWidth) setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * A zoomable world map of the institutions, each marked by a pin at its OpenAlex location; institutions close
 * together on the screen are grouped into a cluster, shown with their number. Hovering over a marker shows its
 * institutions and their numbers of papers. Selecting a pin selects its institution, as the chips do; selecting a
 * cluster zooms in on it, or, if that can't separate its institutions, opens a menu of them. The selected
 * institution's marker is highlighted and labelled, and the map moves to show it.
 */
export default function InstitutionMap({
  institutions,
  locations,
  papers,
  icons,
  selected,
  onSelect,
}: {
  /** Most papers first. */
  institutions: readonly InstitutionCount[];
  /** Location of each institution, by name. */
  locations: Readonly<Record<string, InstitutionLocation>>;
  papers: readonly Pick<CitingPaper, 'institutions'>[];
  /** URL path of each institution's icon, by name. */
  icons: Readonly<Record<string, string>>;
  selected: string | null;
  onSelect: (name: string | null) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const frame = useRef<HTMLDivElement>(null);
  const widthPx = useWidth(frame);
  const [view, setView] = useState<MapView>(WHOLE_MAP);
  const [menu, setMenu] = useState<{ anchor: Element; institutions: InstitutionCount[] } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const { width, height } = viewSize(view.zoom);
  const unitsPerPx = width / widthPx;
  const markers = useMemo(
    () => mapMarkers(institutions, locations, papers, CLUSTER_SPACING_PX * unitsPerPx),
    [institutions, locations, papers, unitsPerPx]
  );
  const most = Math.max(1, ...institutions.map(institution => institution.papers));
  const located = new Set(Object.keys(locations));
  const unplaced = institutions.filter(({ name }) => !located.has(name)).length;
  const selectedLocation = selected ? locations[selected] : undefined;

  // Move the map to the selected institution if it is out of view.
  useEffect(() => {
    if (!selectedLocation) return;
    const point = project(selectedLocation);
    setView(current => (isInView(current, point, 0.05) ? current : centreView(current, point)));
  }, [selectedLocation]);

  // A trackpad pinch, or Ctrl and the scroll wheel, zooms in or out around the pointer. The listener is added by
  // hand because React's wheel listeners can't stop the page from zooming or scrolling.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const onWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.01);
      setView(current => zoomView(current, factor, pointAt(element, current, event.clientX, event.clientY)));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const onBackground = (event: React.PointerEvent | React.MouseEvent): boolean =>
    !(event.target as Element).closest('button');

  const choose = (name: string): void => {
    setMenu(null);
    onSelect(name === selected ? null : name);
  };
  const open = (anchor: Element, marker: MapMarker): void => {
    if (marker.institutions.length === 1) return choose(marker.institutions[0].name);
    // A cluster zooms in on its institutions, or, if zooming can't separate them, offers a menu of them.
    const fitted = fitView(marker.institutions.map(({ name }) => project(locations[name])));
    if (fitted && fitted.zoom > view.zoom * 1.01) setView(fitted);
    else setMenu({ anchor, institutions: marker.institutions });
  };

  /** Where a point is in the frame, as percentages of its width and height. */
  const position = (point: MapPoint) => ({
    left: ((point.x - view.x) / width) * 100,
    top: ((point.y - view.y) / height) * 100,
  });
  const isActive = (marker: MapMarker): boolean => marker.institutions.some(({ name }) => name === selected);
  const shown = markers
    .filter(marker => isInView(view, project(marker.location)))
    // Markers further south are drawn over those further north, and the selected one over all others.
    .sort((a, b) => project(a.location).y - project(b.location).y)
    .sort((a, b) => Number(isActive(a)) - Number(isActive(b)));
  // How far a marker reaches above its location, in pixels: a pin's height, or a cluster's radius.
  const reach = (marker: MapMarker): number =>
    marker.institutions.length === 1
      ? pinSize(marker.papers, most)
      : clusterSize(marker.institutions.length) / 2;
  // The selected institution's marker, which may be a cluster, and so not at its own location.
  const activeMarker = shown.find(isActive);
  const label = activeMarker && position(project(activeMarker.location));
  // The label goes above the marker, unless there's no room for both there (about 32 pixels for the label).
  const heightPx = (widthPx * height) / width;
  const labelBelow = !!activeMarker && !!label && (label.top / 100) * heightPx < reach(activeMarker) + 40;

  return (
    <Box id="institution-map" sx={{ mt: 1.5 }}>
      <Box
        ref={frame}
        role="group"
        aria-label="Map of the institutions"
        onPointerDown={event => {
          if (view.zoom === 1 || !onBackground(event)) return;
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          const [dx, dy] = [event.clientX - drag.current.x, event.clientY - drag.current.y];
          drag.current = { x: event.clientX, y: event.clientY };
          setView(current => panView(current, -dx * unitsPerPx, -dy * unitsPerPx));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={event => {
          if (!onBackground(event)) return;
          const { clientX, clientY } = event;
          setView(current => zoomView(current, 2, pointAt(frame.current, current, clientX, clientY)));
        }}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          userSelect: 'none',
          cursor: view.zoom > 1 ? 'grab' : 'default',
          // When zoomed in, dragging moves the map rather than the page.
          touchAction: view.zoom > 1 ? 'none' : 'auto',
        }}
      >
        <svg viewBox={viewBox(view)} width="100%" style={{ display: 'block' }} aria-hidden="true">
          <path d={WORLD_LAND_PATH} fill={grey[300]} />
        </svg>

        {shown.map(marker => {
          const active = isActive(marker);
          const cluster = marker.institutions.length > 1;
          const { left, top } = position(project(marker.location));
          const listed = marker.institutions.slice(0, TOOLTIP_ROWS);
          const more = marker.institutions.length - listed.length;
          return (
            <Tooltip
              key={marker.institutions[0].name}
              // The marker keeps its own name; the tooltip describes it.
              describeChild
              disableInteractive
              title={
                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {listed.map(({ name, papers: count }) => (
                    <Box
                      component="li"
                      key={name}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.25 }}
                    >
                      <InstitutionIcon
                        name={name}
                        icon={icons[name]}
                        size={16}
                        sx={{ bgcolor: 'common.white' }}
                      />
                      {name}: {papersText(count)}
                    </Box>
                  ))}
                  {more > 0 && (
                    <Box component="li" sx={{ py: 0.25 }}>
                      and {more} more
                    </Box>
                  )}
                </Box>
              }
            >
              {cluster ? (
                <Box
                  component="button"
                  type="button"
                  aria-label={`${marker.institutions.length} institutions: ${marker.institutions
                    .map(({ name }) => name)
                    .join(', ')}`}
                  onClick={event => open(event.currentTarget, marker)}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: clusterSize(marker.institutions.length),
                    height: clusterSize(marker.institutions.length),
                  }}
                  sx={{
                    position: 'absolute',
                    transform: 'translate(-50%, -50%)',
                    p: 0,
                    border: 2,
                    borderColor: 'common.white',
                    borderRadius: '50%',
                    bgcolor: active ? 'error.main' : 'primary.main',
                    color: 'common.white',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.text.primary}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  {marker.institutions.length}
                </Box>
              ) : (
                <Box
                  component="button"
                  type="button"
                  aria-label={`${marker.institutions[0].name}: ${papersText(marker.institutions[0].papers)}`}
                  aria-pressed={active}
                  onClick={event => open(event.currentTarget, marker)}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  sx={{
                    position: 'absolute',
                    transform: 'translate(-50%, -100%)',
                    p: 0,
                    border: 0,
                    background: 'none',
                    lineHeight: 0,
                    cursor: 'pointer',
                    color: active ? 'error.main' : 'primary.main',
                    '& path': { stroke: theme.palette.common.white, strokeWidth: 1 },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.text.primary}`,
                      outlineOffset: 1,
                    },
                  }}
                >
                  <PlaceIcon style={{ fontSize: pinSize(marker.papers, most) }} sx={{ display: 'block' }} />
                </Box>
              )}
            </Tooltip>
          );
        })}

        {selected && activeMarker && label && (
          <Paper
            variant="outlined"
            aria-hidden="true"
            style={{ left: `${label.left}%`, top: `${label.top}%` }}
            sx={{
              position: 'absolute',
              // Above the pin, unless that would leave the map; kept inside it sideways.
              transform: `translate(${label.left > 75 ? '-100%' : label.left < 25 ? '0' : '-50%'}, ${
                labelBelow
                  ? `${activeMarker.institutions.length > 1 ? reach(activeMarker) + 4 : 6}px`
                  : `calc(-100% - ${reach(activeMarker) + 4}px)`
              })`,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              fontSize: '0.8125rem',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <InstitutionIcon name={selected} icon={icons[selected]} size={16} />
            {selected}
          </Paper>
        )}

        <Box
          sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
          {[
            {
              label: 'Zoom in',
              icon: <AddIcon fontSize="small" />,
              disabled: view.zoom >= MAX_ZOOM,
              factor: 2,
            },
            {
              label: 'Zoom out',
              icon: <RemoveIcon fontSize="small" />,
              disabled: view.zoom <= 1,
              factor: 0.5,
            },
          ].map(({ label: name, icon, disabled, factor }) => (
            <IconButton
              key={name}
              size="small"
              aria-label={name}
              disabled={disabled}
              onClick={() =>
                setView(current => {
                  // Around the selected institution while it is in view, so that it stays in view.
                  const point = selectedLocation && project(selectedLocation);
                  return zoomView(current, factor, point && isInView(current, point) ? point : undefined);
                })
              }
              sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              {icon}
            </IconButton>
          ))}
          {view.zoom > 1 && (
            <IconButton
              size="small"
              aria-label="Show the whole map"
              onClick={() => setView(WHOLE_MAP)}
              sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <ZoomOutMapIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {menu?.institutions.map(({ name, papers: count }) => (
          <MenuItem key={name} selected={name === selected} onClick={() => choose(name)} sx={{ gap: 1 }}>
            <InstitutionIcon name={name} icon={icons[name]} size={20} />
            {name}
            <Box component="span" sx={{ opacity: 0.7 }}>
              {count}
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Pins mark institutions at their OpenAlex locations; larger pins stand for more papers. Institutions
        less than {CLUSTER_SPACING_PX} pixels from one with at least as many papers are grouped into a circle
        that shows how many there are, at that institution&rsquo;s location. Select a circle to zoom in on it,
        or to choose from its institutions when zooming can&rsquo;t separate them. Zoom with the buttons, a
        double-click, or a trackpad pinch (or Ctrl and scroll); drag to move the map.
        {selected &&
          !selectedLocation &&
          ` ${selected} has no location on OpenAlex, so it is not on the map.`}
        {unplaced > 0 &&
          ` ${unplaced} of the ${institutions.length} institutions ${unplaced === 1 ? 'has' : 'have'} no location` +
            ` on OpenAlex and ${unplaced === 1 ? 'is' : 'are'} not shown.`}{' '}
        Land outline from <Link href="https://www.naturalearthdata.com/">Natural Earth</Link>.
      </Typography>
    </Box>
  );
}
