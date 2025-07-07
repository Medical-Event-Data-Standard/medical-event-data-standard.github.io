import { RawCategory, Package, RichTopicName, Topic, ParsedEcosystem } from './types';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

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

export function parseCategoryMap(
  categories: Record<string, RawCategory>,
  topicPrefix: string | null = null
): ParsedEcosystem {
  let ecosystem: ParsedEcosystem = { packages: {}, topics: {}, topicPackages: {} };

  for (const rawCategory of Object.values(categories)) {
    ecosystem = mergeParsedEcosystems(ecosystem, parseCategory(rawCategory, topicPrefix));
  }

  return ecosystem;
}

function parseCategory(rawCategory: RawCategory, topicPrefix: string | null = null): ParsedEcosystem {
  const { name, description, icon, packages: rawPackages, ...rawSubcategories } = rawCategory;

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

  for (const rawPkg of rawPackages || []) {
    const { topics: pkgTopics = [] } = rawPkg;
    const pkg: Package = {
      name: rawPkg.name,
      githubRepo: rawPkg.github_repo,
      warn: rawPkg.warn,
      demoAvailable: rawPkg.demo_available,
      docsUrl: rawPkg.docs_url,
      paperUrl: rawPkg.paper_url,
      pypiName: rawPkg.pypi_name,
      topics: [categoryRichTopicName],
      medsDev: rawPkg['MEDS-DEV']
        ? {
            entityType: rawPkg['MEDS-DEV'].entity_type as MedsEntityType,
            name: rawPkg['MEDS-DEV'].name,
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
  }

  if (!rawSubcategories) {
    return { packages, topics, topicPackages };
  }

  const subcategories: Record<string, RawCategory> = {};
  for (const [key, rawSubcategory] of Object.entries(rawSubcategories)) {
    if (typeof rawSubcategory === 'object') {
      subcategories[key] = rawSubcategory as RawCategory;
    } else {
      console.warn(`Invalid subcategory format for ${key}:`, rawSubcategory);
    }
  }

  const nestedEcosystem = parseCategoryMap(subcategories, topicName);

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
