# medical-event-data-standard.github.io

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

## Set-up

### Clone the repository

```bash
git clone git@github.com:Medical-Event-Data-Standard/medical-event-data-standard.github.io.git
cd medical-event-data-standard.github.io
```

### Installation

```bash
export ENV_NAME="MEDS_web"
conda create -n $ENV_NAME python=3.12 nodejs=22.11.0 -c conda-forge
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


### `docs/` pages:
The docusaurus system `docs` plugin renders `.md`/`.mdx` files in the docs folder and shows them in the sidebar. You
can include custom React components in `.mdx` files, allowing you to include more advanced content, such as
jupyter notebook, e.g.,

```mdx
---
sidebar_position: 2
---
# Converting to MEDS

import JupyterViewer from "react-jupyter-notebook";
import nb from "./converting_to_MEDS.ipynb";


<JupyterViewer rawIpynb={nb} />
```

## Deployment
> [!WARNING] Only do this when you are ready to deploy the site to the public facing page!

```
npm run build
npm run deploy
```

This command generates static content into the `build` directory and can be served using any static contents
hosting service.
