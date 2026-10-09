import React from 'react';
import { IPattern, SdfNode } from '../../../geometry/sdf/tree';
import { numberField } from '../../../state/schema';
import { NumberSetting, binder } from '../Fields';
import { IMarks, MarksContext } from '../Marks';
import { overrideAt, resetNode } from '../../../geometry/pieces';
import { usePieces } from '../../../hooks/usePieces';
import { Hint } from '../Hint';
import { Expert, ExpertNotice } from '../Mode';
import { kindOf } from './Kinds';

// scale and gain are in every kind of node, the scale is stored as its log10
const [SCALE, GAIN] = ['root.scale', 'root.gain'].map(numberField);

/** the settings of one node, shared by both tree editors, simple mode shows the ones most patterns need */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void }> = ({ node, pattern, onChange }) => {
  const bind = binder(node, onChange);
  const { Inspector, hint } = kindOf(node);
  // what differs on the piece that is edited alone
  const { override, setOverride } = usePieces();
  const [key, o] = overrideAt(override, node.id) ?? [];
  const marks: IMarks | undefined =
    override && key && o && 'values' in o
      ? { names: new Set(Object.keys(o.values)), reset: (names) => setOverride(names.reduce((all, name) => resetNode(all, key, name), override)) }
      : undefined;
  return (
    <div className='stack'>
      {override && key && o && 'own' in o && (
        <div className='row'>
          <Hint inline>Its own on this piece: it no longer follows what the pieces share.</Hint>
          <button onClick={() => setOverride(resetNode(override, key))}>Back to shared</button>
        </div>
      )}
      <MarksContext.Provider value={marks}>
        <ExpertNotice>
          {Inspector && <Inspector node={node} pattern={pattern} onChange={onChange} />}
          <Expert name='gain' changed={node.gain !== 1}>
            <NumberSetting label='Gain' field={GAIN} step={0.1} {...bind('gain')} />
          </Expert>
          {/* a method is mostly its scale, a constant has none */}
          {node.kind === 'method' ? (
            <NumberSetting label='Scale' field={SCALE} step={0.01} log {...bind('scale')} />
          ) : (
            node.kind !== 'constant' && (
              <Expert name='scale' changed={node.scale !== 1}>
                <NumberSetting label='Scale' field={SCALE} step={0.01} log {...bind('scale')} />
              </Expert>
            )
          )}
          {hint && <Hint>{hint}</Hint>}
        </ExpertNotice>
      </MarksContext.Provider>
    </div>
  );
};
