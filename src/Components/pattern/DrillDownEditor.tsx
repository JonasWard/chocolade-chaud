import React from 'react';
import { SdfNode, isGroup } from '../../geometry/sdf/tree';
import { formatNumber, formula, nodeLabel } from '../../geometry/sdf/formula';
import { findPath } from '../../geometry/sdf/treeOps';
import { LogSlider, NumberField } from '../ui';
import { NodeInspector } from './NodeInspector';
import { ActionSelect, NodeMenu, addOptions, wrapOptions } from './NodeMenu';
import { NodeIcon } from './icons';
import { TreeEditorProps } from './actions';

/**
 * mobile: one level of the tree at a time, as cards. A group opens with ›, the breadcrumb goes back up.
 * A card shows a summary of its node, its settings fold open below it
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

  const card = (child: SdfNode) => (
    <div className={child.id === selected ? 'card selected' : 'card'}>
      <header>
        <NodeIcon node={child} svgs={svgs} />
        <span className='name'>
          {nodeLabel(child, svgs)}
          {isGroup(child) && <small>{formula(child, svgs)}</small>}
        </span>
        {isGroup(child) && (
          <button aria-label='open' onClick={() => setFocus(child.id)}>
            ›
          </button>
        )}
        <NodeMenu node={child} isRoot={false} onAction={(a) => onAction(child.id, a)} />
      </header>
      {child.kind === 'constant' ? (
        <NumberField label='value' value={child.value} step={0.1} onChange={(value) => onChange({ ...child, value })} />
      ) : (
        <LogSlider label='scale' value={child.scale} onChange={(scale) => onChange({ ...child, scale })} />
      )}
      <details className='more' onToggle={(e) => e.currentTarget.open && onSelect(child.id)}>
        <summary>
          Settings{child.gain !== 1 && ` · gain ${formatNumber(child.gain)}`}
          {'smooth' in child && child.smooth > 0 && ` · smooth ${formatNumber(child.smooth)}`}
        </summary>
        <NodeInspector node={child} pattern={pattern} onChange={onChange} hideScale />
      </details>
    </div>
  );

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
