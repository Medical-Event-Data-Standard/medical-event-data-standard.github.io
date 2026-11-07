import { packageMatchesSearch } from '@site/src/lib/ecosystem/search';
import { Package } from '@site/src/lib/ecosystem/types';

const hirid: Package = {
  name: 'HiRID',
  description: 'Converts HiRID, a high time-resolution ICU dataset from Bern University Hospital, into MEDS.',
};

describe('packageMatchesSearch', () => {
  it('matches every package when the query is empty or blank', () => {
    expect(packageMatchesSearch(hirid, '')).toBe(true);
    expect(packageMatchesSearch(hirid, '   ')).toBe(true);
    expect(packageMatchesSearch({ name: 'No description' }, '')).toBe(true);
  });

  it('matches the name or the description, ignoring case', () => {
    expect(packageMatchesSearch(hirid, 'hiri')).toBe(true);
    expect(packageMatchesSearch(hirid, 'bern')).toBe(true);
    expect(packageMatchesSearch(hirid, 'ICU DATASET')).toBe(true);
    expect(packageMatchesSearch(hirid, 'pediatric')).toBe(false);
  });

  it('needs every word of the query, wherever each one is', () => {
    expect(packageMatchesSearch(hirid, '  hirid  switzerland ')).toBe(false);
    expect(packageMatchesSearch(hirid, 'hirid bern icu')).toBe(true);
    expect(packageMatchesSearch(hirid, 'ICU bern')).toBe(true);
    expect(packageMatchesSearch(hirid, 'ICU zhejiang')).toBe(false);
  });

  it('matches only the name of a package without a description', () => {
    expect(packageMatchesSearch({ name: 'MEDS-DEV' }, 'meds dev')).toBe(true);
    expect(packageMatchesSearch({ name: 'MEDS-DEV' }, 'meds-dev')).toBe(true);
    expect(packageMatchesSearch({ name: 'MEDS-DEV' }, 'benchmark')).toBe(false);
  });
});
