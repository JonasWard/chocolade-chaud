import React from 'react';
import { IPattern, SdfNode } from '../../geometry/sdf/tree';
import { NODE } from '../../state/settings';
import { Hint, NumberSetting, binder } from '../ui';
import { Expert, ExpertNotice } from '../mode';
import { kindOf } from './kinds';

/** the settings of one node, shared by both tree editors, simple mode shows the ones most patterns need */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void }> = ({ node, pattern, onChange }) => {
  const bind = binder(node, onChange);
  const { Inspector, hint } = kindOf(node);
  return (
    <div className='stack'>
      <ExpertNotice>
        {Inspector && <Inspector node={node} pattern={pattern} onChange={onChange} />}
        <Expert name='gain' changed={node.gain !== 1}>
          <NumberSetting setting={NODE.gain} {...bind('gain')} />
        </Expert>
        {/* a method is mostly its scale, a constant has none */}
        {node.kind === 'method' ? (
          <NumberSetting setting={NODE.scale} {...bind('scale')} />
        ) : (
          node.kind !== 'constant' && (
            <Expert name='scale' changed={node.scale !== 1}>
              <NumberSetting setting={NODE.scale} {...bind('scale')} />
            </Expert>
          )
        )}
        {hint && <Hint>{hint}</Hint>}
      </ExpertNotice>
    </div>
  );
};
