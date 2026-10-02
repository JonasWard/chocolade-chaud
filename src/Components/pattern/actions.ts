import { DistanceMethodType } from '../../geometry/sdMethods';
import { GROUP_KINDS, GroupKind, IPattern, NodeKind, SdfNode, constantNode, groupNode, methodNode, sineNode, svgNode } from '../../geometry/sdf/tree';
import { duplicateNode, findParent, insertChild, moveNode, removeNode, wrapNode } from '../../geometry/sdf/treeOps';
import { formatNumber } from '../../geometry/sdf/formula';

// what the menu of a node can do, as the value of an option: 'add:union', 'wrap:chain', 'delete', ...
export type NodeAction = `add:${NodeKind}` | `wrap:${GroupKind}` | 'duplicate' | 'up' | 'down' | 'delete';

export const firstAsset = (pattern: IPattern): string => Object.keys(pattern.svgs)[0] ?? '';

export const newNode = (kind: NodeKind, pattern: IPattern): SdfNode => {
  switch (kind) {
    case 'method':
      return methodNode(DistanceMethodType.SDGyroid);
    case 'svg':
      return svgNode(firstAsset(pattern));
    case 'sine':
      return sineNode();
    case 'constant':
      return constantNode();
    default:
      return groupNode(kind);
  }
};

/** the tree after the action on the node with the id, and the node to select after it */
export const applyAction = (pattern: IPattern, id: string, action: NodeAction): { root: SdfNode; select?: string } => {
  const { root } = pattern;
  const [verb, kind] = action.split(':') as [string, NodeKind];
  switch (verb) {
    case 'add': {
      const child = newNode(kind, pattern);
      return { root: insertChild(root, id, child), select: child.id };
    }
    case 'wrap': {
      const wrapped = wrapNode(root, id, kind as GroupKind);
      return { root: wrapped.root, select: wrapped.group.id };
    }
    case 'duplicate': {
      const { root: next, copy } = duplicateNode(root, id);
      return { root: next, select: copy?.id };
    }
    case 'up':
      return { root: moveNode(root, id, -1) };
    case 'down':
      return { root: moveNode(root, id, 1) };
    case 'delete':
      return { root: removeNode(root, id), select: findParent(root, id)?.id };
  }
  return { root };
};

export const ADDABLE: NodeKind[] = ['method', 'svg', 'sine', 'constant', ...GROUP_KINDS];

/** the scale and smooth radius of a node, next to its name in the tree */
export const nodeSummary = (node: SdfNode): string =>
  [node.kind !== 'constant' && node.scale !== 1 && `@${formatNumber(node.scale)}`, 'smooth' in node && node.smooth > 0 && `~${formatNumber(node.smooth)}`]
    .filter(Boolean)
    .join(' ');

export interface TreeEditorProps {
  pattern: IPattern;
  selected?: string;
  onSelect: (id: string) => void;
  onAction: (id: string, action: NodeAction) => void;
  /** replaces the node with the same id */
  onChange: (node: SdfNode) => void;
}
