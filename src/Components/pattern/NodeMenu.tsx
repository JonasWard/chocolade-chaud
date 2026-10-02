import React from 'react';
import { DistanceMethodType } from '../../geometry/sdMethods';
import { IPattern, NodeKind, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { KIND_LABEL, methodLabel, nodeLabel } from '../../geometry/sdf/formula';
import { canUnwrap, findPath, moveTargets } from '../../geometry/sdf/treeOps';
import { IPickerSection, Picker } from '../Picker';
import { NodeAction } from './actions';
import { ActionIcon, KindIcon } from './icons';

/** a kind of node, a method is a kind of its own */
export type KindChoice = DistanceMethodType | Exclude<NodeKind, 'method'>;

const KIND_GROUPS: { title: string; kinds: KindChoice[] }[] = [
  { title: 'Methods', kinds: Object.values(DistanceMethodType) },
  { title: 'Shapes', kinds: ['svg', 'text', 'sine', 'constant'] },
  { title: 'Booleans', kinds: ['union', 'difference', 'intersection'] },
  { title: 'Arithmetic', kinds: ['add', 'subtract'] },
  { title: 'Chain', kinds: ['chain'] },
];

const isMethod = (k: KindChoice): k is DistanceMethodType => k in DistanceMethodType;
export const kindLabel = (k: KindChoice) => (isMethod(k) ? methodLabel(k) : KIND_LABEL[k]);
export const kindIcon = (k: KindChoice) => (isMethod(k) ? <KindIcon kind='method' method={k} /> : <KindIcon kind={k} />);

/** the kinds in their groups, as values made by value */
const kindSections = <T,>(value: (k: KindChoice) => T, only?: (k: KindChoice) => boolean): IPickerSection<T>[] =>
  KIND_GROUPS.map(({ title, kinds }) => ({
    title,
    items: kinds.filter((k) => !only || only(k)).map((k) => ({ value: value(k), label: kindLabel(k), icon: kindIcon(k) })),
  }));

export const KIND_SECTIONS = kindSections((k) => k);
const isGroupKind = (k: KindChoice) => KIND_GROUPS.slice(2).some((g) => g.kinds.includes(k));
const addAction = (k: KindChoice): NodeAction => (isMethod(k) ? `add:method:${k}` : `add:${k}`);
export const ADD_SECTIONS = kindSections(addAction);
export const WRAP_SECTIONS = kindSections((k) => `wrap:${k}` as NodeAction, isGroupKind);

/** the groups the node can move into, by the path to them */
const moveSection = ({ root, svgs }: IPattern, id: string): IPickerSection<NodeAction> => ({
  title: 'Move into',
  items: moveTargets(root, id).map(({ group, path }) => ({
    value: `move-into:${group.id}`,
    label: path.map((n) => nodeLabel(n, svgs)).join(' › '),
    icon: <KindIcon kind={group.kind} />,
    hint: group.kind === 'chain' ? 'as innermost' : undefined,
  })),
});

const editSection = ({ root, svgs }: IPattern, node: SdfNode, isRoot: boolean): IPickerSection<NodeAction> => {
  const path = findPath(root, node.id) ?? [];
  const parent = path.at(-2);
  return {
    title: 'Edit',
    items: [
      ...(isRoot
        ? []
        : [
            { value: 'up' as const, label: 'Move up', icon: <ActionIcon action='up' /> },
            { value: 'down' as const, label: 'Move down', icon: <ActionIcon action='down' /> },
          ]),
      ...(parent && path.length > 2 ? [{ value: 'move-out' as const, label: `Move out of ${nodeLabel(parent, svgs)}`, icon: <ActionIcon action='out' /> }] : []),
      ...(canUnwrap(root, node.id) ? [{ value: 'unwrap' as const, label: 'Unwrap', hint: 'replace by its children', icon: <ActionIcon action='unwrap' /> }] : []),
      ...(isRoot
        ? []
        : [
            { value: 'duplicate' as const, label: 'Duplicate', icon: <ActionIcon action='duplicate' /> },
            { value: 'delete' as const, label: 'Delete', icon: <ActionIcon action='delete' /> },
          ]),
    ],
  };
};

const titled = (prefix: string, sections: IPickerSection<NodeAction>[]) => sections.map((s) => ({ ...s, title: `${prefix} · ${s.title}` }));

/** what can be done with a node: add a child to a group, move it into or out of a group, wrap or unwrap it, duplicate or delete it */
export const NodeMenu: React.FC<{ node: SdfNode; pattern: IPattern; isRoot: boolean; onAction: (action: NodeAction) => void }> = ({
  node,
  pattern,
  isRoot,
  onAction,
}) => (
  <Picker<NodeAction>
    label='actions'
    className='menu'
    trigger='⋯'
    sections={[
      ...(isGroup(node) ? titled('Add', ADD_SECTIONS) : []),
      moveSection(pattern, node.id),
      ...titled('Wrap in', WRAP_SECTIONS),
      editSection(pattern, node, isRoot),
    ]}
    onPick={onAction}
  />
);

/** one kind of action on a node behind a button: adding a child or wrapping it */
export const ActionPicker: React.FC<{ label: string; sections: IPickerSection<NodeAction>[]; onAction: (action: NodeAction) => void }> = ({
  label,
  sections,
  onAction,
}) => <Picker<NodeAction> label={label} trigger={label} sections={sections} onPick={onAction} />;
