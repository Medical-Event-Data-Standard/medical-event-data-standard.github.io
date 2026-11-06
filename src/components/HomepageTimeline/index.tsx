import React from 'react';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  TimelineEntry,
  formatPaperDate,
  layoutTimeline,
  paperDateTime,
  parseMedsPapers,
  timelineColumnCount,
} from '@site/src/lib/medsPapers/timeline';
import styles from './styles.module.css';

// A timeline of the main MEDS papers (static/data/meds_papers.yaml), oldest first. On wide screens the papers are
// evenly spaced markers on a horizontal axis, with their cards alternately above and below it; on narrow screens
// the axis turns vertical, with the cards stacked beside it. Either way the papers are an ordered list, so screen
// readers and keyboards meet them in date order. The year labels and markers only repeat the cards' dates, so
// they are hidden from assistive technology.

function PaperCard({ entry }: { entry: TimelineEntry }): React.JSX.Element {
  const { paper, side, gridColumn, newYear } = entry;
  // Keep the title's last word with the external-link icon, so the icon never wraps onto a line of its own.
  const lastSpace = paper.title.lastIndexOf(' ');
  return (
    <li className={`${styles.entry} ${styles[side]}`} style={{ gridColumn }}>
      <article className={styles.card}>
        <h3 className={styles.label}>{paper.label}</h3>
        <p className={styles.meta}>
          <time dateTime={paperDateTime(paper)}>{formatPaperDate(paper)}</time>
          {' · '}
          {paper.venue}
        </p>
        <p className={styles.summary}>{paper.summary}</p>
        <a className={styles.link} href={paper.url} target="_blank" rel="noopener noreferrer">
          {paper.title.slice(0, lastSpace + 1)}
          <span className={styles.nowrap}>
            {paper.title.slice(lastSpace + 1)}
            <OpenInNewIcon aria-hidden className={styles.linkIcon} />
          </span>
        </a>
      </article>
      <span aria-hidden className={styles.connector} />
      {newYear !== undefined && (
        <span aria-hidden className={styles.year}>
          {newYear}
        </span>
      )}
    </li>
  );
}

export default function HomepageTimeline({ data }: { data: unknown }): React.JSX.Element {
  const entries = layoutTimeline(parseMedsPapers(data));
  return (
    <section className={styles.section} aria-labelledby="meds-papers-heading">
      <div className="container">
        <h2 id="meds-papers-heading" className={styles.heading}>
          Key MEDS papers
        </h2>
        <p className={styles.intro}>Peer-reviewed papers on the MEDS standard and its core tools.</p>
        <ol
          className={styles.timeline}
          aria-label="Key MEDS papers, oldest first"
          style={{ '--timeline-columns': timelineColumnCount(entries.length) } as React.CSSProperties}
        >
          {entries.map(entry => (
            <PaperCard key={entry.paper.url} entry={entry} />
          ))}
        </ol>
      </div>
    </section>
  );
}
