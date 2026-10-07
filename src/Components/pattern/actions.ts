import { DistanceMethodType } from '../../geometry/sdMethods';
import { GroupKind, IPattern, NodeKind, SdfNode, constantNode, groupNode, isGroup, methodNode, svgNode, textNode } from '../../geometry/sdf/tree';
import { duplicateNode, findNode, findParent, insertChild, moveInto, moveNode, moveOut, removeNode, unwrap, wrapNode } from '../../geometry/sdf/treeOps';
import { formatNumber } from '../../geometry/sdf/formula';

// what the menu of a node can do, as the value of an option: 'add:union', 'wrap:chain', 'delete', ...
export type NodeAction =
  | `add:${NodeKind}`
  | `add:method:${DistanceMethodType}`
  | `wrap:${GroupKind}`
  | `move-into:${string}`
  | 'move-out'
  | 'unwrap'
  | 'duplicate'
  | 'up'
  | 'down'
  | 'delete';

export const firstAsset = (pattern: IPattern): string => Object.keys(pattern.svgs)[0] ?? '';

export const newNode = (kind: NodeKind, pattern: IPattern, method = DistanceMethodType.SDGyroid): SdfNode => {
  switch (kind) {
    case 'method':
      return methodNode(method);
    case 'svg':
      return svgNode(firstAsset(pattern));
    case 'text':
      return textNode();
    case 'constant':
      return constantNode();
    default:
      return groupNode(kind);
  }
};

/** the tree after the action on the node with the id, and the node to select after it */
export const applyAction = (pattern: IPattern, id: string, action: NodeAction): { root: SdfNode; select?: string } => {
  const { root } = pattern;
  const [verb, kind, method] = action.split(':') as [string, NodeKind, DistanceMethodType | undefined];
  switch (verb) {
    case 'add': {
      const child = newNode(kind, pattern, method);
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
    // the moved node stays selected, its id does not change
    case 'move-into':
      return { root: moveInto(root, id, kind), select: id };
    case 'move-out':
      return { root: moveOut(root, id), select: id };
    case 'unwrap': {
      const group = findNode(root, id);
      return { root: unwrap(root, id), select: group && isGroup(group) ? group.children[0]?.id : undefined };
    }
  }
  return { root };
};


/** the scale and smooth radius of a node, next to its name in the tree */
export const nodeSummary = (node: SdfNode): string =>
  [node.kind !== 'constant' && node.scale !== 1 && `@${formatNumber(node.scale)}`, 'smooth' in node && node.smooth > 0 && `~${formatNumber(node.smooth)}`]
    .filter(Boolean)
    .join(' ');

/** the key attributes of a node in a few words, for a closed card */
export const nodeDetails = (node: SdfNode): string => {
  const f = formatNumber;
  const own = (() => {
    switch (node.kind) {
      case 'svg':
        return [`${f(node.width)} mm`, node.repeat > 0 && `↻ ${f(node.repeat)}`];
      case 'text':
        return [node.font, `${f(node.size)} mm`, node.curve?.mode];
      case 'sine':
        // amplitude and period are in its name
        return [`${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`];
      case 'method':
      case 'constant':
        return [];
      default:
        return [`${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`, 'smooth' in node && node.smooth > 0 && `~${f(node.smooth)}`];
    }
  })();
  return [...own, node.kind !== 'constant' && node.scale !== 1 && `@${f(node.scale)}`, node.gain !== 1 && `×${f(node.gain)}`].filter(Boolean).join(' · ');
};

export interface TreeEditorProps {
  pattern: IPattern;
  selected?: string;
  onSelect: (id: string) => void;
  onAction: (id: string, action: NodeAction) => void;
  /** replaces the node with the same id */
  onChange: (node: SdfNode) => void;
}
