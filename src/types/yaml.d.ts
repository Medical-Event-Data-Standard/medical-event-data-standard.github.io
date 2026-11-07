// docusaurus.config.ts loads YAML files with yaml-loader: importing one gives its parsed contents, to be validated.
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
