import { loadMedsDevResults } from '../MEDS-DEV/load';

jest.mock('../loadAndCache', () => ({
  readOrFetchToCache: jest.fn(),
}));

import { readOrFetchToCache } from '../loadAndCache';

describe('loadMedsDevResults', () => {
  beforeEach(() => jest.resetAllMocks());

  it('parses results and assigns ids', async () => {
    (readOrFetchToCache as jest.Mock).mockResolvedValue({
      entry1: { dataset: 'd', task: 't', model: 'm', timestamp: '0', result: {}, version: '1' },
    });
    const res = await loadMedsDevResults();
    expect(res[0].id).toBe('entry1');
  });

  it('fixes NaN in string data', async () => {
    const raw =
      '{"e": {"dataset":"d","task":"t","model":"m","timestamp":"0","result":{"samples_equally_weighted":{"binary_accuracy":NaN}},"version":"1"}}';
    (readOrFetchToCache as jest.Mock).mockResolvedValue(raw);
    const res = await loadMedsDevResults();
    expect(res[0].result.samples_equally_weighted?.binary_accuracy).toBeNull();
  });
});
