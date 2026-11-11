import { Category, Package, ParsedEcosystem } from './types';

/** A category of static/data/ecosystem.yaml as the ecosystem page shows it when its tiles are grouped by type. */
export interface TypeGroup {
  category: Category;
  /** The id of the group's heading, which links to the group (see `categoryAnchorIds`). */
  id: string;
  /** The packages listed directly in the category that are shown, in YAML order. */
  packages: Package[];
  /** The subcategories that have packages to show, in YAML order. */
  subgroups: TypeGroup[];
}

/**
 * The ids of the categories' headings on the ecosystem page, keyed by topic: the topic in lower case, with every run
 * of other characters than letters and digits replaced by a hyphen, e.g. "dataset-etls-public-datasets". A number
 * is appended to an id that an earlier category already has.
 */
export function categoryAnchorIds(categories: Category[]): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const { topic } of categories) {
    if (ids.has(topic)) continue;
    const base =
      topic
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'category';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    ids.set(topic, id);
  }
  return ids;
}

/**
 * Groups the packages that `isShown` accepts by the category (and subcategory) of static/data/ecosystem.yaml that
 * lists them, nesting each subcategory in its parent and keeping the YAML order.
 *
 * Returns the top-level categories. A category with no packages to show, itself or in its subcategories, is left
 * out. The ids of the groups do not depend on which packages are shown.
 */
export function groupByType(
  { categories, packages }: Pick<ParsedEcosystem, 'categories' | 'packages'>,
  isShown: (pkg: Package) => boolean
): TypeGroup[] {
  const ids = categoryAnchorIds(categories);
  const topLevel: TypeGroup[] = [];
  // The groups of the current category and its ancestors, by depth. `categories` lists each category right before
  // its subcategories, so a category's parent is the closest category before it that is one level shallower.
  const ancestors: TypeGroup[] = [];
  for (const category of categories) {
    const group: TypeGroup = {
      category,
      id: ids.get(category.topic)!,
      packages: category.packages.map(name => packages[name]).filter(isShown),
      subgroups: [],
    };
    ancestors.length = category.depth;
    (category.depth === 0 ? topLevel : ancestors[category.depth - 1].subgroups).push(group);
    ancestors.push(group);
  }
  return pruneEmpty(topLevel);
}

function pruneEmpty(groups: TypeGroup[]): TypeGroup[] {
  return groups
    .map(group => ({ ...group, subgroups: pruneEmpty(group.subgroups) }))
    .filter(group => group.packages.length > 0 || group.subgroups.length > 0);
}
