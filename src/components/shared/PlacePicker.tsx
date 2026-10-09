import React from 'react';
import { AlignX, AlignZ } from '../../geometry/sdf/tree';
import { Choices } from './Choices';

const ROWS: AlignZ[] = ['top', 'middle', 'bottom'];
const COLUMNS: AlignX[] = ['left', 'center', 'right'];

type Place = `${AlignZ}-${AlignX}`;
const PLACES = ROWS.flatMap((z) => COLUMNS.map((x): Place => `${z}-${x}`));
const split = (place: Place) => place.split('-') as [AlignZ, AlignX];
const name = (z: AlignZ, x: AlignX) => (z === 'middle' && x === 'center' ? 'centre' : `${z === 'middle' ? '' : z} ${x === 'center' ? '' : x}`.trim());

/** one of nine places, top, middle or bottom by left, centre or right, as a grid of them */
export const PlacePicker: React.FC<{ label: string; x: AlignX; z: AlignZ; onChange: (x: AlignX, z: AlignZ) => void }> = ({ label, x, z, onChange }) => (
  <Choices<Place>
    label={label}
    className='anchor'
    value={`${z}-${x}`}
    options={PLACES}
    onChange={(place) => {
      const [pz, px] = split(place);
      onChange(px, pz);
    }}
    name={(place) => name(...split(place))}
  />
);
