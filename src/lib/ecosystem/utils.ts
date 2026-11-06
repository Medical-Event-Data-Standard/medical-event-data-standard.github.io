import { RawCategory, RawPackage, Package, RichTopicName, Topic, ParsedEcosystem } from './types';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

// The ecosystem page is rendered at build time, so the errors thrown below for malformed entries in
// static/data/ecosystem.yaml fail the build instead of silently dropping data from the page.

interface FieldSpec {
  isValid: (value: unknown) => boolean;
  /** Describes valid values, for error messages. */
  expected: string;
}

const isString = (value: unknown): value is string => typeof value === 'string';

const isMapping = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MEDS_ENTITY_TYPES: string[] = Object.values(MedsEntityType);

const STRING: FieldSpec = { isValid: isString, expected: 'a string' };

const CATEGORY_FIELDS: Record<'name' | 'description' | 'icon' | 'packages', FieldSpec> = {
  name: STRING,
  description: STRING,
  icon: STRING,
  packages: { isValid: Array.isArray, expected: 'a list of packages' },
};

const PACKAGE_FIELDS: Record<keyof RawPackage, FieldSpec> = {
  name: STRING,
  github_repo: STRING,
  warn: STRING,
  demo_available: { isValid: value => typeof value === 'boolean', expected: 'true or false' },
  docs_url: STRING,
  paper_url: STRING,
  pypi_name: STRING,
  physionet_url: STRING,
  topics: { isValid: value => Array.isArray(value) && value.every(isString), expected: 'a list of strings' },
  meds_dev: {
    isValid: value =>
      isMapping(value) &&
      Object.keys(value).every(key => key === 'entity_type' || key === 'name') &&
      MEDS_ENTITY_TYPES.includes(value.entity_type as string) &&
      isString(value.name),
    expected: `a mapping with "entity_type" (${MEDS_ENTITY_TYPES.join(', ')}) and "name" (the MEDS-DEV entity name)`,
  },
};

function fail(path: string, message: string): never {
  throw new Error(`Invalid entry in static/data/ecosystem.yaml at ${path}: ${message}`);
}

function checkField(path: string, key: string, value: unknown, spec: FieldSpec): void {
  if (!spec.isValid(value)) {
    fail(path, `"${key}" must be ${spec.expected}, got ${JSON.stringify(value)}.`);
  }
}

function fieldSpec(fields: Record<string, FieldSpec>, key: string): FieldSpec | undefined {
  return Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined;
}

function parseRawPackage(rawPkg: unknown, path: string): RawPackage {
  if (!isMapping(rawPkg) || !isString(rawPkg.name)) {
    fail(path, 'expected a package: a mapping with at least a "name".');
  }
  const where = `${path} ("${rawPkg.name}")`;
  for (const [key, value] of Object.entries(rawPkg)) {
    const spec = fieldSpec(PACKAGE_FIELDS, key);
    if (!spec) {
      fail(where, `unknown package key "${key}"; expected one of ${Object.keys(PACKAGE_FIELDS).join(', ')}.`);
    }
    checkField(where, key, value, spec);
  }
  return rawPkg as unknown as RawPackage;
}

export function mergeParsedEcosystems(
  original: ParsedEcosystem,
  newEcosystem: ParsedEcosystem
): ParsedEcosystem {
  const packages: Record<string, Package> = { ...original.packages };
  const topics: Record<string, Topic> = { ...original.topics };
  const topicPackages: Record<string, string[]> = { ...original.topicPackages };

  const { packages: newPackages, topics: newTopics, topicPackages: newTopicPackages } = newEcosystem;

  for (const newTopic of Object.values(newTopics)) {
    if (!topics[newTopic.name]) {
      topics[newTopic.name] = newTopic;
    } else if (topics[newTopic.name] !== newTopic) {
      console.warn(`Duplicate dissenting topic name: ${newTopic.name}`);
      console.warn('Original:', topics[newTopic.name]);
      console.warn('Duplicate:', newTopic);
    }
  }
  for (const newPkg of Object.values(newPackages)) {
    if (!packages[newPkg.name]) {
      packages[newPkg.name] = newPkg;
    } else if (packages[newPkg.name] === newPkg) {
      console.log(`Duplicate identical package name: ${newPkg.name}`);
    } else {
      console.warn(`Duplicate dissenting package name: ${newPkg.name}`);
      console.warn('Original:', packages[newPkg.name]);
      console.warn('Duplicate:', newPkg);
    }
  }
  for (const newTopicName in newTopicPackages) {
    if (!topicPackages[newTopicName]) {
      topicPackages[newTopicName] = [];
    }
    topicPackages[newTopicName].push(...newTopicPackages[newTopicName]);
  }

  return { packages, topics, topicPackages };
}

/**
 * Parses the categories of static/data/ecosystem.yaml (or a category's subcategories, keyed by their YAML key).
 *
 * Throws an error naming the YAML path of the first malformed entry: an unknown package key, a field of the wrong
 * type, or a category key that is neither a category field nor a subcategory.
 */
export function parseCategoryMap(
  categories: Record<string, RawCategory>,
  topicPrefix: string | null = null,
  path: string | null = null
): ParsedEcosystem {
  let ecosystem: ParsedEcosystem = { packages: {}, topics: {}, topicPackages: {} };

  for (const [key, rawCategory] of Object.entries(categories)) {
    const categoryPath = path ? `${path}.${key}` : key;
    ecosystem = mergeParsedEcosystems(ecosystem, parseCategory(rawCategory, topicPrefix, categoryPath));
  }

  return ecosystem;
}

function parseCategory(rawCategory: unknown, topicPrefix: string | null, path: string): ParsedEcosystem {
  if (!isMapping(rawCategory) || !isString(rawCategory.name)) {
    fail(
      path,
      `expected a category: a mapping with at least a "name". In a category, keys other than ` +
        `${Object.keys(CATEGORY_FIELDS).join(', ')} hold nested subcategories.`
    );
  }

  const rawSubcategories: Record<string, RawCategory> = {};
  for (const [key, value] of Object.entries(rawCategory)) {
    const spec = fieldSpec(CATEGORY_FIELDS, key);
    if (spec) {
      checkField(path, key, value, spec);
    } else {
      // Validated when it is parsed as a category, below.
      rawSubcategories[key] = value as RawCategory;
    }
  }

  const { name, description, icon, packages: rawPackages = [] } = rawCategory as RawCategory;

  const topicName: string = topicPrefix ? `${topicPrefix}/${name}` : name;

  const categoryRichTopicName: RichTopicName = {
    name: topicName,
    icon,
  };

  const categoryTopic: Topic = {
    ...categoryRichTopicName,
    description,
    featured: [],
  };

  const topics: Record<string, Topic> = {};
  topics[topicName] = categoryTopic;

  const packages: Record<string, Package> = {};

  const topicPackages: Record<string, string[]> = {};
  topicPackages[topicName] = [];

  rawPackages.forEach((value, index) => {
    const rawPkg = parseRawPackage(value, `${path}.packages[${index}]`);
    const { topics: pkgTopics = [] } = rawPkg;
    const pkg: Package = {
      name: rawPkg.name,
      githubRepo: rawPkg.github_repo,
      warn: rawPkg.warn,
      demoAvailable: rawPkg.demo_available,
      docsUrl: rawPkg.docs_url,
      paperUrl: rawPkg.paper_url,
      pypiName: rawPkg.pypi_name,
      physionetUrl: rawPkg.physionet_url,
      topics: [categoryRichTopicName],
      medsDev: rawPkg.meds_dev
        ? {
            entityType: rawPkg.meds_dev.entity_type as MedsEntityType,
            name: rawPkg.meds_dev.name,
          }
        : undefined,
    };
    packages[pkg.name] = pkg;
    categoryTopic.featured?.push(pkg.name);
    topicPackages[topicName].push(pkg.name);
    for (const topic of pkgTopics) {
      const newTopic: RichTopicName = { name: topic };
      if (!topics[topic]) {
        topics[topic] = newTopic as Topic;
      }
      if (!topicPackages[topic]) {
        topicPackages[topic] = [];
      }
      topicPackages[topic].push(pkg.name);
      pkg.topics?.push(newTopic);
    }
  });

  const nestedEcosystem = parseCategoryMap(rawSubcategories, topicName, path);

  for (const [pkgName, pkg] of Object.entries(nestedEcosystem.packages)) {
    if (!pkg.topics) {
      pkg.topics = [];
    }
    pkg.topics.push(categoryRichTopicName);
    topics[topicName].featured?.push(pkgName);
    topicPackages[topicName].push(pkgName);
  }

  return mergeParsedEcosystems({ packages, topics, topicPackages }, nestedEcosystem);
}
