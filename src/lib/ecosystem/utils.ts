import { RawCategory, Category } from './types';

export function parseCategoryMap(categories: Record<string, RawCategory>): Record<string, Category> {
  const result: Record<string, Category> = {};

  for (const [key, rawCategory] of Object.entries(categories)) {
    result[key] = parseCategory(rawCategory);
  }

  return result;
}

function parseCategory(rawCategory: RawCategory): Category {
  const { title, description, icon, packages, ...rawSubcategories } = rawCategory;

  // If we have packages, return a leaf category
  if (packages && packages.length > 0) {
    return {
      title,
      description,
      icon,
      packages,
    };
  }

  // If we have subcategory-like properties, parse them as subcategories
  if (Object.keys(rawSubcategories).length > 0) {
    const subcategories: Record<string, Category> = {};

    for (const [subKey, subRaw] of Object.entries(rawSubcategories)) {
      if (subRaw && typeof subRaw === 'object') {
        subcategories[subKey] = parseCategory(subRaw as RawCategory);
      } else {
        console.warn(`Invalid subcategory format for ${subKey}`, subRaw);
      }
    }

    return {
      title,
      description,
      icon,
      subcategories,
    };
  }

  // Default to empty subcategories if no packages or subcategories found
  return {
    title,
    description,
    icon,
  };
}
