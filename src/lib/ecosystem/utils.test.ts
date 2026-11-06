import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { parseCategoryMap, mergeParsedEcosystems } from '@site/src/lib/ecosystem/utils';
import { RawCategory } from '@site/src/lib/ecosystem/types';
import { MedsEntityType } from '@site/src/lib/MEDS-DEV/types';

describe('parseCategoryMap', () => {
  it('handles nested categories and package topics', () => {
    const data: Record<string, RawCategory> = {
      root: {
        name: 'Root',
        packages: [{ name: 'pkg1' }],
        child: {
          name: 'Child',
          packages: [{ name: 'pkg2' }, { name: 'pkg3', topics: ['extra'] }],
        } as unknown as RawCategory,
      },
    };

    const { packages, topics, topicPackages } = parseCategoryMap(data);
    expect(Object.keys(packages).sort()).toEqual(['pkg1', 'pkg2', 'pkg3']);
    expect(Object.keys(topics)).toEqual(expect.arrayContaining(['Root', 'Root/Child', 'extra']));
    expect(topics['Root/Child'].featured).toEqual(['pkg2', 'pkg3']);
    expect(topicPackages['Root']).toEqual(['pkg1', 'pkg2', 'pkg3']);
    expect(topicPackages['Root/Child']).toEqual(['pkg2', 'pkg3']);
    expect(topicPackages['extra']).toEqual(['pkg3']);
  });

  it('parses the PhysioNet URL and the MEDS-DEV entity of a package', () => {
    const { packages } = parseCategoryMap({
      cat: {
        name: 'Cat',
        packages: [
          { name: 'Demo data', physionet_url: 'https://physionet.org/content/demo/1.0/' },
          { name: 'A model', meds_dev: { entity_type: 'model', name: 'a_model' } },
        ],
      },
    });

    expect(packages['Demo data'].physionetUrl).toBe('https://physionet.org/content/demo/1.0/');
    expect(packages['Demo data'].medsDev).toBeUndefined();
    expect(packages['A model'].medsDev).toEqual({ entityType: MedsEntityType.MODEL, name: 'a_model' });
  });

  describe('rejects malformed entries instead of silently dropping them', () => {
    const parseWith = (category: Record<string, unknown>) => () =>
      parseCategoryMap({ cat: { name: 'Cat', ...category } as RawCategory });

    it('rejects category keys that are not subcategories, such as a `datasets` list (#83)', () => {
      expect(parseWith({ datasets: [{ name: 'MIMIC-IV Demo', physionet_url: 'https://x' }] })).toThrow(
        'at cat.datasets: expected a category'
      );
      expect(parseWith({ descripton: 'typo' })).toThrow('at cat.descripton: expected a category');
      expect(parseWith({ child: { description: 'no name' } })).toThrow('at cat.child: expected a category');
    });

    it('rejects category fields of the wrong type', () => {
      expect(parseWith({ packages: { name: 'not a list' } })).toThrow(
        'at cat: "packages" must be a list of packages'
      );
    });

    it('rejects unknown package keys, such as the old flat `MEDS_DEV_name` (#82)', () => {
      expect(parseWith({ packages: [{ name: 'CEHR-BERT', MEDS_DEV_name: 'cehrbert' }] })).toThrow(
        'at cat.packages[0] ("CEHR-BERT"): unknown package key "MEDS_DEV_name"'
      );
      // Keys inherited from Object.prototype are not package fields either.
      expect(parseWith({ packages: [{ name: 'p', constructor: 'x' }] })).toThrow('unknown package key');
    });

    it('rejects packages without a name', () => {
      expect(parseWith({ packages: [{ github_repo: 'org/repo' }] })).toThrow(
        'at cat.packages[0]: expected a package'
      );
      expect(parseWith({ packages: ['just a string'] })).toThrow('at cat.packages[0]: expected a package');
    });

    it('rejects package fields of the wrong type', () => {
      expect(parseWith({ packages: [{ name: 'p', demo_available: 'yes' }] })).toThrow(
        '"demo_available" must be true or false, got "yes"'
      );
      expect(parseWith({ packages: [{ name: 'p', topics: 'one' }] })).toThrow(
        '"topics" must be a list of strings'
      );
      expect(parseWith({ packages: [{ name: 'p', meds_dev: 'cehrbert' }] })).toThrow(
        '"meds_dev" must be a mapping'
      );
      expect(parseWith({ packages: [{ name: 'p', meds_dev: { entity_type: 'tool', name: 'x' } }] })).toThrow(
        '"meds_dev" must be a mapping'
      );
      expect(
        parseWith({ packages: [{ name: 'p', meds_dev: { entity_type: 'model', name: 'x', extra: 1 } }] })
      ).toThrow('"meds_dev" must be a mapping');
    });
  });
});

describe('static/data/ecosystem.yaml', () => {
  const yamlPath = path.join(__dirname, '..', '..', '..', 'static', 'data', 'ecosystem.yaml');
  const { packages, topics, topicPackages } = parseCategoryMap(parse(fs.readFileSync(yamlPath, 'utf8')));

  it('parses without creating topics for non-category keys', () => {
    expect(Object.keys(topics).filter(topic => topic.includes('undefined'))).toEqual([]);
  });

  it('includes the MIMIC-IV Demo dataset, linked to PhysioNet (#83)', () => {
    expect(packages['MIMIC-IV Demo'].physionetUrl).toBe(
      'https://physionet.org/content/mimic-iv-demo-meds/0.0.1/'
    );
    expect(topicPackages['Dataset ETLs/Public Datasets']).toContain('MIMIC-IV Demo');
  });

  it('links the models and datasets in the MEDS-DEV registry to their MEDS-DEV entities (#82)', () => {
    expect(packages['CEHR-BERT'].medsDev).toEqual({ entityType: MedsEntityType.MODEL, name: 'cehrbert' });
    expect(packages['MEDS-Tab'].medsDev).toEqual({ entityType: MedsEntityType.MODEL, name: 'meds_tab' });
    expect(packages['GenHPF'].medsDev).toEqual({ entityType: MedsEntityType.MODEL, name: 'genhpf' });
    expect(packages['MIMIC-IV'].medsDev).toEqual({ entityType: MedsEntityType.DATASET, name: 'MIMIC-IV' });
  });
});

describe('mergeParsedEcosystems', () => {
  it('combines packages and topics from multiple ecosystems', () => {
    const eco1 = parseCategoryMap({ cat1: { name: 'Cat1', packages: [{ name: 'a' }] } });
    const eco2 = parseCategoryMap({ cat2: { name: 'Cat2', packages: [{ name: 'b' }] } });

    const merged = mergeParsedEcosystems(eco1, eco2);

    expect(Object.keys(merged.packages).sort()).toEqual(['a', 'b']);
    expect(Object.keys(merged.topics)).toEqual(expect.arrayContaining(['Cat1', 'Cat2']));
    expect(merged.topicPackages['Cat1']).toEqual(['a']);
    expect(merged.topicPackages['Cat2']).toEqual(['b']);
  });
});
