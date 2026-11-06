import axios from 'axios';
import { readOrFetchToCache } from './loadAndCache';

jest.mock('axios', () => ({ get: jest.fn() }));
const mockGet = jest.mocked(axios.get);

const URL = 'https://example.invalid/feed.json';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  mockGet.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('readOrFetchToCache', () => {
  it('caches a successful fetch and serves it while fresh', async () => {
    mockGet.mockResolvedValueOnce({ data: { value: 1 } });
    expect(await readOrFetchToCache(URL)).toEqual({ value: 1 });
    expect(await readOrFetchToCache(URL)).toEqual({ value: 1 });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed fetch and retries on the next call', async () => {
    mockGet.mockRejectedValueOnce(new Error('404'));
    expect(await readOrFetchToCache(URL)).toBeNull();
    expect(localStorage.getItem(URL)).toBeNull();

    mockGet.mockResolvedValueOnce({ data: { value: 2 } });
    expect(await readOrFetchToCache(URL)).toEqual({ value: 2 });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('retries when an older build cached a null result', async () => {
    localStorage.setItem(URL, JSON.stringify({ data: null, timestamp: Date.now() }));
    mockGet.mockResolvedValueOnce({ data: { value: 3 } });
    expect(await readOrFetchToCache(URL)).toEqual({ value: 3 });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('falls back to stale data when a refetch fails', async () => {
    localStorage.setItem(URL, JSON.stringify({ data: { value: 4 }, timestamp: 0 }));
    mockGet.mockRejectedValueOnce(new Error('offline'));
    expect(await readOrFetchToCache(URL)).toEqual({ value: 4 });
  });

  it('still returns fetched data when the cache cannot be written', async () => {
    jest.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    mockGet.mockResolvedValueOnce({ data: { value: 5 } });
    expect(await readOrFetchToCache(URL)).toEqual({ value: 5 });
  });
});
