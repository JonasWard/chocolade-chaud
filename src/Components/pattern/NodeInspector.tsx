import React from 'react';
import { IPattern, IProfile, NodeKind, SdfNode, textFieldKey } from '../../geometry/sdf/tree';
import { nodeFrame } from '../../geometry/sdf/treeOps';
import { Field, LogSlider, NumberField, Select } from '../ui';
import { FontField } from './FontField';
import { CurveFields } from './CurveFields';
import { EditorContext } from './editorContext';

const HINTS: Partial<Record<NodeKind, string>> = {
  chain: 'The last child is evaluated first, its output is the scale of the child above it.',
  difference: 'The first child minus the others.',
  subtract: 'The first child minus the others.',
  sine: 'Distance in mm to a sine curve along x, turned by the angle. Union it with a constant to cap it, or use it to drive a chain.',
  text: 'Distance in mm to the outline of the letters, negative inside. The distance stops at its limits (0 is none), an inside limit gives flat letters. A bevel is how wide the slope to its limit is, 0 is a step. In mm on the bars.',
  svg: 'Distance in mm to the shape, centred on the middle of the bar. Repeat tiles it, 0 shows it once. The distance stops at its limits (0 is none). A bevel is how wide the slope to its limit is, 0 is a step.',
};

/** the settings of one node, shared by both tree editors */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void; hideScale?: boolean }> = ({
  node,
  pattern,
  onChange,
  hideScale,
}) => {
  const { errors } = React.useContext(EditorContext);
  const set = (patch: object) => onChange({ ...node, ...patch } as SdfNode);
  const number = (label: string, value: number, key: string, step = 0.1, min?: number) => (
    <Field label={label}>
      <NumberField value={value} step={step} min={min} onChange={(v) => set({ [key]: v })} />
    </Field>
  );

  const frame = nodeFrame(pattern.root, node.id);
  // a size in the frame of the node, on the bars when it is scaled
  const onBars = (mm: number) =>
    frame && Math.abs(frame.scale - 1) > 1e-6 && <p className='hint'>{`${frame.exact ? '' : 'About '}${+(mm / frame.scale).toPrecision(3)} mm on the bars, scaled by ${+frame.scale.toPrecision(3)}.`}</p>;

  // a number for the inside and one for the outside, side by side
  const pair = (label: string, inner: number, outer: number, keys: [string, string], show: [boolean, boolean] = [true, true]) => (
    <Field label={label}>
      <div className='pair'>
        {(['inside', 'outside'] as const).map((side, i) => (
          <label key={side} className='mini'>
            <span>{side}</span>
            {show[i] ? (
              <NumberField label={`${label} ${side}`} value={i ? outer : inner} step={0.1} min={0} onChange={(v) => set({ [keys[i]]: v })} />
            ) : (
              <span className='meta'>no limit</span>
            )}
          </label>
        ))}
      </div>
    </Field>
  );

  // how the distance to an svg or a text is shaped: it stops at the limits, with bevels over their width
  const profileFields = (p: IProfile) => (
    <>
      {pair('Limits mm', p.inner, p.outer, ['inner', 'outer'])}
      <Field label='Custom bevel'>
        <input
          type='checkbox'
          checked={p.beveled}
          // starting as wide as the limits, which is the same as no bevel
          onChange={(e) => set(e.target.checked ? { beveled: true, innerBevel: p.inner, outerBevel: p.outer } : { beveled: false })}
        />
      </Field>
      {p.beveled && pair('Bevels mm', p.innerBevel, p.outerBevel, ['innerBevel', 'outerBevel'], [p.inner > 0, p.outer > 0])}
          </>
  );

  return (
    <div className='stack'>
      {node.kind === 'text' && (
        <>
          <input aria-label='text' placeholder='text' value={node.text} onChange={(e) => set({ text: e.target.value })} />
          <Field label='Font'>
            <div className='stack'>
              <FontField font={node.font} source={node.fontSource} error={errors[textFieldKey(node)]} onChange={(font, fontSource) => set({ font, fontSource })} />
            </div>
          </Field>
          <Field label='Bold'>
            <input type='checkbox' checked={node.bold} onChange={(e) => set({ bold: e.target.checked })} />
          </Field>
          {number('Size mm', node.size, 'size', 0.5, 0.5)}
          {onBars(node.size)}
          {!node.curve && (
            <>
              {number('Offset X', node.offsetX, 'offsetX', 1)}
              {number('Offset Z', node.offsetZ, 'offsetZ', 1)}
              {number('Angle °', node.angle, 'angle', 5)}
            </>
          )}
          <CurveFields node={node} onChange={onChange} />
          {profileFields(node)}
        </>
      )}
      {node.kind === 'svg' && (
        <>
          <Field label='Shape'>
            <Select
              label='shape'
              value={node.asset}
              options={[
                ...(pattern.svgs[node.asset] ? [] : [[node.asset, 'missing svg'] as [string, string]]),
                ...Object.entries(pattern.svgs).map(([k, a]): [string, string] => [k, a.name]),
              ]}
              onChange={(asset) => set({ asset })}
            />
          </Field>
          {number('Width mm', node.width, 'width', 1, 0)}
          {onBars(node.width)}
          {number('Offset X', node.offsetX, 'offsetX', 1)}
          {number('Offset Z', node.offsetZ, 'offsetZ', 1)}
          {number('Repeat mm', node.repeat, 'repeat', 1, 0)}
          {profileFields(node)}
        </>
      )}
      {node.kind === 'sine' && (
        <>
          {number('Amplitude mm', node.amplitude, 'amplitude', 0.5)}
          {number('Period mm', node.period, 'period', 1, 0)}
          {number('Angle °', node.angle, 'angle', 5)}
        </>
      )}
      {node.kind === 'constant' && number('Value', node.value, 'value')}
      {'smooth' in node && number('Smooth', node.smooth, 'smooth', 0.1, 0)}
      {number('Gain', node.gain, 'gain')}
      {node.kind !== 'constant' && !hideScale && (
        <Field label='Scale'>
          <LogSlider label='scale' value={node.scale} onChange={(scale) => set({ scale })} />
        </Field>
      )}
      {HINTS[node.kind] && <p className='hint'>{HINTS[node.kind]}</p>}
    </div>
  );
};
