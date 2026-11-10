import React, { useMemo, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import { usePluginData } from '@docusaurus/useGlobalData';
import { Alert, Box, Grid, Typography } from '@mui/material';
import InstitutionList from '@site/src/components/papers/InstitutionList';
import PaperBrowser from '@site/src/components/papers/PaperBrowser';
import PaperCard from '@site/src/components/papers/PaperCard';
import { countInstitutions, formatDate } from '@site/src/lib/papers/display';
import { PAPERS_PLUGIN, type PapersPageData } from '@site/src/lib/papers/types';

const REPO = 'https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io';
const PAPERS_YAML = `${REPO}/blob/main/static/data/papers.yaml`;

/**
 * Papers citing the core MEDS papers, collected from Semantic Scholar at build time by plugins/papers.ts, with
 * their authors' institutions from OpenAlex.
 */
export default function Papers(): React.JSX.Element {
  const data = usePluginData(PAPERS_PLUGIN) as PapersPageData | undefined;
  const seeds = data?.seeds ?? [];
  const papers = data?.papers ?? [];
  const updated = formatDate(data?.updatedAt ?? null);
  const institutions = useMemo(() => countInstitutions(data?.papers ?? []), [data]);
  const withoutInstitutions = papers.filter(paper => paper.institutions.length === 0).length;
  const [institution, setInstitution] = useState<string | null>(null);

  const selectInstitution = (name: string | null): void => {
    setInstitution(name);
    if (name) document.getElementById('citing-papers')?.scrollIntoView?.({ behavior: 'smooth' });
  };

  const stats = [
    { value: papers.length, label: 'papers' },
    { value: institutions.length, label: 'institutions' },
    { value: seeds.length, label: 'core MEDS papers' },
  ];

  return (
    <Layout
      title="Papers"
      description="Research papers that cite the core MEDS papers, and the institutions of their authors."
    >
      <main className="container margin-vert--lg">
        <header className="margin-bottom--lg">
          <h1>Papers using MEDS</h1>
          <Typography sx={{ fontSize: '1.15rem', maxWidth: '46rem', mb: 2.5 }}>
            Research papers that cite one of the core MEDS papers, and papers that use MEDS without citing
            one.
          </Typography>
          <Box
            component="ul"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: 5, listStyle: 'none', p: 0, m: 0 }}
          >
            {stats.map(({ value, label }) => (
              <li key={label}>
                <Typography component="span" sx={{ display: 'block', fontSize: '1.75rem', fontWeight: 600 }}>
                  {value}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {label}
                </Typography>
              </li>
            ))}
          </Box>
          {updated && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Last updated on {updated}
            </Typography>
          )}
        </header>

        <Alert severity="info" sx={{ mb: 'var(--ifm-paragraph-margin-bottom)' }}>
          Citing MEDS doesn&rsquo;t always mean using it: some papers mention MEDS only as related work.
        </Alert>

        <section aria-labelledby="core-papers" className="margin-vert--lg">
          <h2 id="core-papers">Core MEDS papers</h2>
          <Grid container spacing={2}>
            {seeds.map(seed => (
              <Grid key={seed.id} size={{ xs: 12, md: 6 }}>
                <PaperCard paper={seed} label={seed.label} />
              </Grid>
            ))}
          </Grid>
        </section>

        {institutions.length > 0 && (
          <section aria-labelledby="institutions" className="margin-vert--lg">
            <h2 id="institutions">Institutions</h2>
            <p>
              Institutions of the authors of the papers below, with their number of papers. Select one to list
              its papers.
            </p>
            <InstitutionList
              institutions={institutions}
              icons={data?.institutionIcons ?? {}}
              selected={institution}
              onSelect={selectInstitution}
            />
          </section>
        )}

        <section aria-labelledby="citing-papers" className="margin-vert--lg">
          <h2 id="citing-papers">Papers citing or using MEDS</h2>
          <PaperBrowser
            papers={papers}
            seeds={seeds}
            institution={institution}
            onInstitutionChange={setInstitution}
          />
        </section>

        <section aria-labelledby="how-made" className="margin-vert--lg">
          <h2 id="how-made">How this list is made</h2>
          <ul>
            <li>
              Papers citing a core MEDS paper are found through{' '}
              <Link href="https://www.semanticscholar.org/">Semantic Scholar</Link>&rsquo;s citation graph.
            </li>
            <li>
              Papers that use MEDS without citing a core paper are added by hand, in the <code>include</code>{' '}
              list of <Link href={PAPERS_YAML}>static/data/papers.yaml</Link>. Papers that cite one but are
              not about using MEDS can be left out with its <code>exclude</code> list.
            </li>
            <li>
              Institutions are the author affiliations that <Link href="https://openalex.org/">OpenAlex</Link>{' '}
              records for each paper, found by DOI or arXiv ID, or else by title. Where OpenAlex has none,
              they can be added by hand in the <code>affiliations</code> list of papers.yaml. An
              institution&rsquo;s icon is its website&rsquo;s icon, found through the homepage that OpenAlex,
              or papers.yaml, lists for it.
              {withoutInstitutions > 0 && (
                <>
                  {' '}
                  {withoutInstitutions} of the {papers.length} papers{' '}
                  {withoutInstitutions === 1 ? 'has' : 'have'} no institutions listed.
                </>
              )}
            </li>
            <li>The list is updated whenever the site is rebuilt.</li>
          </ul>
          <p>
            Missing a paper, or found one that doesn&rsquo;t belong? Edit{' '}
            <Link href={PAPERS_YAML}>
              <code>static/data/papers.yaml</code>
            </Link>{' '}
            in a pull request, or <Link href={`${REPO}/issues/new/choose`}>open an issue</Link>.
          </p>
        </section>
      </main>
    </Layout>
  );
}
