import React from 'react';
import { SdfNode, isGroup } from '../../geometry/sdf/tree';
import { nodeLabel } from '../../geometry/sdf/formula';
import { findPath } from '../../geometry/sdf/treeOps';
import { NodeInspector } from './NodeInspector';
import { ActionSelect, NodeMenu, addOptions, wrapOptions } from './NodeMenu';
import { NodeIcon } from './icons';
import { TreeEditorProps, nodeDetails } from './actions';

/**
 * mobile: one level of the tree at a time, as cards. A group opens with ›, the breadcrumb goes back up.
 * A card is a line with the key attributes of its node, its settings fold open below it
 */
export const DrillDownEditor: React.FC<TreeEditorProps & { focus: string; setFocus: (id: string) => void }> = ({
  pattern,
  selected,
  onSelect,
  onAction,
  onChange,
  focus,
  setFocus,
}) => {
  const path = findPath(pattern.root, focus) ?? [pattern.root];
  const current = path[path.length - 1];
  const { svgs } = pattern;

  // a card is one line until it is opened, then it holds the settings of its node
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.delete(id)) setOpen(next);
    else {
      setOpen(next.add(id));
      onSelect(id);
    }
  };

  const card = (child: SdfNode) => {
    const isOpen = open.has(child.id);
    return (
      <div className={child.id === selected ? 'card selected' : 'card'}>
        <div className='line'>
          <button className='summary' aria-expanded={isOpen} onClick={() => toggle(child.id)}>
            <NodeIcon node={child} svgs={svgs} />
            <span className='name'>{nodeLabel(child, svgs)}</span>
            <span className='meta'>{nodeDetails(child)}</span>
          </button>
          {isGroup(child) && (
            <button aria-label='open' onClick={() => setFocus(child.id)}>
              ›
            </button>
          )}
          <NodeMenu node={child} isRoot={false} onAction={(a) => onAction(child.id, a)} />
        </div>
        {isOpen && <NodeInspector node={child} pattern={pattern} onChange={onChange} />}
      </div>
    );
  };

  return (
    <>
      <nav className='crumbs'>
        {path.length > 1 && (
          <button aria-label='back' onClick={() => setFocus(path[path.length - 2].id)}>
            ‹
          </button>
        )}
        {path.map((n, i) => (
          <React.Fragment key={n.id}>
            {i > 0 && <span>›</span>}
            <button onClick={() => setFocus(n.id)}>{nodeLabel(n, svgs)}</button>
          </React.Fragment>
        ))}
      </nav>

      <details className='card'>
        <summary>
          <NodeIcon node={current} svgs={svgs} /> {nodeLabel(current, svgs)} settings
        </summary>
        <NodeInspector node={current} pattern={pattern} onChange={onChange} />
      </details>

      {isGroup(current) &&
        current.children.map((child, i) => (
          <React.Fragment key={child.id}>
            {current.kind === 'chain' && i > 0 && <div className='link'>↑ sets the scale of</div>}
            {card(child)}
          </React.Fragment>
        ))}

      <div className='row'>
        {isGroup(current) && <ActionSelect label='+ Add' options={addOptions} onAction={(a) => onAction(current.id, a)} />}
        <ActionSelect label='⧉ Wrap in' options={wrapOptions} onAction={(a) => onAction(current.id, a)} />
      </div>
    </>
  );
};
