# medical-event-data-standard.github.io
GitHub Pages site for MEDS

## Development
This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator. Tutorials
can be written either in markdown or jupyter notebooks, which are then rendered using
[react-jupyter-notebook](https://github.com/Joeyonng/react-jupyter-notebook).

### Set-up

1. Install a conda environment:
```bash
conda create -n MEDS_gh_pages python=3.12 nodejs=22.11.0 -c conda-forge
conda activate MEDS_gh_pages
```

2. Install dependencies:
```bash
npm install
pip install -r requirements.txt
```

3. Start the development server and your Jupyter server:
Terminal 1:
```bash
jupyter notebook
```
This command starts a Jupyter server. You can navigate to the jupyter notebooks used in the tutorials in
`docs/...` and modify them as desired.

Terminal 2:
```bash
npm start
```
This command starts a local development website server and opens up a browser window reflecting the site. Most
changes are reflected live without having to restart the server. Changes to jupyter notebooks are likewise
reflected live.

### Notes on Development
Note that you will always need to have the "root" page be a `.mdx` file that docusaurus knows how to render,
even if you want it to load a jupyter notebook tutorial. The core setup, page title, and metadata should be in
this `.mdx` file, then you'll load the jupyter notebook via a `mdx` block. E.g.,

```mdx
---
sidebar_position: 2
---
# Converting to MEDS

import JupyterViewer from "react-jupyter-notebook";
import nb from "./converting_to_MEDS.ipynb";


<JupyterViewer rawIpynb={nb} />
```

### Deployment
```
npm run build
npm run deploy
```

This command generates static content into the `build` directory and can be served using any static contents
hosting service.
