import axios from 'axios';

const BASE_URL = 'https://raw.githubusercontent.com/Medical-Event-Data-Standard/MEDS-DEV/_web';
const RESULTS_URL = `${BASE_URL}/results/all_results.json`;
const DATASETS_URL = `${BASE_URL}/entities/datasets.json`;
const MODELS_URL = `${BASE_URL}/entities/models.json`;
const TASKS_URL = `${BASE_URL}/entities/tasks.json`;

const CACHE_TTL_MS = 15 * 60 * 1000; // 0 mins — disabled cache

export enum MedsTarget {
  RESULTS = 'results',
  DATASETS = 'datasets',
  MODELS = 'models',
  TASKS = 'tasks',
}

type GenericResult = Record<string, unknown>;

async function fetchUrl<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await axios.get<T>(url);
    return res.data;
  } catch (err) {
    console.error(`Failed to fetch data from ${url}:`, err);
    return null;
  }
}

export async function fetchResults(): Promise<GenericResult[] | null> {
  const data = await fetchUrl<Record<string, GenericResult>>(RESULTS_URL);
  return data ? Object.entries(data).map(([id, result]) => ({ id, ...result })) : null;
}

export const fetchDatasets = (): Promise<GenericResult | null> => fetchUrl(DATASETS_URL);
export const fetchModels = (): Promise<GenericResult | null> => fetchUrl(MODELS_URL);
export const fetchTasks = (): Promise<GenericResult | null> => fetchUrl(TASKS_URL);

export async function fetchMedsDev(target: MedsTarget): Promise<unknown> {
  switch (target) {
    case MedsTarget.RESULTS:
      return fetchResults();
    case MedsTarget.DATASETS:
      return fetchDatasets();
    case MedsTarget.MODELS:
      return fetchModels();
    case MedsTarget.TASKS:
      return fetchTasks();
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

function readCache(key: string): { data: unknown | null; isFresh: boolean } {
  const cached = localStorage.getItem(key);
  if (!cached) return { data: null, isFresh: false };

  try {
    const { data, timestamp } = JSON.parse(cached);
    return {
      data,
      isFresh: Date.now() - timestamp < CACHE_TTL_MS,
    };
  } catch (err) {
    console.warn(`Cache read for ${key} failed: ${err}. Clearing...`);
    localStorage.removeItem(key);
    return { data: null, isFresh: false };
  }
}

export async function loadMedsDev(target: MedsTarget): Promise<unknown> {
  const cacheKey = `MEDS_DEV/${target}`;
  const { data, isFresh } = readCache(cacheKey);

  if (isFresh) return data;

  try {
    const result = await fetchMedsDev(target);
    localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
    return result;
  } catch (err) {
    console.warn(`Failed to fetch ${target}:`, err);
    if (data) {
      console.warn(`Using stale cached data for ${target}`);
      return data;
    }
    throw new Error(`Failed to fetch ${target} and no cached data available.`);
  }
}

