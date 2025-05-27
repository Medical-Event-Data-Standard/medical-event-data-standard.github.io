import * as MuiIcons from '@mui/icons-material';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

// Topics

export interface RichTopicName {
  name: string;
  icon?: keyof typeof MuiIcons;
}

export interface Topic extends RichTopicName {
  description?: string;
  featured?: string[];
}

// Raw packages (sourced from the YAML file)

export interface RawMedsDevInfo {
  entity_type: string;
  name: string;
}

export interface RawPackage {
  name: string;
  github_repo?: string;
  warn?: string;
  demo_available?: boolean;
  docs_url?: string;
  paper_url?: string;
  pypi_name?: string;
  topics?: string[];
  'MEDS-DEV'?: RawMedsDevInfo;
}

// Raw categories from the YAML file

export interface RawCategory extends Topic {
  packages?: RawPackage[];
  [key: string]: string | RawPackage[] | RawCategory | keyof typeof MuiIcons | string[] | undefined;
}

// Parsed packages

export interface MedsDevInfo {
  entityType: MedsEntityType;
  name: string;
}

export interface Package {
  name: string;
  githubRepo?: string;
  warn?: string;
  demoAvailable?: boolean;
  docsUrl?: string;
  paperUrl?: string;
  pypiName?: string;
  topics?: RichTopicName[];
  medsDev?: MedsDevInfo;
}

export interface PackageWithMetadata extends Package {
  stars: number | null;
  lastUpdated: Date | null;
  release: string | null;
}

export interface ParsedEcosystem {
  packages: Record<string, Package>;
  topics: Record<string, Topic>;
  topicPackages: Record<string, string[]>;
}
