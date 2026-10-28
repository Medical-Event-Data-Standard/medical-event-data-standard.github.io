import { readOrFetchToCache } from '@site/src/lib/loadAndCache';
import {
  buildCiMatrix,
  CI_ACTIONS_URL,
  CI_REPORT_URL,
  CI_STATUSES,
  CiReport,
  CiResult,
  countCiResults,
  loadCiReport,
  parseCiReport,
} from './ci';

jest.mock('@site/src/lib/loadAndCache', () => ({ readOrFetchToCache: jest.fn() }));
const mockRead = jest.mocked(readOrFetchToCache);

// Synthetic fixtures, not observed CI outcomes.
function result(overrides: Partial<CiResult> = {}): CiResult {
  return {
    model: 'model-a',
    dataset: 'MIMIC-IV',
    task: 'mortality/in_icu/first_24h',
    status: 'passed',
    job_conclusion: 'success',
    test_conclusion: 'success',
    job_id: 99,
    job_url: `${CI_ACTIONS_URL}/runs/123/job/99`,
    ...overrides,
  };
}

function report(results: CiResult[] = [result()]): CiReport {
  return {
    schema_version: 1,
    repository: 'Medical-Event-Data-Standard/MEDS-DEV',
    run_id: 123,
    run_attempt: 1,
    run_url: `${CI_ACTIONS_URL}/runs/123`,
    commit_sha: 'abcdef123456',
    branch: 'main',
    generated_at: '2026-10-28T12:00:00+00:00',
    scope: 'full-integration',
    summary: countCiResults(results),
    results,
  };
}

describe('parseCiReport', () => {
  it('accepts objects and JSON strings with nullable job details', () => {
    const input = report([
      result({ status: 'not_run', job_id: null, job_url: null, job_conclusion: null, test_conclusion: null }),
    ]);
    expect(parseCiReport(input)).toEqual(input);
    expect(parseCiReport(JSON.stringify(input))).toEqual(input);
  });

  it('preserves all statuses and separate pytest and job conclusions', () => {
    const input = report(
      CI_STATUSES.map((status, index) =>
        result({
          model: `model-${index}`,
          status,
          job_conclusion: status === 'failed' ? 'failure' : null,
          test_conclusion: 'success',
        })
      )
    );
    expect(parseCiReport(input)).toEqual(input);
    expect(parseCiReport(input)?.results[1]).toMatchObject({ status: 'failed', test_conclusion: 'success' });
  });

  it.each([null, undefined, [], 1, '{', '<html>404</html>', 'null', {}])(
    'rejects malformed input: %p',
    input => {
      expect(parseCiReport(input)).toBeNull();
    }
  );

  it.each([
    { schema_version: 2 },
    { scope: 'partial' },
    { branch: 'dev' },
    { repository: 'other/repo' },
    { run_id: -1 },
    { run_attempt: 0 },
    { run_url: 'javascript:alert(1)' },
    { commit_sha: 'bad sha' },
    { generated_at: 'not a date' },
    { results: {} },
    { summary: {} },
    { summary: { ...report().summary, passed: 2 } },
  ])('rejects invalid report metadata: %p', overrides => {
    expect(parseCiReport({ ...report(), ...overrides })).toBeNull();
  });

  it.each([
    { model: '' },
    { dataset: null },
    { task: 1 },
    { status: 'unknown' },
    { job_url: 'javascript:alert(1)' },
    { job_url: 'https://example.com/job' },
    { job_id: -1 },
    { test_conclusion: 12 },
    { job_conclusion: undefined },
  ])('rejects malformed cells: %p', overrides => {
    const input = report();
    expect(parseCiReport({ ...input, results: [{ ...input.results[0], ...overrides }] })).toBeNull();
  });

  it('rejects duplicate combinations rather than overwriting their status', () => {
    expect(parseCiReport(report([result(), result({ status: 'failed' })]))).toBeNull();
  });

  it('accepts an empty report without inventing results', () => {
    expect(parseCiReport(report([]))).toEqual(report([]));
  });
});

describe('loadCiReport', () => {
  beforeEach(() => mockRead.mockReset());
  it('uses the shared cache and central report URL', async () => {
    mockRead.mockResolvedValue(report());
    expect(await loadCiReport()).toEqual(report());
    expect(mockRead).toHaveBeenCalledWith(CI_REPORT_URL);
  });
  it.each([null, '{broken', { schema_version: 2 }])('handles absent or invalid feeds: %p', async value => {
    mockRead.mockResolvedValue(value);
    expect(await loadCiReport()).toBeNull();
  });
  it('handles network or browser storage errors', async () => {
    mockRead.mockRejectedValue(new Error('unavailable'));
    expect(await loadCiReport()).toBeNull();
  });
});

describe('buildCiMatrix', () => {
  const results = [
    result({ model: 'model-b', status: 'failed' }),
    result(),
    result({ dataset: 'eICU', task: 'mortality', status: 'not_run', job_id: null, job_url: null }),
    result({ dataset: 'MIMIC-IV', task: 'length_of_stay', model: 'model-b', status: 'skipped' }),
  ];

  it('groups dataset/task rows across models and keeps missing cells absent', () => {
    const matrix = buildCiMatrix(results);
    expect(matrix.models).toEqual(['model-a', 'model-b']);
    expect(matrix.rows).toHaveLength(3);
    const shared = matrix.rows.find(row => row.task === 'mortality/in_icu/first_24h');
    expect(shared?.cells.get('model-a')?.status).toBe('passed');
    expect(shared?.cells.get('model-b')?.status).toBe('failed');
    const incomplete = matrix.rows.find(row => row.dataset === 'eICU');
    expect(incomplete?.cells.get('model-a')?.status).toBe('not_run');
    expect(incomplete?.cells.has('model-b')).toBe(false);
    expect(matrix.counts).toEqual({
      total: 4,
      passed: 1,
      failed: 1,
      skipped: 1,
      cancelled: 0,
      not_run: 1,
      other: 0,
    });
  });

  it('applies all three filters and counts only matching collected combinations', () => {
    const matrix = buildCiMatrix(results, {
      dataset: 'MIMIC-IV',
      task: 'mortality/in_icu/first_24h',
      model: 'model-b',
    });
    expect(matrix.models).toEqual(['model-b']);
    expect(matrix.rows).toHaveLength(1);
    expect(matrix.counts.total).toBe(1);
    expect(matrix.counts.failed).toBe(1);
    expect(matrix.counts.passed).toBe(0);
    expect(buildCiMatrix(results, { dataset: 'missing' }).rows).toEqual([]);
    expect(buildCiMatrix([], {}).counts.total).toBe(0);
  });

  it('keeps identical tasks on different datasets in separate rows', () => {
    const matrix = buildCiMatrix([result({ dataset: 'b' }), result({ dataset: 'a' })]);
    expect(matrix.rows.map(row => row.dataset)).toEqual(['a', 'b']);
  });

  it('does not collide on identifiers containing separators or object property names', () => {
    const matrix = buildCiMatrix([
      result({ dataset: 'a|b', task: 'c', model: '__proto__' }),
      result({ dataset: 'a', task: 'b|c', model: '__proto__' }),
    ]);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0].cells.get('__proto__')?.status).toBe('passed');
  });
});
