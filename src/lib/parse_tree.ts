export interface TreeNode {
  children: Record<string, TreeNode>;
  [key: string]: any;
}

type FlatTree = Record<string, { children: string[] } & Record<string, any>>;
type ParsedTree = Record<string, TreeNode>;

function parseTreeNode(
  data: FlatTree,
  key: string,
  tree: ParsedTree,
  seen: Set<string>
): ParsedTree {
  if (!(key in data)) {
    throw new Error(`Key ${key} not found in data`);
  }

  const { children, ...rest } = data[key];
  const node: TreeNode = { ...rest, children: {} };

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

  tree[key] = node;
  seen.add(key);
  return tree;
}

export function parseTree(data: FlatTree): ParsedTree {
  const tree: ParsedTree = {};
  const seen = new Set<string>();

  for (const key of Object.keys(data)) {
    if (!seen.has(key)) {
      parseTreeNode(data, key, tree, seen);
    }
  }

  return tree;
}

