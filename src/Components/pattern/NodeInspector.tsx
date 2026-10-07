import React from 'react';
import { IPattern, NodeKind, SdfNode } from '../../geometry/sdf/tree';
import { NODE } from '../../state/settings';
import { Hint, NumberSetting, binder } from '../ui';
import { Expert, ExpertNotice } from '../mode';
import { BooleanInspector, ConstantInspector, SineInspector, SvgInspector, TextInspector } from './inspectors';

const HINTS: Partial<Record<NodeKind, string>> = {
  chain: 'The last child is evaluated first, its output is the scale of the child above it.',
  difference: 'The first child minus the others.',
  subtract: 'The first child minus the others.',
  sine: 'Ripples along the distance of what it holds: amplitude × sin(2π · distance / period), in mm. Wrap a text or a shape to echo its outline.',
  text: 'Distance in mm to the outline of the letters, negative inside. The distance stops at its limits (0 is none), an inside limit gives flat letters. In mm on the bars.',
  svg: 'Distance in mm to the shape, placed against an edge of the bars or centred. Repeat tiles it, 0 shows it once. The distance stops at its limits (0 is none).',
};

/** the settings of one node, shared by both tree editors, simple mode shows the ones most patterns need */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void }> = ({ node, pattern, onChange }) => {
  const bind = binder(node, onChange);
  const own = (() => {
    switch (node.kind) {
      case 'text':
        return <TextInspector node={node} pattern={pattern} onChange={onChange} />;
      case 'svg':
        return <SvgInspector node={node} pattern={pattern} onChange={onChange} />;
      case 'sine':
        return <SineInspector node={node} pattern={pattern} onChange={onChange} />;
      case 'constant':
        return <ConstantInspector node={node} pattern={pattern} onChange={onChange} />;
      case 'union':
      case 'difference':
      case 'intersection':
        return <BooleanInspector node={node} pattern={pattern} onChange={onChange} />;
      default:
        return null;
    }
  })();

  return (
    <div className='stack'>
      <ExpertNotice>
        {own}
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
        {HINTS[node.kind] && <Hint>{HINTS[node.kind]}</Hint>}
      </ExpertNotice>
    </div>
  );
};
