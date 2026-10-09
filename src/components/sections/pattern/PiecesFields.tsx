import React from 'react';
import { IBar, isPieced, isUnique, overrideOf, chocolateOf, withOverride, withPieceMode } from '../../../geometry/grid';
import { CHOCOLATES } from '../../../geometry/chocolates';
import { DEFAULT_REPEAT, FITS, Fit, IRepeat, NO_OVERRIDE, PIECE_MODES, PieceMode, REFERENCES, Reference, differs } from '../../../geometry/pieces';
import { numberField } from '../../../state/schema';
import { Scope, usePieces } from '../../../hooks/usePieces';
import { Field, PairSetting, Select, binder } from '../../shared/Fields';
import { Segmented } from '../../shared/Choices';
import { Hint } from '../../shared/Hint';
import { Expert } from '../../shared/Mode';
import { LayoutDrawing } from '../../shared/LayoutDrawing';
import { PlacePicker } from '../../shared/PlacePicker';

// width and length have the same range
const REFERENCE_SIZE = numberField('repeat.frames.referenceWidth');

const MODE_LABEL: Record<PieceMode, string> = { one: 'One design', repeat: 'Repeat', unique: 'Unique' };
const MODE_HINT: Record<PieceMode, string> = {
  one: 'The pieces are cut out of one design that runs across all of them.',
  repeat: 'Every piece has the whole pattern, around its own centre.',
  unique: 'Every piece has the whole pattern, and what you change on that piece alone.',
};
const FIT_LABEL: Record<Fit, string> = { same: 'Same size', inside: 'Fit inside', fill: 'Fill', width: 'By width', length: 'By length' };
const REFERENCE_LABEL: Record<Reference, string> = { largest: 'Largest piece', tablet: 'Whole tablet', custom: 'A size' };
const SCOPES: [Scope, string][] = [
  ['all', 'All pieces'],
  ['piece', 'This piece'],
];

const sameRepeat = (a: IRepeat, b: IRepeat) => (Object.keys(a) as (keyof IRepeat)[]).every((key) => a[key] === b[key]);

/** where the pattern is on every piece and how large, for a tablet whose pieces each have it */
const RepeatFields: React.FC<{ repeat: IRepeat; onChange: (repeat: IRepeat) => void }> = ({ repeat, onChange }) => {
  const bind = binder(repeat, onChange);
  return (
    <>
      <Field label='Centre at' group>
        <PlacePicker label='centre at' x={repeat.anchorX} z={repeat.anchorZ} onChange={(anchorX, anchorZ) => onChange({ ...repeat, anchorX, anchorZ })} />
      </Field>
      <Field label='Scale'>
        <Select<Fit> label='scale' value={repeat.fit} options={FITS.map((f): [Fit, string] => [f, FIT_LABEL[f]])} onChange={(fit) => onChange({ ...repeat, fit })} />
      </Field>
      {repeat.fit !== 'same' && (
        <>
          <Field label='1 to 1 on'>
            <Select<Reference>
              label='1 to 1 on'
              value={repeat.reference}
              options={REFERENCES.map((r): [Reference, string] => [r, REFERENCE_LABEL[r]])}
              onChange={(reference) => onChange({ ...repeat, reference })}
            />
          </Field>
          {repeat.reference === 'custom' && (
            <PairSetting
              label='Size mm'
              sides={[
                { caption: 'width', field: REFERENCE_SIZE, step: 5, bound: bind('referenceWidth') },
                { caption: 'length', field: REFERENCE_SIZE, step: 5, bound: bind('referenceLength') },
              ]}
            />
          )}
          <Hint>The pattern is smaller on a smaller piece. Its limits, bevels and depths stay in mm.</Hint>
        </>
      )}
    </>
  );
};

/**
 * how the pieces of a combined tablet have the pattern: as one design across them, each the whole of it, or each with what differs on
 * it. A unique tablet picks the piece that is edited alone here
 */
export const PiecesFields: React.FC<{ bar: IBar; setBar: (bar: IBar) => void }> = ({ bar, setBar }) => {
  const { piece, setPiece, scope, setScope } = usePieces();
  const override = overrideOf(bar, piece);
  return (
    <>
      <Segmented<PieceMode> label='pieces' value={bar.pieceMode} options={PIECE_MODES.map((m) => [m, MODE_LABEL[m]])} onChange={(mode) => setBar(withPieceMode(bar, mode, piece))} />
      <Hint>{MODE_HINT[bar.pieceMode]}</Hint>
      {isPieced(bar) && (
        <Expert name='where the pattern is on a piece' changed={!sameRepeat(bar.repeat, DEFAULT_REPEAT)}>
          <RepeatFields repeat={bar.repeat} onChange={(repeat) => setBar({ ...bar, repeat })} />
        </Expert>
      )}
      {isUnique(bar) && (
        <>
          <LayoutDrawing
            className='pieces'
            pieces={bar.pieces}
            fill={(i) => CHOCOLATES[chocolateOf(bar, i)].color}
            selected={scope === 'piece' ? piece : undefined}
            marked={(i) => differs(bar.overrides[i])}
            onPick={(i) => {
              setPiece(i);
              setScope('piece');
            }}
          />
          <Segmented<Scope> label='editing' value={scope} options={SCOPES} onChange={setScope} />
          <div className='row'>
            <Hint inline>
              {scope === 'all'
                ? 'What you change is for every piece. Tap a piece to change it alone.'
                : differs(override)
                  ? `Piece ${piece + 1} differs where it is marked.`
                  : `What you change is for piece ${piece + 1} alone.`}
            </Hint>
            {scope === 'piece' && differs(override) && <button onClick={() => setBar(withOverride(bar, piece, NO_OVERRIDE))}>Reset this piece</button>}
          </div>
        </>
      )}
    </>
  );
};
