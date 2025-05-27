import { MedsEntityFlatTree, MedsEntityNestedTree, MedsEntityNestedTreeNode } from './types';

function parseTreeNode<T>(
  data: MedsEntityFlatTree<T>,
  key: string,
  tree: MedsEntityNestedTree<T>,
  seen: Set<string>
): MedsEntityNestedTreeNode<T> {
  if (!(key in data)) {
    throw new Error(`Key ${key} not found in data`);
  }

  const { children, ...rest } = data[key];

  const parsedChildren: MedsEntityNestedTree<T> = {};
  const node: MedsEntityNestedTreeNode<T> = { ...rest, children: parsedChildren };

  for (const childKey of children) {
    if (childKey in tree) {
      node.children[childKey] = tree[childKey];
      delete tree[childKey];
    } else if (childKey in data) {
      node.children[childKey] = parseTreeNode(data, childKey, tree, seen);
      seen.add(childKey);
    } else {
      throw new Error(`Child key ${childKey} not found in data`);
    }
  }

  seen.add(key);
  return node;
}

export function parseTree<T>(data: MedsEntityFlatTree<T>): MedsEntityNestedTree<T> {
  const tree: MedsEntityNestedTree<T> = {};
  const seen = new Set<string>();

  for (const key of Object.keys(data)) {
    if (!seen.has(key)) {
      tree[key] = parseTreeNode(data, key, tree, seen);
    }
  }

  return tree;
}
