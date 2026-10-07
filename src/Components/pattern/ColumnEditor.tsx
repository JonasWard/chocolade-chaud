import React from 'react';
import { GroupNode, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { nodeLabel } from '../../geometry/sdf/formula';
import { findPath } from '../../geometry/sdf/treeOps';
import { NodeInspector } from './NodeInspector';
import { ADD_SECTIONS, ActionPicker, KindPicker, NodeMenu, WRAP_SECTIONS } from './NodeMenu';
import { TreeEditorProps } from './actions';
import { nodeDetails } from './kinds';

const scrollBehavior = (): ScrollBehavior => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/**
 * mobile: every level of the tree down to the opened group is a column of one-line cards, in a strip that snaps to them.
 * › opens a group in a column after it, swiping back shows its parents, the column it came from marked.
 * A card holds the key attributes of its node, its settings fold open below it
 */
export const ColumnEditor: React.FC<TreeEditorProps & { focus: string; setFocus: (id: string) => void }> = ({
  pattern,
  selected,
  onSelect,
  onAction,
  onChange,
  focus,
  setFocus,
}) => {
  const { root, svgs } = pattern;
  // the groups from the root down to the opened one
  const path = findPath(root, focus) ?? [root];
  const groups = path.filter(isGroup);
  const strip = React.useRef<HTMLDivElement>(null);

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

  // opening a group slides to its column
  React.useLayoutEffect(() => {
    strip.current?.scrollTo({ left: strip.current.scrollWidth, behavior: scrollBehavior() });
  }, [focus, groups.length]);

  // a tap in a column that is only partly in view brings it in
  const reveal = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.scrollIntoView({ behavior: scrollBehavior(), inline: 'nearest', block: 'nearest' });
  const back = (i: number) => (e: React.MouseEvent) => {
    // not revealing the column it is in
    e.stopPropagation();
    (strip.current?.children[i - 1] as HTMLElement | undefined)?.scrollIntoView({ behavior: scrollBehavior(), inline: 'nearest', block: 'nearest' });
  };

  const card = (child: SdfNode, onPath: boolean, isRoot = false) => {
    const isOpen = open.has(child.id);
    return (
      <div className={['card', child.id === selected && 'selected', onPath && 'on-path'].filter(Boolean).join(' ')}>
        <div className='line'>
          <KindPicker node={child} pattern={pattern} onChange={onChange} />
          <button className='summary' aria-expanded={isOpen} onClick={() => toggle(child.id)}>
            <span className='name'>{nodeLabel(child, svgs)}</span>
            <span className='meta'>{nodeDetails(child)}</span>
          </button>
          {isGroup(child) && (
            <button
              aria-label='open'
              className={onPath ? 'active' : ''}
              onClick={(e) => {
                // the strip slides to the new column instead
                e.stopPropagation();
                setFocus(child.id);
              }}
            >
              ›
            </button>
          )}
          <NodeMenu node={child} pattern={pattern} isRoot={isRoot} onAction={(a) => onAction(child.id, a)} />
        </div>
        {isOpen && <NodeInspector node={child} pattern={pattern} onChange={onChange} />}
      </div>
    );
  };

  const column = (group: GroupNode, i: number) => (
    <section key={group.id} className='column' onClick={reveal}>
      <div className='column-head'>
        {i > 0 && (
          <button aria-label='back' onClick={back(i)}>
            ‹
          </button>
        )}
        <KindPicker node={group} pattern={pattern} onChange={onChange} />
        <details>
          <summary>
            {nodeLabel(group, svgs)} <span className='meta'>{nodeDetails(group)}</span>
          </summary>
          <NodeInspector node={group} pattern={pattern} onChange={onChange} />
        </details>
      </div>
      {group.children.map((child, k) => (
        <React.Fragment key={child.id}>
          {group.kind === 'chain' && k > 0 && <div className='link'>↑ sets the scale of</div>}
          {card(child, child.id === groups[i + 1]?.id)}
        </React.Fragment>
      ))}
      <div className='row'>
        <ActionPicker label='+ Add' sections={ADD_SECTIONS} onAction={(a) => onAction(group.id, a)} />
        <ActionPicker label='⧉ Wrap in' sections={WRAP_SECTIONS} onAction={(a) => onAction(group.id, a)} />
      </div>
    </section>
  );

  return (
    <div className='columns' ref={strip}>
      {groups.length ? (
        groups.map(column)
      ) : (
        // a pattern of a single leaf
        <section className='column'>{card(root, false, true)}</section>
      )}
    </div>
  );
};
