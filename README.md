# medical-event-data-standard.github.io
GitHub Pages site for MEDS

## Development
This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

1. Install a conda environment:
```bash
conda create -n MEDS_gh_pages nodejs=22.11.0 -c conda-forge
conda activate MEDS_gh_pages
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```
This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

4. When ready, build and deploy the site
```
$ npm build
$ npm run deploy
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
