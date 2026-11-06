// webpack loads YAML files with yaml-loader (see docusaurus.config.ts); `parseMedsPapers` checks the data.
declare module '@site/static/data/meds_papers.yaml' {
  const data: unknown;
  export default data;
}
