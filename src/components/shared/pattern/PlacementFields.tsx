import React from 'react';
import { AlignX, AlignZ, IPlacement } from '../../../geometry/sdf/tree';
import { numberField } from '../../../state/schema';
import { Field, NumberSetting, PairSetting } from '../Fields';
import { PlacePicker } from '../PlacePicker';
import { Expert, useMode } from '../Mode';

// x and z have the same range
const PADDING = numberField('root.paddingX');

/**
 * where an svg shape or a text goes on the bars: a grid of the nine places, and the padding away from the edges. Simple has one
 * padding for the edges it is against, and a place picked there puts it at that place without moving it further
 */
export const PlacementFields: React.FC<{ placement: IPlacement; onChange: (patch: Partial<IPlacement>) => void }> = ({ placement, onChange }) => {
  const simple = !useMode().expert;
  const { alignX, alignZ, paddingX, paddingZ } = placement;
  const [edgeX, edgeZ] = [alignX !== 'center', alignZ !== 'middle'];
  const padding = edgeX ? paddingX : edgeZ ? paddingZ : 0;
  const pick = (x: AlignX, z: AlignZ) =>
    onChange(simple ? { alignX: x, alignZ: z, paddingX: x === 'center' ? 0 : padding, paddingZ: z === 'middle' ? 0 : padding } : { alignX: x, alignZ: z });
  // centred, the padding moves it: x to the right, z down
  const caption = (align: string, axis: 'x' | 'z') => (align === 'center' || align === 'middle' ? `move ${axis}` : `from ${align}`);
  // what the one padding of simple mode can't show: a centred side moved, or two edges padded apart
  const apart = (!edgeX && paddingX !== 0) || (!edgeZ && paddingZ !== 0) || (edgeX && edgeZ && paddingX !== paddingZ);
  return (
    <>
      <Field label='Position' group>
        <PlacePicker label='position' x={alignX} z={alignZ} onChange={pick} />
      </Field>
      <Expert
        name='padding'
        changed={apart}
        fallback={
          (edgeX || edgeZ) && (
            <NumberSetting
              label='Padding mm'
              field={PADDING}
              step={1}
              value={padding}
              onChange={(v) => onChange({ ...(edgeX ? { paddingX: v } : {}), ...(edgeZ ? { paddingZ: v } : {}) })}
            />
          )
        }
      >
        <PairSetting
          label='Padding mm'
          sides={[
            { caption: caption(alignX, 'x'), field: PADDING, step: 1, bound: { value: paddingX, onChange: (v) => onChange({ paddingX: v }) } },
            { caption: caption(alignZ, 'z'), field: PADDING, step: 1, bound: { value: paddingZ, onChange: (v) => onChange({ paddingZ: v }) } },
          ]}
        />
      </Expert>
    </>
  );
};
