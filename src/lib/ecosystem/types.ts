import * as MuiIcons from '@mui/icons-material';

export interface Package {
  name: string;
  github_repo?: string;
  warn?: string;
  demo_available?: boolean;
  docs_url?: string;
  paper_url?: string;
  pypi_name?: string;
}

export interface PackageWithMetadata extends Package, GitHubRepoResponse {
  latest_release?: string;
}

export interface GitHubRepoResponse {
  stargazers_count?: number;
  updated_at?: string;
}

export interface GitHubReleaseResponse {
  tag_name: string;
}

interface CategoryMetadata {
  title: string;
  description?: string;
  icon?: keyof typeof MuiIcons;
}

export interface RawCategory extends CategoryMetadata {
  packages?: Package[];
  [key: string]: string | Package[] | RawCategory | keyof typeof MuiIcons | undefined;
}

export type Category =
  | CategoryMetadata
  | (CategoryMetadata & { packages: Package[]; subcategories?: never })
  | (CategoryMetadata & { subcategories: Record<string, Category>; packages?: never });
