import React from 'react';
import { AlignX, AlignZ, IPlacement } from '../../geometry/sdf/tree';
import { Field, NumberField } from '../ui';

const ROWS: AlignZ[] = ['top', 'middle', 'bottom'];
const COLUMNS: AlignX[] = ['left', 'center', 'right'];

const label = (z: AlignZ, x: AlignX) => (z === 'middle' && x === 'center' ? 'centre' : `${z === 'middle' ? '' : z} ${x === 'center' ? '' : x}`.trim());

/**
 * where an svg shape or a text goes on the bars: a grid of the nine places, and the padding away from the edges. Simple has one
 * padding for the edges it is against, and a place picked there puts it at that place without moving it further
 */
export const PlacementFields: React.FC<{ placement: IPlacement; onChange: (patch: Partial<IPlacement>) => void; simple?: boolean }> = ({ placement, onChange, simple }) => {
  const { alignX, alignZ, paddingX, paddingZ } = placement;
  const [edgeX, edgeZ] = [alignX !== 'center', alignZ !== 'middle'];
  const padding = edgeX ? paddingX : edgeZ ? paddingZ : 0;
  const pick = (x: AlignX, z: AlignZ) =>
    onChange(simple ? { alignX: x, alignZ: z, paddingX: x === 'center' ? 0 : padding, paddingZ: z === 'middle' ? 0 : padding } : { alignX: x, alignZ: z });
  // centred, the padding moves it: x to the right, z down
  const caption = (align: string, axis: 'x' | 'z') => (align === 'center' || align === 'middle' ? `move ${axis}` : `from ${align}`);
  return (
    <>
      <Field label='Position'>
        <div className='anchor' role='radiogroup' aria-label='position'>
          {ROWS.flatMap((z) =>
            COLUMNS.map((x) => {
              const on = x === alignX && z === alignZ;
              return <button key={`${z}-${x}`} role='radio' aria-checked={on} aria-label={label(z, x)} title={label(z, x)} className={on ? 'on' : ''} onClick={() => pick(x, z)} />;
            })
          )}
        </div>
      </Field>
      {simple ? (
        (edgeX || edgeZ) && (
          <Field label='Padding mm'>
            <NumberField label='padding' value={padding} step={1} onChange={(v) => onChange({ ...(edgeX ? { paddingX: v } : {}), ...(edgeZ ? { paddingZ: v } : {}) })} />
          </Field>
        )
      ) : (
        <Field label='Padding mm'>
          <div className='pair'>
            <label className='mini'>
              <span>{caption(alignX, 'x')}</span>
              <NumberField label='padding x' value={paddingX} step={1} onChange={(v) => onChange({ paddingX: v })} />
            </label>
            <label className='mini'>
              <span>{caption(alignZ, 'z')}</span>
              <NumberField label='padding z' value={paddingZ} step={1} onChange={(v) => onChange({ paddingZ: v })} />
            </label>
          </div>
        </Field>
      )}
    </>
  );
};
