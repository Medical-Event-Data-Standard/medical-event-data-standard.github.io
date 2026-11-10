import { describe, expect, it } from '@jest/globals';
import { countryName, datasetMap, describePlace } from './locations';
import type { DatasetLocations } from './types';

const CONFIG: DatasetLocations = {
  locations: [
    {
      institution: 'General Hospital',
      openalexId: 'I1',
      city: 'Boston',
      country: 'US',
      latitude: 42.3,
      longitude: -71.1,
      caveat: null,
      datasets: [
        { label: 'Big demo', source: 'https://physionet.org/content/big-demo/', caveat: null },
        { label: 'Big', source: 'https://physionet.org/content/big/', caveat: null },
      ],
    },
    {
      institution: 'Hospital Group',
      openalexId: 'I2',
      city: 'Madrid',
      country: 'ES',
      latitude: 40.4,
      longitude: -3.7,
      caveat: 'Several hospitals.',
      datasets: [{ label: 'Synthetic', source: 'https://www.example.org/s', caveat: 'Synthetic.' }],
    },
    {
      institution: 'Unshown Clinic',
      openalexId: 'I3',
      city: 'Bern',
      country: 'CH',
      latitude: 46.9,
      longitude: 7.4,
      caveat: null,
      datasets: [{ label: 'Elsewhere', source: 'https://example.org/e', caveat: null }],
    },
  ],
  unplaced: [
    { datasets: ['Spread demo', 'Spread'], reason: 'Many hospitals.', source: 'https://example.org/spread' },
    { datasets: ['Gone'], reason: 'Not shown.', source: 'https://example.org/gone' },
  ],
};

describe('countryName', () => {
  it('names a country by its ISO code, in English', () => {
    expect(countryName('US')).toBe('United States');
    expect(countryName('KR')).toBe('South Korea');
  });
});

describe('datasetMap', () => {
  it('places the shown datasets at their institutions, in the order of the page, and lists the rest', () => {
    const model = datasetMap(CONFIG, ['Big', 'Spread', 'Synthetic', 'Big demo', 'Spread demo', 'Unknown']);
    expect(model.places).toEqual([
      {
        name: 'General Hospital',
        location: { latitude: 42.3, longitude: -71.1 },
        weight: 1,
        where: 'Boston, United States',
        caveat: null,
        datasets: [CONFIG.locations[0].datasets[1], CONFIG.locations[0].datasets[0]],
      },
      expect.objectContaining({
        name: 'Hospital Group',
        where: 'Madrid, Spain',
        caveat: 'Several hospitals.',
      }),
    ]);
    expect(model.rows).toEqual([
      {
        dataset: 'Big',
        institution: 'General Hospital',
        where: 'Boston, United States',
        caveats: [],
        source: 'https://physionet.org/content/big/',
      },
      expect.objectContaining({ dataset: 'Synthetic', caveats: ['Several hospitals.', 'Synthetic.'] }),
      expect.objectContaining({ dataset: 'Big demo', source: 'https://physionet.org/content/big-demo/' }),
    ]);
    // Datasets the page doesn't show are left out, and so is an institution with none of them.
    expect(model.unplaced).toEqual([
      {
        datasets: ['Spread', 'Spread demo'],
        reason: 'Many hospitals.',
        source: 'https://example.org/spread',
      },
    ]);
    expect(model.unrecorded).toEqual(['Unknown']);
  });

  it('has nothing to show for no datasets', () => {
    expect(datasetMap(CONFIG, [])).toEqual({ places: [], unplaced: [], unrecorded: [], rows: [] });
  });
});

describe('describePlace', () => {
  it('names the institution, where it is and its datasets', () => {
    const [place] = datasetMap(CONFIG, ['Big', 'Big demo']).places;
    expect(describePlace(place)).toBe('General Hospital (Boston, United States): Big, Big demo');
  });
});
