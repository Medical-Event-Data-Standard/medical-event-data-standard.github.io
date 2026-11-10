// Where the datasets on the dataset statistics page come from (static/data/dataset_locations.yaml), reduced to the
// datasets the page shows: the map's places, the datasets left off it, and a row per dataset for the table of
// sources. Kept free of React so it can be unit-tested.

import type { MapPlace } from '../worldMap/map';
import type { DatasetLocations, LocatedDataset } from './types';

/** A place on the map: an institution and the shown datasets from there. */
export interface DatasetPlace extends MapPlace {
  /** "Boston, United States". */
  where: string;
  caveat: string | null;
  datasets: LocatedDataset[];
}

/** One row of the table of sources. */
export interface LocationRow {
  dataset: string;
  institution: string;
  where: string;
  /** The location's caveat, then the dataset's, where there are any. */
  caveats: string[];
  source: string;
}

export interface DatasetMapModel {
  /** One per institution with a shown dataset, each of weight 1, so that every pin has the same size. */
  places: DatasetPlace[];
  /** Shown datasets left off the map on purpose, with why and the source of that. */
  unplaced: { datasets: string[]; reason: string; source: string }[];
  /** Shown datasets that the configuration doesn't mention. */
  unrecorded: string[];
  /** One per placed dataset, in the order of `labels`. */
  rows: LocationRow[];
}

const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/** A country's English name from its ISO 3166-1 alpha-2 code (which the configuration requires), e.g. `US`. */
export const countryName = (code: string): string => REGION_NAMES.of(code) as string;

/**
 * The map of the datasets with the given labels (those the page shows, in its order): their institutions, those left
 * off the map, and those the configuration doesn't mention. Datasets the page doesn't show are left out everywhere.
 */
export function datasetMap(config: DatasetLocations, labels: readonly string[]): DatasetMapModel {
  const shown = new Set(labels);
  const order = (label: string) => labels.indexOf(label);
  const places: DatasetPlace[] = config.locations.flatMap(location => {
    const datasets = location.datasets
      .filter(dataset => shown.has(dataset.label))
      .sort((a, b) => order(a.label) - order(b.label));
    if (datasets.length === 0) return [];
    return [
      {
        name: location.institution,
        location: { latitude: location.latitude, longitude: location.longitude },
        weight: 1,
        where: `${location.city}, ${countryName(location.country)}`,
        caveat: location.caveat,
        datasets,
      },
    ];
  });
  const unplaced = config.unplaced.flatMap(entry => {
    const datasets = entry.datasets.filter(label => shown.has(label)).sort((a, b) => order(a) - order(b));
    return datasets.length > 0 ? [{ datasets, reason: entry.reason, source: entry.source }] : [];
  });
  const rows = places
    .flatMap(place =>
      place.datasets.map(dataset => ({
        dataset: dataset.label,
        institution: place.name,
        where: place.where,
        caveats: [place.caveat, dataset.caveat].filter((caveat): caveat is string => caveat !== null),
        source: dataset.source,
      }))
    )
    .sort((a, b) => order(a.dataset) - order(b.dataset));
  const mentioned = new Set([...rows.map(row => row.dataset), ...unplaced.flatMap(entry => entry.datasets)]);
  return { places, unplaced, unrecorded: labels.filter(label => !mentioned.has(label)), rows };
}

/** A place's pin name and tooltip line: "Beth Israel Deaconess Medical Center (Boston, United States): MIMIC-IV". */
export const describePlace = (place: DatasetPlace): string =>
  `${place.name} (${place.where}): ${place.datasets.map(dataset => dataset.label).join(', ')}`;
