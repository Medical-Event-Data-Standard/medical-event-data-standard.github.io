// Refreshes the logos of the ecosystem packages' GitHub owners in static/img/ecosystem-logos:
// `npm run ecosystem:logos`. GITHUB_TOKEN is optional (the script makes one GitHub API request per owner).
import { updateEcosystemLogosFromYaml } from '../plugins/ecosystemMetadata';

updateEcosystemLogosFromYaml(process.cwd()).then(
  ({ warning, message }) => (warning ? console.warn : console.info)(message),
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  }
);
