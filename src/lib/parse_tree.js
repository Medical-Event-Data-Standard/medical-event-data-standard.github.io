export const LEAF = 'leaf';
export const BRANCH = 'branch';

function parse_tree_node(data, key, tree, seen) {
  // Check if the key exists in data
  if (!(key in data)) {
    throw new Error(`Key ${key} not found in data`);
  }

  const { children, ...rest } = data[key];
  let node = { ...rest };
  node['children'] = {};

  for (const child_key of children) {
    if (child_key in tree) {
      // remove the child from the tree and add it to the node.
      const child_node = tree[child_key];
      delete tree[child_key];
      node.children[child_key] = child_node;
    } else if (child_key in data) {
      node.children[child_key] = parse_tree_node(data, child_key, tree, seen);
      seen.add(child_key);
    } else {
      throw new Error(`Child key ${child_key} not found in data`);
    }
  }
  tree[key] = node;
  seen.add(key);
  return tree;
}

export function parse_tree(data) {
  // Parse the tree structure from the data
  // data is a dictionary mapping keys to values; values may have a children parameter which is a list of
  // the keys of the children of the value.
  // The function returns a dictionary mapping keys to values; values are objects with the same parameters as
  // the input, but now the children parameter is a dictionary mapping child keys to the children values, and
  // only root nodes are present in the returned object at the top level.

  let tree = {};
  let seen = new Set();

  console.log('parse_tree', data);

  for (const [key, value] of Object.entries(data)) {
    if (seen.has(key)) {
      continue;
    }
    tree = parse_tree_node(data, key, tree, seen);
  }

  return tree;
}
