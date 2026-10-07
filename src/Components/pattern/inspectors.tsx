import React from 'react';
import { IBooleanNode, IConstantNode, IPattern, ISineNode, ISvgNode, ITextNode, SdfNode, textFieldKey } from '../../geometry/sdf/tree';
import { nodeFrame } from '../../geometry/sdf/treeOps';
import { KIND, PROFILE } from '../../state/settings';
import { Field, Hint, NumberSetting, PairSetting, Select, binder } from '../ui';
import { FontField } from './FontField';
import { CurveFields } from './CurveFields';
import { PlacementFields } from './PlacementFields';
import { EditorContext } from './editorContext';

// the settings of every kind of node, see NodeInspector

export interface IInspectorProps<N extends SdfNode> {
  node: N;
  pattern: IPattern;
  onChange: (node: SdfNode) => void;
}

/** a size in the frame of the node, on the bars when it is scaled */
const OnBars: React.FC<{ pattern: IPattern; node: SdfNode; mm: number }> = ({ pattern, node, mm }) => {
  const { expert } = React.useContext(EditorContext);
  const frame = nodeFrame(pattern.root, node.id);
  if (!expert || !frame || Math.abs(frame.scale - 1) <= 1e-6) return null;
  return <Hint>{`${frame.exact ? '' : 'About '}${+(mm / frame.scale).toPrecision(3)} mm on the bars, scaled by ${+frame.scale.toPrecision(3)}.`}</Hint>;
};

/** how the distance to an svg or a text is shaped: it stops at the limits, with bevels over their width */
const ProfileFields: React.FC<IInspectorProps<ISvgNode | ITextNode>> = ({ node, onChange }) => {
  const { expert } = React.useContext(EditorContext);
  const bind = binder(node, onChange);
  return (
    <>
      <PairSetting
        label='Limits mm'
        sides={[
          { caption: 'inside', setting: PROFILE.inner, bound: bind('inner') },
          { caption: 'outside', setting: PROFILE.outer, bound: bind('outer') },
        ]}
      />
      {expert && (
        <Field label='Custom bevel'>
          <input
            type='checkbox'
            checked={node.beveled}
            // starting as wide as the limits, which is the same as no bevel
            onChange={(e) => onChange(e.target.checked ? { ...node, beveled: true, innerBevel: node.inner, outerBevel: node.outer } : { ...node, beveled: false })}
          />
        </Field>
      )}
      {expert && node.beveled && (
        <>
          <PairSetting
            label='Bevels mm'
            sides={[
              { caption: 'inside', setting: PROFILE.innerBevel, bound: node.inner > 0 ? bind('innerBevel') : undefined, placeholder: 'no limit' },
              { caption: 'outside', setting: PROFILE.outerBevel, bound: node.outer > 0 ? bind('outerBevel') : undefined, placeholder: 'no limit' },
            ]}
          />
          <Hint>A bevel is how wide the slope to its limit is, 0 is a step.</Hint>
        </>
      )}
    </>
  );
};

export const TextInspector: React.FC<IInspectorProps<ITextNode>> = (props) => {
  const { node, pattern, onChange } = props;
  const { errors, expert } = React.useContext(EditorContext);
  const bind = binder(node, onChange);
  return (
    <>
      <input aria-label='text' placeholder='text' value={node.text} onChange={(e) => onChange({ ...node, text: e.target.value })} />
      <Field label='Font' group>
        <div className='stack'>
          <FontField font={node.font} source={node.fontSource} error={errors[textFieldKey(node)]} onChange={(font, fontSource) => onChange({ ...node, font, fontSource })} />
        </div>
      </Field>
      <Field label='Bold'>
        <input type='checkbox' checked={node.bold} onChange={(e) => onChange({ ...node, bold: e.target.checked })} />
      </Field>
      <NumberSetting setting={KIND.text.size} {...bind('size')} />
      <OnBars pattern={pattern} node={node} mm={node.size} />
      <PlacementFields placement={node} onChange={(patch) => onChange({ ...node, ...patch })} simple={!expert} />
      {expert && !node.curve && <NumberSetting setting={KIND.text.angle} {...bind('angle')} />}
      <CurveFields node={node} onChange={onChange} />
      <ProfileFields {...props} />
    </>
  );
};

export const SvgInspector: React.FC<IInspectorProps<ISvgNode>> = (props) => {
  const { node, pattern, onChange } = props;
  const { expert } = React.useContext(EditorContext);
  const bind = binder(node, onChange);
  return (
    <>
      <Field label='Shape'>
        <Select
          label='shape'
          value={node.asset}
          options={[
            ...(pattern.svgs[node.asset] ? [] : [[node.asset, 'missing svg'] as [string, string]]),
            ...Object.entries(pattern.svgs).map(([k, a]): [string, string] => [k, a.name]),
          ]}
          onChange={(asset) => onChange({ ...node, asset })}
        />
      </Field>
      <NumberSetting setting={KIND.svg.width} {...bind('width')} />
      <OnBars pattern={pattern} node={node} mm={node.width} />
      <PlacementFields placement={node} onChange={(patch) => onChange({ ...node, ...patch })} simple={!expert} />
      <NumberSetting setting={KIND.svg.repeat} {...bind('repeat')} />
      <ProfileFields {...props} />
    </>
  );
};

export const SineInspector: React.FC<IInspectorProps<ISineNode>> = ({ node, onChange }) => {
  const bind = binder(node, onChange);
  return (
    <>
      <NumberSetting setting={KIND.sine.amplitude} {...bind('amplitude')} />
      <NumberSetting setting={KIND.sine.period} {...bind('period')} />
    </>
  );
};

export const ConstantInspector: React.FC<IInspectorProps<IConstantNode>> = ({ node, onChange }) => <NumberSetting setting={KIND.constant.value} {...binder(node, onChange)('value')} />;

export const BooleanInspector: React.FC<IInspectorProps<IBooleanNode>> = ({ node, onChange }) => <NumberSetting setting={KIND.boolean.smooth} {...binder(node, onChange)('smooth')} />;
