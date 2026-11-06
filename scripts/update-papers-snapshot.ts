// Refreshes static/data/papers.snapshot.json from Semantic Scholar: `npm run papers:update`.
// Set SEMANTIC_SCHOLAR_API_KEY to avoid most rate limiting.
import { updatePapersSnapshot } from '../plugins/papers';

updatePapersSnapshot(process.cwd()).then(
  ({ warning, message }) => (warning ? console.warn : console.info)(message),
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  }
);
