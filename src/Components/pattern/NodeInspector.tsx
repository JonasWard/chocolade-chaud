import React from 'react';
import { DistanceMethodType } from '../../geometry/sdMethods';
import { GROUP_KINDS, IPattern, NodeKind, SdfNode, isGroup } from '../../geometry/sdf/tree';
import { KIND_GLYPH, KIND_LABEL, methodLabel } from '../../geometry/sdf/formula';
import { changeKind } from '../../geometry/sdf/treeOps';
import { Field, LogSlider, NumberField, Select } from '../ui';
import { firstAsset } from './actions';
import { NodeIcon } from './icons';

// one select for the kind of a node, the methods are kinds of their own in it
type KindOption = DistanceMethodType | Exclude<NodeKind, 'method'>;
const KIND_OPTIONS: [KindOption, string][] = [
  ...Object.values(DistanceMethodType).map((m): [KindOption, string] => [m, `${KIND_GLYPH.method} ${methodLabel(m)}`]),
  ...(['svg', 'sine', 'constant', ...GROUP_KINDS] as const).map((k): [KindOption, string] => [k, `${KIND_GLYPH[k]} ${KIND_LABEL[k]}`]),
];

const HINTS: Partial<Record<NodeKind, string>> = {
  chain: 'The last child is evaluated first, its output is the scale of the child above it.',
  difference: 'The first child minus the others.',
  subtract: 'The first child minus the others.',
  sine: 'Distance in mm to a sine curve along x, turned by the angle. Union it with a constant to cap it, or use it to drive a chain.',
  svg: 'Distance in mm to the shape, centred on the middle of the bar. Repeat tiles it, 0 shows it once. In a union with a constant, the constant caps the distance.',
};

/** the settings of one node, shared by both tree editors */
export const NodeInspector: React.FC<{ node: SdfNode; pattern: IPattern; onChange: (node: SdfNode) => void; hideScale?: boolean }> = ({
  node,
  pattern,
  onChange,
  hideScale,
}) => {
  const set = (patch: object) => onChange({ ...node, ...patch } as SdfNode);
  const number = (label: string, value: number, key: string, step = 0.1, min?: number) => (
    <Field label={label}>
      <NumberField value={value} step={step} min={min} onChange={(v) => set({ [key]: v })} />
    </Field>
  );

  const setKind = (kind: KindOption) => {
    if (kind in DistanceMethodType) {
      const method = kind as DistanceMethodType;
      onChange({ ...(changeKind(node, 'method') as Extract<SdfNode, { kind: 'method' }>), method });
      return;
    }
    if (isGroup(node) && node.children.length && !(GROUP_KINDS as string[]).includes(kind) && !window.confirm(`Remove the ${node.children.length} children?`)) return;
    onChange(changeKind(node, kind as NodeKind, firstAsset(pattern)));
  };

  return (
    <div className='stack'>
      <Field label='Kind'>
        <div className='row'>
          <NodeIcon node={node} svgs={pattern.svgs} large />
          <Select label='kind' value={node.kind === 'method' ? node.method : node.kind} options={KIND_OPTIONS} onChange={setKind} />
        </div>
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
          {number('Offset X', node.offsetX, 'offsetX', 1)}
          {number('Offset Z', node.offsetZ, 'offsetZ', 1)}
          {number('Repeat mm', node.repeat, 'repeat', 1, 0)}
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
