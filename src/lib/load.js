import axios from 'axios';
import React, { useEffect, useState } from 'react';

const BASE_URL = 'https://raw.githubusercontent.com/Medical-Event-Data-Standard/MEDS-DEV/_web';
const RESULTS_URL = `${BASE_URL}/results/all_results.json`;
const DATASETS_URL = `${BASE_URL}/entities/datasets.json`;
const MODELS_URL = `${BASE_URL}/entities/models.json`;
const TASKS_URL = `${BASE_URL}/entities/tasks.json`;

const CACHE_TTL_MS = 0 * 60 * 1000; // 15 minutes

export const RESULTS = 'results';
export const DATASETS = 'datasets';
export const MODELS = 'models';
export const TASKS = 'tasks';

async function fetch_url(url) {
  return axios
    .get(url)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      console.error(`Failed to fetch data from ${url}:`, err);
      return null;
    });
}

export async function fetch_results() {
  return fetch_url(RESULTS_URL)
    .then((data) => (Object.entries(data).map(([id, result]) => ({ id, ...result }))));
}

export async function fetch_datasets() {
  return fetch_url(DATASETS_URL)
}

export async function fetch_models() {
  return fetch_url(MODELS_URL)
}

export async function fetch_tasks() {
  return fetch_url(TASKS_URL)
}

export async function fetch_MEDS_DEV(target) {
  switch (target) {
    case RESULTS:
      return fetch_results();
    case DATASETS:
      return fetch_datasets();
    case MODELS:
      return fetch_models();
    case TASKS:
      return fetch_tasks();
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}


function read_cache(key) {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      return {
        "data": data,
        "is_fresh": (Date.now() - timestamp) < CACHE_TTL_MS
      };
    } catch (err) {
      console.warn(`Cache read for ${key} failed (${err}). Clearing...`);
      localStorage.removeItem(key);
    }
  }

  return {"data": null, "is_fresh": false};
}

export async function load_MEDS_DEV(target) {
  const cache_key = `MEDS_DEV/${target}`;

  const { data, is_fresh } = read_cache(cache_key, true);

  if (is_fresh) {
    return data;
  }

  return fetch_MEDS_DEV(target)
    .then((result) => {
      localStorage.setItem(
        cache_key,
        JSON.stringify({ data: result, timestamp: Date.now() })
      );
      return result;
    })
    .catch((err) => {
      console.warn(`Failed to fetch ${target}:`, err);
      if (data) {
        console.warn(`Using stale cached data for ${target}`);
        return data;
      } else {
        throw new Error(`Failed to fetch ${target} and no cached data available.`);
      }
    });
}
