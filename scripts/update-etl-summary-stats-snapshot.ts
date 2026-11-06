// Refreshes static/data/etl_summary_stats.snapshot.json from the ETL repositories on GitHub. Run it from the
// repository root, then commit the result:
//
//   GITHUB_TOKEN=$(gh auth token) npx ts-node --transpile-only -O '{"module":"commonjs"}' \
//     scripts/update-etl-summary-stats-snapshot.ts && npx prettier --write static/data/etl_summary_stats.snapshot.json
//
// GITHUB_TOKEN is optional but avoids the 60 requests/hour limit for unauthenticated GitHub API calls.
import { updateEtlStatsSnapshot } from '../plugins/etlSummaryStats';

updateEtlStatsSnapshot(process.cwd()).then(
  ({ warning, message }) => (warning ? console.warn : console.info)(message),
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  }
);
