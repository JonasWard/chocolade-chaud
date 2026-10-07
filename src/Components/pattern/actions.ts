import { DistanceMethodType } from '../../geometry/sdMethods';
import { GroupKind, IPattern, NodeKind, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { duplicateNode, findNode, findParent, insertChild, moveInto, moveNode, moveOut, removeNode, unwrap, wrapNode } from '../../geometry/sdf/treeOps';
import { newNode } from './kinds';

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
