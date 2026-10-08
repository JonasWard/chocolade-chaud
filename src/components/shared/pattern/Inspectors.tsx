import React from 'react';
import { IBooleanNode, IConstantNode, IPattern, ISineNode, ISvgNode, ITextNode, SdfNode, textFieldKey } from '../../../geometry/sdf/tree';
import { nodeFrame } from '../../../geometry/sdf/treeOps';
import { LAYOUT_LABEL, WAVE_LABEL } from '../../../geometry/sdf/formula';
import { AROUNDS, Around, LAYOUTS, Layout, WAVES, Wave } from '../../../geometry/sdf/waves';
import { numberField } from '../../../state/schema';
import { Field, NumberSetting, PairSetting, Select, binder } from '../Fields';
import { Segmented } from '../Choices';
import { Hint } from '../Hint';
import { FontField } from './FontField';
import { CurveFields } from './CurveFields';
import { PlacementFields } from './PlacementFields';
import { usePatternEditorContext } from '../../../hooks/usePatternEditor';
import { Expert, useMode } from '../Mode';

// the settings of every kind of node, see NodeInspector

// the ranges of the numbers of the nodes, a bevel has the range of a limit
const [LIMIT, BEVEL, SIZE, ANGLE, WIDTH, REPEAT, AMPLITUDE, PERIOD, COUNT, TWIST, DETAIL, VALUE, SMOOTH] = [
  'root.inner',
  'root.innerBevel',
  'root.size',
  'root.angle',
  'root.width',
  'root.repeat',
  'root.amplitude',
  'root.period',
  'root.count',
  'root.twist',
  'root.detail',
  'root.value',
  'root.smooth',
].map(numberField);

export interface IInspectorProps<N extends SdfNode> {
  node: N;
  pattern: IPattern;
  onChange: (node: SdfNode) => void;
}

/** a size in the frame of the node, on the bars when it is scaled */
const OnBars: React.FC<{ pattern: IPattern; node: SdfNode; mm: number }> = ({ pattern, node, mm }) => {
  const { expert } = useMode();
  const frame = nodeFrame(pattern.root, node.id);
  if (!expert || !frame || Math.abs(frame.scale - 1) <= 1e-6) return null;
  return <Hint>{`${frame.exact ? '' : 'About '}${+(mm / frame.scale).toPrecision(3)} mm on the bars, scaled by ${+frame.scale.toPrecision(3)}.`}</Hint>;
};

/** how the distance to an svg or a text is shaped: it stops at the limits, with bevels over their width */
const ProfileFields: React.FC<IInspectorProps<ISvgNode | ITextNode>> = ({ node, onChange }) => {
  const bind = binder(node, onChange);
  return (
    <>
      <PairSetting
        label='Limits mm'
        sides={[
          { caption: 'inside', field: LIMIT, step: 0.1, bound: bind('inner') },
          { caption: 'outside', field: LIMIT, step: 0.1, bound: bind('outer') },
        ]}
      />
      <Expert name='bevels' changed={node.beveled}>
        <Field label='Custom bevel'>
          <input
            type='checkbox'
            checked={node.beveled}
            // starting as wide as the limits, which is the same as no bevel
            onChange={(e) => onChange(e.target.checked ? { ...node, beveled: true, innerBevel: node.inner, outerBevel: node.outer } : { ...node, beveled: false })}
          />
        </Field>
        {node.beveled && (
          <>
            <PairSetting
              label='Bevels mm'
              sides={[
                { caption: 'inside', field: BEVEL, step: 0.1, bound: node.inner > 0 ? bind('innerBevel') : undefined, placeholder: 'no limit' },
                { caption: 'outside', field: BEVEL, step: 0.1, bound: node.outer > 0 ? bind('outerBevel') : undefined, placeholder: 'no limit' },
              ]}
            />
            <Hint>A bevel is how wide the slope to its limit is, 0 is a step.</Hint>
          </>
        )}
      </Expert>
    </>
  );
};

export const TextInspector: React.FC<IInspectorProps<ITextNode>> = (props) => {
  const { node, pattern, onChange } = props;
  const { errors } = usePatternEditorContext();
  const bind = binder(node, onChange);
  return (
    <>
      <input aria-label='text' placeholder='text' value={node.text} onChange={(e) => onChange({ ...node, text: e.target.value })} />
      <Field label='Font' group>
        <div className='stack'>
          <FontField
            font={node.font}
            source={node.fontSource}
            error={errors[textFieldKey(node)]}
            onChange={(font, fontSource) => onChange({ ...node, font, fontSource })}
          />
        </div>
      </Field>
      <Field label='Bold'>
        <input type='checkbox' checked={node.bold} onChange={(e) => onChange({ ...node, bold: e.target.checked })} />
      </Field>
      <NumberSetting label='Size mm' field={SIZE} step={0.5} {...bind('size')} />
      <OnBars pattern={pattern} node={node} mm={node.size} />
      <PlacementFields placement={node} onChange={(patch) => onChange({ ...node, ...patch })} />
      {!node.curve && (
        <Expert name='angle' changed={node.angle !== 0}>
          <NumberSetting label='Angle °' field={ANGLE} step={5} {...bind('angle')} />
        </Expert>
      )}
      <CurveFields node={node} onChange={onChange} />
      <ProfileFields {...props} />
    </>
  );
};

export const SvgInspector: React.FC<IInspectorProps<ISvgNode>> = (props) => {
  const { node, pattern, onChange } = props;
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
      <NumberSetting label='Width mm' field={WIDTH} step={1} {...bind('width')} />
      <OnBars pattern={pattern} node={node} mm={node.width} />
      <PlacementFields placement={node} onChange={(patch) => onChange({ ...node, ...patch })} />
      <NumberSetting label='Repeat mm' field={REPEAT} step={1} {...bind('repeat')} />
      <ProfileFields {...props} />
    </>
  );
};

const AROUND_LABEL: Record<Around, string> = { centre: 'Centre', outline: 'Outline' };

export const SineInspector: React.FC<IInspectorProps<ISineNode>> = ({ node, onChange }) => {
  const bind = binder(node, onChange);
  // rings have no angle
  const polar = node.layout !== 'rings';
  return (
    <>
      <Segmented<Layout> label='layout' value={node.layout} options={LAYOUTS.map((l) => [l, LAYOUT_LABEL[l]])} onChange={(layout) => onChange({ ...node, layout })} />
      <Segmented<Wave> label='wave' value={node.wave} options={WAVES.map((w) => [w, WAVE_LABEL[w]])} onChange={(wave) => onChange({ ...node, wave })} />
      <NumberSetting label='Amplitude mm' field={AMPLITUDE} step={0.1} {...bind('amplitude')} />
      <NumberSetting label='Period mm' field={PERIOD} step={0.5} {...bind('period')} />
      {polar && <NumberSetting label='Count' field={COUNT} step={1} {...bind('count')} />}
      {polar && (
        <Expert name='twist' changed={node.twist !== 0}>
          <NumberSetting label='Twist °/mm' field={TWIST} step={1} {...bind('twist')} />
        </Expert>
      )}
      {polar && (
        <Expert name='angle' changed={node.around !== 'centre'}>
          <Field label='Angle around'>
            <Segmented<Around> label='angle around' value={node.around} options={AROUNDS.map((a) => [a, AROUND_LABEL[a]])} onChange={(around) => onChange({ ...node, around })} />
          </Field>
          <Hint>
            {node.around === 'centre' ? 'Around the centre of the pattern.' : 'Along the outline of what it holds: the angle is the direction away from it, no centre needed.'}
          </Hint>
        </Expert>
      )}
      <Expert name='fade' changed={node.detail > 0}>
        <NumberSetting label='Fade below mm' field={DETAIL} step={0.1} {...bind('detail')} />
        <Hint>Flattens the wave where it gets finer than this, as it does towards the centre. 0 is no fade.</Hint>
      </Expert>
    </>
  );
};

export const ConstantInspector: React.FC<IInspectorProps<IConstantNode>> = ({ node, onChange }) => (
  <NumberSetting label='Value' field={VALUE} step={0.1} {...binder(node, onChange)('value')} />
);

export const BooleanInspector: React.FC<IInspectorProps<IBooleanNode>> = ({ node, onChange }) => (
  <NumberSetting label='Smooth' field={SMOOTH} step={0.1} {...binder(node, onChange)('smooth')} />
);
