# [MEDS Website](https://medical-event-data-standard.github.io/)

[![MEDS v0.4](https://img.shields.io/badge/MEDS-0.3.3-blue)](https://medical-event-data-standard.github.io/)
[![code-quality](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/actions/workflows/code-quality-main.yaml/badge.svg)](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/actions/workflows/code-quality-main.yaml)
[![tests](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/actions/workflows/tests.yaml/badge.svg)](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/actions/workflows/tests.yaml)
[![codecov](https://codecov.io/gh/Medical-Event-Data-Standard/medical-event-data-standard.github.io/graph/badge.svg?token=MX9IMUWGG0)](https://codecov.io/gh/Medical-Event-Data-Standard/medical-event-data-standard.github.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg?labelColor=gray)](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io#license)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/pulls)
[![contributors](https://img.shields.io/github/contributors/Medical-Event-Data-Standard/medical-event-data-standard.github.io.svg)](https://github.com/Medical-Event-Data-Standard/medical-event-data-standard.github.io/graphs/contributors)

This repository hosts the source code for the [MEDS website](https://medical-event-data-standard.github.io/).
The MEDS website is a resource for the MEDS community, providing

1. The official technical documentation for MEDS.
2. Tutorials and examples for using MEDS.
3. The official MEDS-DEV benchmark website.
4. Lists of MEDS ecosystem tools and resources.

This website is built using

1. [Docusaurus](https://docusaurus.io/) for documentation, blog posts, and simple static site
   infrastructure, largely using [MDX](https://mdxjs.com/) for writing content.
2. [React](https://reactjs.org/) for custom components and interactivity.
3. [Jupyter](https://jupyter.org/) for interactive tutorials.
4. [Material UI](https://mui.com/) for styling and UI components.
5. [TypeScript](https://www.typescriptlang.org/) for core javascript content.
6. [GitHub Pages](https://pages.github.com/) for hosting the website.

The rest of this README provides instructions for developing the website.

## Contributing

Contributions are welcome! See
[How to Contribute](https://medical-event-data-standard.github.io/docs/intro_pages/contributing) on the
website for the ways to contribute to MEDS. To add a tool, dataset, or model to the
[ecosystem page](https://medical-event-data-standard.github.io/docs/intro_pages/ecosystem), edit
[`static/data/ecosystem.yaml`](static/data/ecosystem.yaml) and open a pull request.

## Set-up

### Clone the repository

```bash
git clone git@github.com:Medical-Event-Data-Standard/medical-event-data-standard.github.io.git
cd medical-event-data-standard.github.io
```

### Installation

```bash
export ENV_NAME="MEDS_web"
conda create -n $ENV_NAME python=3.12 nodejs=22 -c conda-forge
conda activate $ENV_NAME
npm install
pip install -r requirements.txt
```

### Starting a Development Server

To see your changes live, you should start a local development server.

```bash
npm start
```

This will open the local site in a browser window, and your changes will be reflected live. You may need to
open additional terminals for things like package management, editing, modifying jupyter notebooks, etc.

The [ecosystem page](https://medical-event-data-standard.github.io/docs/intro_pages/ecosystem) shows GitHub
stars and latest releases, which are fetched from the GitHub API once when the site is built or the dev server
starts (see `plugins/ecosystemMetadata.ts`). Without a token these requests are limited to 60/hour, which is
not enough for every package, so set `GITHUB_TOKEN` to see them all locally:

```bash
GITHUB_TOKEN=$(gh auth token) npm start
```

The [papers page](https://medical-event-data-standard.github.io/papers) is built the same way; see
[The papers page](#the-papers-page) below. The dev server uses its committed snapshot rather than fetching, so
it starts quickly.

## Site Structure

This repository has the following directory structure:

```txt
medical-event-data-standard.github.io/
├── docs/                     # MDX content pages (used by Docusaurus)
├── blog/                     # Optional: Docusaurus blog posts
├── src/
│   ├── components/           # Custom React components
│   │   ├── ui/               # UI components (e.g., buttons, cards)
│   │   └── layout/           # Custom wrappers, layouts, headers
│   ├── lib/                  # Custom JS libraries (e.g., fetching MEDS-DEV data)
│   ├── pages/                # Custom pages under `/src/pages` (for non-doc routes)
│   │   └── index.tsx         # Optional: homepage override
│   ├── theme/                # Custom theme component overrides (optional)
│   ├── types/                # Shared TypeScript types
│   └── utils/                # Utilities, helpers
├── static/                   # Public assets copied as-is (e.g., favicon, images)
├── tests/                    # Unit/integration tests (React Testing Library, Jest)
│   └── components/
├── playwright.config.ts      # If using Playwright for E2E
├── docusaurus.config.js      # Main Docusaurus config
├── sidebars.js               # Sidebar structure
├── tsconfig.json             # TypeScript config
├── package.json              # Project metadata and scripts
└── .github/workflows/        # GitHub CI workflows
```

## Development Notes

### Tutorials

Tutorials can be written either in markdown or jupyter notebooks, which are then rendered using
[react-jupyter-notebook](https://github.com/Joeyonng/react-jupyter-notebook).

### `docs/` pages

The docusaurus system `docs` plugin renders `.md`/`.mdx` files in the docs folder and shows them in the sidebar. You
can include custom React components in `.mdx` files, allowing you to include more advanced content, such as
jupyter notebook, e.g.,

```mdx
---
sidebar_position: 2
---

# Converting to MEDS

import JupyterViewer from 'react-jupyter-notebook';
import nb from './converting_to_MEDS.ipynb';

<JupyterViewer rawIpynb={nb} />
```

### The papers page

The [papers page](https://medical-event-data-standard.github.io/papers) (`src/pages/papers.tsx`) lists the
papers that cite one of the core MEDS papers ("seeds"), from
[Semantic Scholar](https://www.semanticscholar.org/)'s citation graph. Citing MEDS doesn't always mean using
it, so the page says so. The list is fetched at build time by `plugins/papers.ts`, so visitors make no API
calls, and it is configured in [`static/data/papers.yaml`](static/data/papers.yaml):

- `seeds`: the core MEDS papers, by Semantic Scholar paperId, with the short label shown on chips.
- `include`: papers that use MEDS without citing a seed.
- `exclude`: papers that cite a seed but don't belong on the list.

Semantic Scholar rate-limits unauthenticated requests heavily, so the plugin makes one request at a time,
retries HTTP 429 and 5xx responses with exponential backoff (honouring `Retry-After`), and stops retrying after
two minutes. Whatever it can't fetch is taken from the committed snapshot,
[`static/data/papers.snapshot.json`](static/data/papers.snapshot.json), with a single warning in the build log;
a failed fetch never fails the build. (An invalid `papers.yaml` does, so mistakes in it are caught in PRs.)

Where the data comes from depends on `PAPERS_SOURCE`:

| Command                         | Default source | Override                 |
| ------------------------------- | -------------- | ------------------------ |
| `npm run build`                 | live fetch     | `PAPERS_SOURCE=snapshot` |
| `npm start` (dev server)        | snapshot       | `PAPERS_SOURCE=live`     |
| `npm run papers:update` (below) | live fetch     | (always live)            |

Set `SEMANTIC_SCHOLAR_API_KEY` (sent as the `x-api-key` header) to avoid most rate limiting; you can
[request a key](https://www.semanticscholar.org/product/api#api-key-form) for free. In CI it comes from the
optional repository secret of the same name.

To refresh the snapshot, e.g. after changing the seeds or `include`, run the following and commit the result:

```bash
SEMANTIC_SCHOLAR_API_KEY=... npm run papers:update
```

## Deployment

The site auto-deploys to <https://medical-event-data-standard.github.io/> via the
`Deploy to GitHub Pages` workflow (`.github/workflows/deploy.yaml`) whenever a
`v*` tag is pushed. To cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or create a GitHub Release in the UI with a new `v*` tag — that pushes the tag
and triggers the same workflow.

The workflow can also be re-run manually from the Actions tab via `Run workflow`.

Every Monday the workflow also rebuilds and redeploys the **latest `v*` tag** (by version number, not `main`),
so data fetched at build time (the papers citing MEDS, GitHub stars and releases) stays fresh while the site's
content stays at the released version.

### Local build / preview

```bash
npm run build      # generates ./build
npm run serve      # serves ./build at http://localhost:3000
```

### Manual / fallback deploy

`npm run deploy` (which runs `docusaurus deploy`) is still wired up as a fallback
that publishes from your local checkout to the `gh-pages` branch — but once Pages
is switched to `GitHub Actions` as its source (see `deploy.yaml`), the manual
path will no longer move the live site. Use the workflow.
