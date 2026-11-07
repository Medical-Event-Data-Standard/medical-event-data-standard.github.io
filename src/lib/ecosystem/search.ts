import { Package } from './types';

/**
 * Whether a package matches the search box of the ecosystem page: every word of the query, ignoring case, appears
 * in the package's name or in its description. An empty query matches every package.
 */
export function packageMatchesSearch(pkg: Package, query: string): boolean {
  const text = `${pkg.name}\n${pkg.description ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every(word => text.includes(word));
}
