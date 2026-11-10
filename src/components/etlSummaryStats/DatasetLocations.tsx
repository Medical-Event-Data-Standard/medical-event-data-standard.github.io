import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import Heading from '@theme/Heading';
import { CLUSTER_SPACING_PX } from '@site/src/lib/worldMap/map';
import { type DatasetPlace, datasetMap, describePlace } from '@site/src/lib/etlSummaryStats/locations';
import type { DatasetLocations as DatasetLocationsConfig } from '@site/src/lib/etlSummaryStats/types';
import { COMPACT_TABLE, ExternalLink } from './parts';

// The map and its land outline are only loaded once it is shown.
const WorldMap = lazy(() => import('@site/src/components/common/WorldMap'));

const CONFIG_URL =
  'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/blob/main/static/data/dataset_locations.yaml';

/** "physionet.org": where a source link goes. */
const host = (url: string): string => new URL(url).hostname.replace(/^www\./, '');

/** The id of the map, for the button that shows it. */
const MAP_ID = 'dataset-map';

/**
 * Where the shown datasets come from: a button that shows a world map with a pin per source institution
 * (static/data/dataset_locations.yaml), the datasets left off it and why, and a table of each dataset's institution
 * and the documentation that names it.
 */
export default function DatasetLocations({
  id,
  title,
  config,
  labels,
}: {
  id: string;
  title: string;
  config: DatasetLocationsConfig;
  /** The labels of the datasets the page shows, in its order. */
  labels: string[];
}): React.JSX.Element {
  const [showMap, setShowMap] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const model = useMemo(() => datasetMap(config, labels), [config, labels]);
  const offMap = [
    ...model.unplaced.map(entry => ({
      label: entry.datasets.join(', '),
      reason: (
        <>
          {entry.reason} (<ExternalLink href={entry.source}>{host(entry.source)}</ExternalLink>)
        </>
      ),
    })),
    ...model.unrecorded.map(label => ({
      label,
      reason: <>No location is recorded for it.</>,
    })),
  ];

  return (
    <Box component="section" aria-labelledby={id} sx={{ mb: 5 }}>
      <Heading as="h2" id={id}>
        {title}
      </Heading>
      <p>
        The institution where each dataset&apos;s records were collected, as the dataset&apos;s own
        documentation (such as its PhysioNet page or paper) names it, recorded in{' '}
        <ExternalLink href={CONFIG_URL}>static/data/dataset_locations.yaml</ExternalLink>. The map has a pin
        for each institution, at its location on OpenAlex (or, where OpenAlex has none, at coordinates whose
        source the table below gives), listing its datasets: {model.rows.length} of the {labels.length}{' '}
        datasets shown, at {model.places.length} {model.places.length === 1 ? 'institution' : 'institutions'}.
      </p>
      {model.places.length > 0 && (
        <Button
          size="small"
          variant="outlined"
          // Like the page's toggle buttons.
          sx={{ textTransform: 'none' }}
          aria-expanded={showMap}
          aria-controls={showMap ? MAP_ID : undefined}
          onClick={() => setShowMap(!showMap)}
        >
          {showMap ? 'Hide map' : 'Show map'}
        </Button>
      )}
      {showMap && (
        <Suspense fallback={<Typography sx={{ mt: 1.5 }}>Loading the map&hellip;</Typography>}>
          <WorldMap
            id={MAP_ID}
            label="Map of where the datasets come from"
            places={model.places}
            noun="institutions"
            describe={place => describePlace(place as DatasetPlace)}
            selected={selected}
            onSelect={setSelected}
            caption={
              <>
                Each pin marks an institution at its OpenAlex location, or as the table below notes; hover
                over it for its datasets. Pins less than {CLUSTER_SPACING_PX} pixels apart are grouped into a
                circle that shows how many there are. Select a circle to zoom in on it, or to choose from its
                institutions when zooming can&rsquo;t separate them. Zoom with the buttons, a double-click, or
                a trackpad pinch (or Ctrl and scroll); drag to move the map.
              </>
            }
          />
        </Suspense>
      )}
      {offMap.length > 0 && (
        <Box sx={{ mt: 1, color: 'text.secondary', fontSize: '0.875rem' }}>
          <Typography variant="body2" component="p" sx={{ mb: 0.5 }}>
            Not on the map:
          </Typography>
          <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3 }}>
            {offMap.map(({ label, reason }) => (
              <li key={label}>
                <strong>{label}</strong>: {reason}
              </li>
            ))}
          </Box>
        </Box>
      )}
      {model.rows.length > 0 && (
        <Box component="details" sx={{ mt: 1 }}>
          <Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: '0.875rem' }}>
            Show the institutions and their sources
          </Box>
          <Box sx={{ ...COMPACT_TABLE, mt: 1, '& td': { whiteSpace: 'normal' } }}>
            <table aria-label={`${title}: institutions and sources`}>
              <thead>
                <tr>
                  {['Dataset', 'Institution', 'Location', 'Source'].map(column => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.rows.map(row => (
                  <tr key={row.dataset}>
                    <th scope="row">{row.dataset}</th>
                    <td>
                      {row.institution}
                      {row.caveats.map(caveat => (
                        <Box key={caveat} component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                          {caveat}
                        </Box>
                      ))}
                    </td>
                    <td>
                      {row.where}
                      {row.coordinatesSource && (
                        <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                          Coordinates from{' '}
                          <ExternalLink href={row.coordinatesSource}>
                            {host(row.coordinatesSource)}
                          </ExternalLink>
                        </Box>
                      )}
                    </td>
                    <td>
                      <ExternalLink href={row.source}>{host(row.source)}</ExternalLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>
      )}
    </Box>
  );
}
