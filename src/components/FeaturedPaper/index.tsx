import React from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { findMedsPaper } from '@site/src/lib/medsPapers/featured';
import { formatPaperDate, paperDateTime, parseMedsPapers } from '@site/src/lib/medsPapers/timeline';
import styles from './styles.module.css';

// A box on the home page (src/pages/index.tsx) featuring one of the main MEDS papers. Its details come from
// static/data/meds_papers.yaml, the file the timeline of the "Welcome to MEDS" page reads, so the two always agree.
// It links to the paper where it was published and, if the file gives its `pmc_url`, to its free full text on
// PubMed Central.

/** Label, in static/data/meds_papers.yaml, of the paper the home page features. */
export const FEATURED_PAPER_LABEL = 'MEDS review';

const HEADING_ID = 'featured-paper-title';

export default function FeaturedPaper({
  data,
  label = FEATURED_PAPER_LABEL,
}: {
  /** The contents of static/data/meds_papers.yaml. */
  data: unknown;
  label?: string;
}): React.JSX.Element {
  const paper = findMedsPaper(parseMedsPapers(data), label);
  return (
    <section className={styles.section} aria-labelledby={HEADING_ID}>
      <div className="container">
        <div className={styles.card}>
          <p className={styles.overline}>Featured paper</p>
          <h2 id={HEADING_ID} className={styles.title}>
            {paper.title}
          </h2>
          <p className={styles.meta}>
            {paper.venue}
            {' · '}
            <time dateTime={paperDateTime(paper)}>{formatPaperDate(paper)}</time>
          </p>
          {paper.authors && (
            <p className={styles.authors}>
              {/* Each name stays on one line; the list only wraps between names. */}
              {paper.authors.map((author, i) => (
                <React.Fragment key={author}>
                  {i > 0 && ', '}
                  <span className={styles.author}>{author}</span>
                </React.Fragment>
              ))}
            </p>
          )}
          <p className={styles.summary}>{paper.summary}</p>
          <div className={styles.actions}>
            <a
              className={`button button--primary button--lg ${styles.cta}`}
              href={paper.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read in {paper.venue}
              <OpenInNewIcon aria-hidden className={styles.ctaIcon} />
            </a>
            {paper.pmcUrl && (
              <a
                className={`button button--outline button--primary button--lg ${styles.cta}`}
                href={paper.pmcUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on PubMed
                <OpenInNewIcon aria-hidden className={styles.ctaIcon} />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
