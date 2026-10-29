import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import {
  buildCiMatrix,
  CI_ACTIONS_URL,
  CI_STATUSES,
  CiFilters,
  CiReport,
  CiResult,
  CiStatus,
  loadCiReport,
} from '@site/src/lib/MEDS-DEV/ci';

const STATUS: Record<
  CiStatus,
  { label: string; color: 'success' | 'error' | 'warning' | 'default' | 'info' }
> = {
  passed: { label: 'Passed', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  skipped: { label: 'Skipped', color: 'info' },
  cancelled: { label: 'Cancelled', color: 'warning' },
  not_run: { label: 'Not run', color: 'default' },
  other: { label: 'Other', color: 'default' },
};

function ResultCell({ result }: { result: CiResult }) {
  const { label, color } = STATUS[result.status];
  const description = `${result.model}, ${result.dataset}, ${result.task}: ${label}`;
  return (
    <>
      {result.job_url ? (
        <Chip
          component="a"
          href={result.job_url}
          clickable
          size="small"
          label={label}
          color={color}
          aria-label={`${description}. View job logs`}
        />
      ) : (
        <Chip size="small" label={label} color={color} aria-label={description} />
      )}
      <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
        Job: {result.job_conclusion ?? 'unavailable'}
        <br />
        Pytest step: {result.test_conclusion ?? 'unavailable'}
      </Typography>
    </>
  );
}

export default function CiCompatibilityMatrix() {
  const [report, setReport] = useState<CiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CiFilters>({});
  const id = useId();

  useEffect(() => {
    let active = true;
    loadCiReport().then(value => {
      if (active) {
        setReport(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const matrix = useMemo(() => buildCiMatrix(report?.results ?? [], filters), [report, filters]);
  if (loading) return <Typography role="status">Loading CI compatibility report…</Typography>;
  if (!report)
    return (
      <Alert severity="info">
        The CI compatibility report is not available. It may not have been published yet, or could not be
        loaded. <Link href={CI_ACTIONS_URL}>View MEDS-DEV GitHub Actions</Link> for run reports and logs. The
        public feed appears after a qualifying full-integration run on main publishes it.
      </Alert>
    );

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography paragraph>
        Latest published full-integration snapshot: <Link href={report.run_url}>run {report.run_id}</Link>{' '}
        (attempt {report.run_attempt}) · main · commit <code>{report.commit_sha.slice(0, 7)}</code>
        <br />
        Generated <time dateTime={report.generated_at}>{new Date(report.generated_at).toISOString()}</time>
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        {(['dataset', 'task', 'model'] as const).map(field => {
          const label = field.charAt(0).toUpperCase() + field.slice(1);
          return (
            <FormControl key={field} size="small" sx={{ minWidth: 160, flex: '1 1 160px', maxWidth: '100%' }}>
              <InputLabel id={`${id}-${field}`}>{label}</InputLabel>
              <Select
                labelId={`${id}-${field}`}
                label={label}
                value={filters[field] ?? ''}
                onChange={event => setFilters(current => ({ ...current, [field]: event.target.value }))}
              >
                <MenuItem value="">All {field}s</MenuItem>
                {[...new Set(report.results.map(result => result[field]))].sort().map(value => (
                  <MenuItem key={value} value={value} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        })}
      </Box>
      <Box role="status" aria-live="polite" sx={{ mb: 2 }}>
        <Typography variant="body2">
          {matrix.counts.total} collected combinations match these filters.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          {CI_STATUSES.map(status => (
            <Chip
              key={status}
              size="small"
              variant="outlined"
              color={STATUS[status].color}
              label={`${STATUS[status].label}: ${matrix.counts[status]}`}
            />
          ))}
        </Box>
      </Box>
      {matrix.rows.length === 0 ? (
        <Alert severity="info">No collected combinations match these filters.</Alert>
      ) : (
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label="CI compatibility matrix; scroll to view all models"
          sx={{ maxWidth: '100%', overflowX: 'auto' }}
        >
          <Table size="small" sx={{ '& th, & td': { verticalAlign: 'top' } }}>
            <caption>
              GitHub Actions job conclusions by dataset, task, and model. — means not included in collection.
            </caption>
            <TableHead>
              <TableRow>
                <TableCell scope="col">Dataset / task</TableCell>
                {matrix.models.map(model => (
                  <TableCell key={model} scope="col" sx={{ minWidth: 150 }}>
                    {model}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {matrix.rows.map(row => (
                <TableRow key={JSON.stringify([row.dataset, row.task])}>
                  <TableCell component="th" scope="row" sx={{ minWidth: 200, overflowWrap: 'anywhere' }}>
                    <strong>{row.dataset}</strong>
                    <br />
                    {row.task}
                  </TableCell>
                  {matrix.models.map(model => {
                    const result = row.cells.get(model);
                    return (
                      <TableCell key={model}>
                        {result ? (
                          <ResultCell result={result} />
                        ) : (
                          <span aria-label="Not included in collection" title="Not included in collection">
                            —
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
