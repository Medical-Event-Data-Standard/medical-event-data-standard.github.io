import { parseCategoryMap, mergeParsedEcosystems } from '@site/src/lib/ecosystem/utils';
import { RawCategory } from '@site/src/lib/ecosystem/types';

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
