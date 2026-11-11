import React, { useCallback, useMemo } from 'react';
import WorldMap from '@site/src/components/common/WorldMap';
import type { InstitutionCount } from '@site/src/lib/papers/display';
import type { CitingPaper, InstitutionLocation } from '@site/src/lib/papers/types';
import { CLUSTER_SPACING_PX, type MapPlace } from '@site/src/lib/worldMap/map';
import InstitutionIcon from './InstitutionIcon';

const papersText = (count: number): string => `${count} paper${count === 1 ? '' : 's'}`;

/**
 * A zoomable world map of the institutions (see `WorldMap`), each marked by a pin at its OpenAlex location, larger
 * for more papers; institutions close together on the screen are grouped into a cluster, shown with their number.
 * Hovering over a marker shows its institutions and their numbers of papers. Selecting a pin selects its
 * institution, as the chips do.
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
  // Institutions without a location are left out.
  const places = useMemo<MapPlace[]>(
    () =>
      institutions.flatMap(({ name, papers: count }) =>
        locations[name] ? [{ name, location: locations[name], weight: count }] : []
      ),
    [institutions, locations]
  );
  // A pin's size is the number of papers with an author at any of its institutions.
  const weigh = useCallback(
    (members: MapPlace[]): number => {
      const names = new Set(members.map(({ name }) => name));
      return papers.filter(paper => paper.institutions.some(name => names.has(name))).length;
    },
    [papers]
  );
  const unplaced = institutions.length - places.length;

  return (
    <WorldMap
      id="institution-map"
      label="Map of the institutions"
      places={places}
      noun="institutions"
      describe={({ name, weight }) => `${name}: ${papersText(weight)}`}
      weigh={weigh}
      renderIcon={(name, size, inTooltip) => (
        <InstitutionIcon
          name={name}
          icon={icons[name]}
          size={size}
          sx={inTooltip ? { bgcolor: 'common.white' } : undefined}
        />
      )}
      menuDetail={({ weight }) => weight}
      selected={selected}
      onSelect={onSelect}
      caption={
        <>
          Pins mark institutions at their OpenAlex locations; larger pins stand for more papers. Institutions
          less than {CLUSTER_SPACING_PX} pixels from one with at least as many papers are grouped into a
          circle that shows how many there are, at that institution&rsquo;s location. Select a circle to zoom
          in on it, or to choose from its institutions when zooming can&rsquo;t separate them. Zoom with the
          buttons, a double-click, or a trackpad pinch (or Ctrl and scroll); drag to move the map.
          {selected &&
            !locations[selected] &&
            ` ${selected} has no location on OpenAlex, so it is not on the map.`}
          {unplaced > 0 &&
            ` ${unplaced} of the ${institutions.length} institutions ${unplaced === 1 ? 'has' : 'have'} no location` +
              ` on OpenAlex and ${unplaced === 1 ? 'is' : 'are'} not shown.`}
        </>
      }
    />
  );
}
