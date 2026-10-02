import React from 'react';
import { DistanceMethodType } from '../../geometry/sdMethods';
import { GROUP_KINDS, IPattern, IProfile, NodeKind, SdfNode, isGroup, textFieldKey } from '../../geometry/sdf/tree';
import { changeKind, nodeFrame } from '../../geometry/sdf/treeOps';
import { Field, LogSlider, NumberField, Select } from '../ui';
import { firstAsset } from './actions';
import { NodeIcon } from './icons';
import { Picker } from '../Picker';
import { KIND_SECTIONS, KindChoice, kindLabel } from './NodeMenu';
import { FontField } from './FontField';
import { CurveFields } from './CurveFields';
import { EditorContext } from './editorContext';

const HINTS: Partial<Record<NodeKind, string>> = {
  chain: 'The last child is evaluated first, its output is the scale of the child above it.',
  difference: 'The first child minus the others.',
  subtract: 'The first child minus the others.',
  sine: 'Distance in mm to a sine curve along x, turned by the angle. Union it with a constant to cap it, or use it to drive a chain.',
  text: 'Distance in mm to the outline of the letters, negative inside. Intersect it with a constant for flat letters.',
  svg: 'Distance in mm to the shape, centred on the middle of the bar. Repeat tiles it, 0 shows it once. In a union with a constant, the constant caps the distance.',
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

  const setKind = (kind: KindChoice) => {
    if (kind in DistanceMethodType) {
      const method = kind as DistanceMethodType;
      onChange({ ...(changeKind(node, 'method') as Extract<SdfNode, { kind: 'method' }>), method });
      return;
    }
    if (isGroup(node) && node.children.length && !(GROUP_KINDS as string[]).includes(kind) && !window.confirm(`Remove the ${node.children.length} children?`)) return;
    onChange(changeKind(node, kind as NodeKind, firstAsset(pattern)));
  };

  const kind: KindChoice = node.kind === 'method' ? node.method : node.kind;
  const frame = nodeFrame(pattern.root, node.id);
  // a size in the frame of the node, on the bars when it is scaled
  const onBars = (mm: number) =>
    frame && Math.abs(frame.scale - 1) > 1e-6 && <p className='hint'>{`${frame.exact ? '' : 'About '}${+(mm / frame.scale).toPrecision(3)} mm on the bars, scaled by ${+frame.scale.toPrecision(3)}.`}</p>;

  // how the distance to an svg or a text is shaped
  const profileFields = (p: IProfile) => (
    <>
      <Field label='Inside'>
        <div className='segmented' role='radiogroup' aria-label='inside'>
          {(['distance', 'constant'] as const).map((inside) => (
            <button key={inside} role='radio' aria-checked={p.inside === inside} className={p.inside === inside ? 'on' : ''} onClick={() => set({ inside })}>
              {inside === 'distance' ? 'Distance' : 'Constant'}
            </button>
          ))}
        </div>
      </Field>
      {p.inside === 'constant' && number('Depth mm', p.depth, 'depth', 0.1)}
      {p.inside === 'constant' && number('Bevel mm', p.bevel, 'bevel', 0.1, 0)}
      {number('Cutoff mm', p.cutoff, 'cutoff', 0.5, 0)}
      <p className='hint'>
        Constant: a flat plateau at −depth inside, with a slanted rim as wide as the bevel. Outside, the distance stays flat beyond the cutoff (0 is none). These
        are mm on the bars, whatever the scale.
      </p>
    </>
  );

  return (
    <div className='stack'>
      <Field label='Kind'>
        <Picker<KindChoice>
          label='kind'
          trigger={
            <>
              <NodeIcon node={node} svgs={pattern.svgs} />
              {kindLabel(kind)}
              <span className='picker-caret'>▾</span>
            </>
          }
          sections={KIND_SECTIONS}
          value={kind}
          onPick={setKind}
        />
      </Field>
      {HINTS[node.kind] && <p className='hint'>{HINTS[node.kind]}</p>}
      {node.kind !== 'constant' && !hideScale && (
        <Field label='Scale'>
          <LogSlider label='scale' value={node.scale} onChange={(scale) => set({ scale })} />
        </Field>
      )}
      {node.kind === 'constant' && number('Value', node.value, 'value')}
      {number('Gain', node.gain, 'gain')}
      {'smooth' in node && number('Smooth', node.smooth, 'smooth', 0.1, 0)}
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
          <CurveFields node={node} onChange={onChange} exact={frame?.exact ?? true} />
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
    </div>
  );
};
