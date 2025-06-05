import { parseTree } from '../MEDS-DEV/parse_tree';

describe('parseTree', () => {
  it('builds nested tree from flat tree', () => {
    const data = {
      root: { name: 'root', data: { value: 1 }, children: ['child'] },
      child: { name: 'child', data: { value: 2 }, children: [] },
    };
    const tree = parseTree(data);
    expect(Object.keys(tree)).toEqual(['root']);
    expect(tree.root.children.child.name).toBe('child');
  });

  it('throws for missing child', () => {
    const bad = {
      a: { name: 'a', data: {}, children: ['missing'] },
    } as any;
    expect(() => parseTree(bad)).toThrow('Child key missing not found in data');
  });
});
