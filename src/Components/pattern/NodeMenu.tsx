import React from 'react';
import { DistanceMethodType } from '../../geometry/sdMethods';
import { NodeKind, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { KIND_LABEL, methodLabel } from '../../geometry/sdf/formula';
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

const EDIT_SECTION: IPickerSection<NodeAction> = {
  title: 'Edit',
  items: [
    { value: 'duplicate', label: 'Duplicate', icon: <ActionIcon action='duplicate' /> },
    { value: 'up', label: 'Move up', icon: <ActionIcon action='up' /> },
    { value: 'down', label: 'Move down', icon: <ActionIcon action='down' /> },
    { value: 'delete', label: 'Delete', icon: <ActionIcon action='delete' /> },
  ],
};

const titled = (prefix: string, sections: IPickerSection<NodeAction>[]) => sections.map((s) => ({ ...s, title: `${prefix} · ${s.title}` }));

/** what can be done with a node: add a child to a group, wrap it in a group, duplicate, move or delete it */
export const NodeMenu: React.FC<{ node: SdfNode; isRoot: boolean; onAction: (action: NodeAction) => void }> = ({ node, isRoot, onAction }) => (
  <Picker<NodeAction>
    label='actions'
    className='menu'
    trigger='⋯'
    sections={[...(isGroup(node) ? titled('Add', ADD_SECTIONS) : []), ...titled('Wrap in', WRAP_SECTIONS), ...(isRoot ? [] : [EDIT_SECTION])]}
    onPick={onAction}
  />
);

/** one kind of action on a node behind a button: adding a child or wrapping it */
export const ActionPicker: React.FC<{ label: string; sections: IPickerSection<NodeAction>[]; onAction: (action: NodeAction) => void }> = ({
  label,
  sections,
  onAction,
}) => <Picker<NodeAction> label={label} trigger={label} sections={sections} onPick={onAction} />;
