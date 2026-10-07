import React from 'react';
import { SdfNode, isGroup } from '../../geometry/sdf/tree';
import { nodeLabel } from '../../geometry/sdf/formula';
import { findNode } from '../../geometry/sdf/treeOps';
import { NodeInspector } from './NodeInspector';
import { KindPicker, NodeMenu } from './NodeMenu';
import { TreeEditorProps, nodeSummary } from './actions';
import { Hint } from '../ui';

/** desktop: the whole tree as an indented outline, the selected node is edited below it */
export const OutlineEditor: React.FC<TreeEditorProps> = ({ pattern, selected, onSelect, onAction, onChange }) => {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((i) => i !== id)) : new Set([...c, id])));

  const renderNode = (node: SdfNode, isRoot: boolean): React.ReactNode => {
    const open = isGroup(node) && !collapsed.has(node.id);
    return (
      <li key={node.id}>
        <div className={node.id === selected ? 'node selected' : 'node'} onClick={() => onSelect(node.id)}>
          {isGroup(node) ? (
            <button
              className='caret'
              aria-label={open ? 'collapse' : 'expand'}
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
            >
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className='caret' />
          )}
          <KindPicker node={node} pattern={pattern} onChange={onChange} />
          <span className='name'>{nodeLabel(node, pattern.svgs)}</span>
          <span className='meta'>{nodeSummary(node)}</span>
          <NodeMenu node={node} pattern={pattern} isRoot={isRoot} onAction={(a) => onAction(node.id, a)} />
        </div>
        {open && node.children.length > 0 && <ul>{node.children.map((c) => renderNode(c, false))}</ul>}
      </li>
    );
  };

  const node = selected ? findNode(pattern.root, selected) : undefined;
  return (
    <>
      <ul className='tree'>{renderNode(pattern.root, true)}</ul>
      {node ? (
        <div className='inspector'>
          <NodeInspector node={node} pattern={pattern} onChange={onChange} />
        </div>
      ) : (
        <Hint>Select a node to edit it, its icon to change its kind, ⋯ to add, wrap or remove.</Hint>
      )}
    </>
  );
};
