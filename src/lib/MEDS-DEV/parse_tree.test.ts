import { parseTree } from '@site/src/lib/MEDS-DEV/parse_tree';
import { MedsEntityFlatTree } from '@site/src/lib/MEDS-DEV/types';

type Dummy = { value?: number };

describe('parseTree', () => {
  it('converts a flat tree to nested structure', () => {
    const flat: MedsEntityFlatTree<Dummy> = {
      root: { name: 'root', data: { value: 1 }, children: ['child1', 'child2'] },
      child1: { name: 'child1', data: { value: 2 }, children: [] },
      child2: { name: 'child2', data: { value: 3 }, children: [] },
    };
    const tree = parseTree(flat);
    expect(Object.keys(tree)).toEqual(['root']);
    expect(tree.root.children.child1.data.value).toBe(2);
    expect(tree.root.children.child2.data.value).toBe(3);
  });

  it('throws when child is missing', () => {
    const flat: MedsEntityFlatTree<Dummy> = {
      root: { name: 'root', data: {}, children: ['missing'] },
    } as any;
    expect(() => parseTree(flat)).toThrow('Child key missing not found in data');
  });
});
