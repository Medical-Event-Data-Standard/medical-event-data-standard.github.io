import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { usePluginData } from '@docusaurus/useGlobalData';
import { Alert, Grid } from '@mui/material';
import PaperBrowser from '@site/src/components/papers/PaperBrowser';
import PaperCard from '@site/src/components/papers/PaperCard';
import { formatDate } from '@site/src/lib/papers/display';
import { PAPERS_PLUGIN, type PapersData } from '@site/src/lib/papers/types';

const REPO = 'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io';

/** Papers citing the core MEDS papers, collected from Semantic Scholar at build time by plugins/papers.ts. */
export default function Papers(): React.JSX.Element {
  const data = usePluginData(PAPERS_PLUGIN) as PapersData | undefined;
  const seeds = data?.seeds ?? [];
  const papers = data?.papers ?? [];
  const updated = formatDate(data?.updatedAt ?? null);

  return (
    <Layout
      title="Papers"
      description="Research papers that cite the core MEDS papers, updated automatically from Semantic Scholar."
    >
      <main className="container margin-vert--lg">
        <h1>Papers using MEDS</h1>
        <p>
          These are the research papers that cite one of the core MEDS papers below, found through{' '}
          <Link href="https://www.semanticscholar.org/">Semantic Scholar</Link>&rsquo;s citation graph. The
          list is updated automatically whenever the site is rebuilt
          {updated && (
            <>
              ; it was last updated on <strong>{updated}</strong>
            </>
          )}
          .
        </p>
        <Alert severity="info" sx={{ mb: 'var(--ifm-paragraph-margin-bottom)' }}>
          Citing MEDS doesn&rsquo;t always mean using it: some papers mention MEDS only as related work. And
          papers that use MEDS without citing these papers are missing unless they are added by hand.
        </Alert>
        <p>
          Missing a paper, or found one that doesn&rsquo;t belong? Add it to the <code>include</code> or{' '}
          <code>exclude</code> list in{' '}
          <Link href={`${REPO}/blob/main/static/data/papers.yaml`}>
            <code>static/data/papers.yaml</code>
          </Link>{' '}
          with a pull request, or <Link href={`${REPO}/issues/new/choose`}>open an issue</Link>.
        </p>

        <section aria-labelledby="core-papers" className="margin-bottom--lg">
          <h2 id="core-papers">Core MEDS papers</h2>
          <Grid container spacing={2}>
            {seeds.map(seed => (
              <Grid key={seed.id} size={{ xs: 12, md: 6 }}>
                <PaperCard paper={seed} chips={[{ label: seed.label, color: 'primary' }]} />
              </Grid>
            ))}
          </Grid>
        </section>

        <section aria-labelledby="citing-papers">
          <h2 id="citing-papers">Papers citing MEDS</h2>
          <PaperBrowser papers={papers} seeds={seeds} />
        </section>
      </main>
    </Layout>
  );
}
