import React from 'react';
import { IPattern, SdfNode } from '../../geometry/sdf/tree';
import { numberField } from '../../state/schema';
import { Hint, NumberSetting, binder } from '../ui';
import { Expert, ExpertNotice } from '../mode';
import { kindOf } from './kinds';

// scale and gain are in every kind of node, the scale is stored as its log10
const [SCALE, GAIN] = ['root.scale', 'root.gain'].map(numberField);

/** the settings of one node, shared by both tree editors, simple mode shows the ones most patterns need */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void }> = ({ node, pattern, onChange }) => {
  const bind = binder(node, onChange);
  const { Inspector, hint } = kindOf(node);
  return (
    <div className='stack'>
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
    </div>
  );
};
