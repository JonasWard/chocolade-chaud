import React from 'react';
import { GROUP_KINDS, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { KIND_GLYPH, KIND_LABEL } from '../../geometry/sdf/formula';
import { ADDABLE, NodeAction } from './actions';

const option = (value: NodeAction, text: string) => (
  <option key={value} value={value}>
    {text}
  </option>
);

export const addOptions = ADDABLE.map((k) => option(`add:${k}`, `${KIND_GLYPH[k]} ${KIND_LABEL[k]}`));
export const wrapOptions = GROUP_KINDS.map((k) => option(`wrap:${k}`, `${KIND_GLYPH[k]} ${KIND_LABEL[k]}`));

/** the actions of a node as a native select, so it is a proper picker on a phone */
export const NodeMenu: React.FC<{ node: SdfNode; isRoot: boolean; onAction: (action: NodeAction) => void }> = ({ node, isRoot, onAction }) => (
  <select
    className='menu'
    value=''
    aria-label='actions'
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => onAction(e.target.value as NodeAction)}
  >
    <option value='' disabled hidden>
      ⋯
    </option>
    {isGroup(node) && <optgroup label='Add'>{addOptions}</optgroup>}
    <optgroup label='Wrap in'>{wrapOptions}</optgroup>
    {!isRoot && (
      <optgroup label='Edit'>
        {option('duplicate', 'Duplicate')}
        {option('up', 'Move up')}
        {option('down', 'Move down')}
        {option('delete', 'Delete')}
      </optgroup>
    )}
  </select>
);

/** a select that does one kind of action on a node, with a label as its first option */
export const ActionSelect: React.FC<{ label: string; options: React.ReactNode; onAction: (action: NodeAction) => void }> = ({ label, options, onAction }) => (
  <select value='' aria-label={label} onChange={(e) => onAction(e.target.value as NodeAction)}>
    <option value='' disabled hidden>
      {label}
    </option>
    {options}
  </select>
);
