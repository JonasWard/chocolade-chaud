import { GroupKind, GroupNode, NodeKind, SdfNode, constantNode, groupNode, isGroup, methodNode, newId, sineNode, svgNode, textNode } from './tree';
import { DistanceMethodType } from '../sdMethods';

// immutable edits of the tree, the subtrees that don't change are shared

/** the nodes from the root down to the node with the id */
export const findPath = (root: SdfNode, id: string): SdfNode[] | undefined => {
  if (root.id === id) return [root];
  if (!isGroup(root)) return undefined;
  for (const child of root.children) {
    const path = findPath(child, id);
    if (path) return [root, ...path];
  }
  return undefined;
};

export const findNode = (root: SdfNode, id: string): SdfNode | undefined => findPath(root, id)?.at(-1);

export const findParent = (root: SdfNode, id: string): GroupNode | undefined => findPath(root, id)?.at(-2) as GroupNode | undefined;

/** replaces the node with the id by what update returns */
export const updateNode = (root: SdfNode, id: string, update: (node: SdfNode) => SdfNode): SdfNode => {
  if (root.id === id) return update(root);
  if (!isGroup(root)) return root;
  const children = root.children.map((c) => updateNode(c, id, update));
  return children.some((c, i) => c !== root.children[i]) ? { ...root, children } : root;
};

const updateChildren = (root: SdfNode, parentId: string, update: (children: SdfNode[]) => SdfNode[]): SdfNode =>
  updateNode(root, parentId, (parent) => (isGroup(parent) ? { ...parent, children: update(parent.children) } : parent));

/** the root can't be removed */
export const removeNode = (root: SdfNode, id: string): SdfNode => {
  const parent = findParent(root, id);
  return parent ? updateChildren(root, parent.id, (children) => children.filter((c) => c.id !== id)) : root;
};

export const insertChild = (root: SdfNode, parentId: string, child: SdfNode, index = Infinity): SdfNode =>
  updateChildren(root, parentId, (children) => [...children.slice(0, index), child, ...children.slice(index)]);

/** moves the node by delta places between its siblings */
export const moveNode = (root: SdfNode, id: string, delta: number): SdfNode => {
  const parent = findParent(root, id);
  if (!parent) return root;
  const from = parent.children.findIndex((c) => c.id === id);
  const to = Math.min(Math.max(from + delta, 0), parent.children.length - 1);
  if (from === to) return root;
  return updateChildren(root, parent.id, (children) => {
    const moved = children.filter((c) => c.id !== id);
    moved.splice(to, 0, children[from]);
    return moved;
  });
};

/** puts the node in a new group, in its place */
export const wrapNode = (root: SdfNode, id: string, kind: GroupKind): { root: SdfNode; group: GroupNode } => {
  let group = groupNode(kind);
  return { root: updateNode(root, id, (node) => (group = { ...group, children: [node] })), group };
};

export const cloneWithNewIds = (node: SdfNode): SdfNode =>
  isGroup(node) ? { ...node, id: newId(), children: node.children.map(cloneWithNewIds) } : { ...node, id: newId() };

/** inserts a copy of the node after it */
export const duplicateNode = (root: SdfNode, id: string): { root: SdfNode; copy?: SdfNode } => {
  const parent = findParent(root, id);
  const node = findNode(root, id);
  if (!parent || !node) return { root };
  const copy = cloneWithNewIds(node);
  return { root: insertChild(root, parent.id, copy, parent.children.indexOf(node) + 1), copy };
};

/**
 * A node of another kind in its place, with the same id. Leaves and groups keep their scale and gain,
 * a group keeps its children, a leaf that turns into a group becomes its first child
 */
export const changeKind = (node: SdfNode, kind: NodeKind, defaultAsset = ''): SdfNode => {
  if (node.kind === kind) return node;
  const keep = { id: node.id, scale: node.scale, gain: node.gain };
  switch (kind) {
    case 'method':
      return { ...methodNode(DistanceMethodType.SDGyroid), ...keep };
    case 'svg':
      return { ...svgNode(defaultAsset), ...keep };
    case 'text':
      return { ...textNode(), ...keep };
    case 'sine':
      return { ...sineNode(), ...keep };
    case 'constant':
      return { ...constantNode(), ...keep };
    default:
      return isGroup(node) ? { ...groupNode(kind, node.children), ...keep } : { ...groupNode(kind, [{ ...node, id: newId() }]), id: node.id };
  }
};

export const countNodes = (node: SdfNode): number => 1 + (isGroup(node) ? node.children.reduce((n, c) => n + countNodes(c), 0) : 0);

/**
 * The scale a node is evaluated at, the product of the scales down to it. Undefined when it varies over space: a child of a chain,
 * other than its last, is evaluated at the output of the child after it
 */
export const staticScale = (root: SdfNode, id: string): number | undefined => {
  const path = findPath(root, id);
  if (!path) return undefined;
  for (let i = 0; i < path.length - 1; i++) {
    const parent = path[i];
    if (parent.kind === 'chain' && parent.children[parent.children.length - 1] !== path[i + 1]) return undefined;
  }
  return path.reduce((s, n) => s * n.scale, 1);
};
