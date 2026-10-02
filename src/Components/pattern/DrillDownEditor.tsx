import React from 'react';
import { isGroup } from '../../geometry/sdf/tree';
import { KIND_GLYPH, formula, nodeLabel } from '../../geometry/sdf/formula';
import { findPath } from '../../geometry/sdf/treeOps';
import { LogSlider } from '../ui';
import { NodeInspector } from './NodeInspector';
import { ActionSelect, NodeMenu, addOptions, wrapOptions } from './NodeMenu';
import { TreeEditorProps } from './actions';

/**
 * mobile: one level of the tree at a time, as cards. A group opens with ›, the breadcrumb goes back up.
 * Tapping a card edits it in place, otherwise it only shows its scale
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
          <span className='glyph'>{KIND_GLYPH[current.kind]}</span> {nodeLabel(current, svgs)} settings
        </summary>
        <NodeInspector node={current} pattern={pattern} onChange={onChange} />
      </details>

      {isGroup(current) &&
        current.children.map((child, i) => (
          <React.Fragment key={child.id}>
            {current.kind === 'chain' && i > 0 && <div className='link'>↑ sets the scale of</div>}
            <div className={child.id === selected ? 'card selected' : 'card'}>
              <header onClick={() => onSelect(child.id === selected ? '' : child.id)}>
                <span className='glyph'>{KIND_GLYPH[child.kind]}</span>
                <span className='name'>
                  {nodeLabel(child, svgs)}
                  {isGroup(child) && <small>{formula(child, svgs)}</small>}
                </span>
                {isGroup(child) && (
                  <button
                    aria-label='open'
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocus(child.id);
                    }}
                  >
                    ›
                  </button>
                )}
                <NodeMenu node={child} isRoot={false} onAction={(a) => onAction(child.id, a)} />
              </header>
              {child.id === selected ? (
                <NodeInspector node={child} pattern={pattern} onChange={onChange} />
              ) : (
                child.kind !== 'constant' && <LogSlider label='scale' value={child.scale} onChange={(scale) => onChange({ ...child, scale })} />
              )}
            </div>
          </React.Fragment>
        ))}

      <div className='row'>
        {isGroup(current) && <ActionSelect label='+ Add' options={addOptions} onAction={(a) => onAction(current.id, a)} />}
        <ActionSelect label='⧉ Wrap in' options={wrapOptions} onAction={(a) => onAction(current.id, a)} />
      </div>
    </>
  );
};
