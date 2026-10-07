import React from 'react';
import { BarKind, IBar, MAX_DIVS_ONE_SIDE, MAX_VERTICES, chocolateOf, effectiveDivPerMM } from '../geometry/grid';
import { CHOCOLATES, CHOCOLATE_TYPES, ChocolateType } from '../geometry/chocolates';
import { COLUMNS, IPiece, ROWS, TABLET_LAYOUTS, TABLET_SIZES, TabletSize, sameLayout, tabletSize, units } from '../geometry/tablets';
import { BAR } from '../state/settings';
import { Choices, Field, Hint, NumberSetting, Segmented, binder } from './ui';

const KIND_LABEL: Record<BarKind, string> = { [BarKind.Tablet]: '1 tablet', [BarKind.Combined]: 'Combined', [BarKind.Custom]: 'Custom size' };
const sizeLabel = (size: TabletSize) => size.replace('x', '×');

/** the pieces of a layout in a 6 by 2 drawing, filled by fill, a tap on a piece picks it when onPick is given */
const LayoutDrawing: React.FC<{ pieces: IPiece[]; fill: (i: number) => string; selected?: number; onPick?: (i: number) => void; className: string }> = ({
  pieces,
  fill,
  selected,
  onPick,
  className,
}) => (
  <svg className={className} viewBox={`-0.1 -0.1 ${COLUMNS + 0.2} ${ROWS * 1.4 + 0.2}`} aria-hidden={!onPick}>
    {pieces.map(({ size, u, v }, i) => {
      const n = units(size);
      return (
        <rect
          key={i}
          x={u + 0.06}
          y={v * 1.4 + 0.06}
          width={n.u - 0.12}
          height={n.v * 1.4 - 0.12}
          rx={0.12}
          fill={fill(i)}
          className={i === selected ? 'piece selected' : 'piece'}
          role={onPick ? 'button' : undefined}
          aria-label={onPick ? `piece ${i + 1}, ${sizeLabel(size)}` : undefined}
          onClick={onPick && (() => onPick(i))}
        />
      );
    })}
  </svg>
);

const ChocolatePicker: React.FC<{ value: ChocolateType; onChange: (c: ChocolateType) => void }> = ({ value, onChange }) => (
  <Choices
    label='chocolate'
    className='swatches'
    itemClassName='swatch'
    value={value}
    options={CHOCOLATE_TYPES}
    onChange={onChange}
    name={(type) => CHOCOLATES[type].name}
    itemStyle={(type) => ({ background: CHOCOLATES[type].color })}
  />
);

/** the size and the chocolate of the bars, expert adds a custom size and shows how finely they are made and their wireframe */
export const BarPanel: React.FC<{ grid: IBar; setGrid: (g: IBar) => void; expert: boolean }> = ({ grid, setGrid, expert }) => {
  const set = (patch: Partial<IBar>) => setGrid({ ...grid, ...patch });
  const bind = binder(grid, setGrid);
  // the piece of a combined tablet whose chocolate is picked
  const [piece, setPiece] = React.useState(0);
  const combined = grid.kind === BarKind.Combined;
  const perPiece = combined && !grid.sameChocolate;
  const current = Math.min(piece, grid.pieces.length - 1);

  // a custom bar stays one in simple mode until another size is picked
  const kinds = [BarKind.Tablet, BarKind.Combined, ...(expert || grid.kind === BarKind.Custom ? [BarKind.Custom] : [])];
  const { width, length } = tabletSize(grid.tablet);

  const setChocolate = (chocolate: ChocolateType) => {
    if (!perPiece) return set({ chocolates: [chocolate, ...grid.chocolates.slice(1)] });
    const chocolates = grid.pieces.map((_, i) => chocolateOf(grid, i));
    chocolates[current] = chocolate;
    set({ chocolates });
  };

  return (
    <>
      <Segmented<BarKind> label='size' value={grid.kind} options={kinds.map((k) => [k, KIND_LABEL[k]])} onChange={(kind) => set({ kind })} />
      {grid.kind === BarKind.Tablet && (
        <>
          <Segmented<TabletSize> label='tablet' value={grid.tablet} options={TABLET_SIZES.map((s) => [s, sizeLabel(s)])} onChange={(tablet) => set({ tablet })} />
          <Hint>
            {width} × {length} mm
          </Hint>
        </>
      )}
      {combined && (
        <Choices
          label='layout'
          className='layouts'
          itemClassName='layout'
          value={TABLET_LAYOUTS.findIndex((layout) => sameLayout(layout, grid.pieces))}
          options={TABLET_LAYOUTS.map((_, i) => i)}
          onChange={(i) => set({ pieces: TABLET_LAYOUTS[i] })}
          name={(i) => `layout ${i + 1}`}
        >
          {(i) => <LayoutDrawing className='layout-drawing' pieces={TABLET_LAYOUTS[i]} fill={() => 'currentColor'} />}
        </Choices>
      )}
      {grid.kind === BarKind.Custom && (
        <>
          <NumberSetting setting={BAR.width} {...bind('width')} />
          <NumberSetting setting={BAR.length} {...bind('length')} />
        </>
      )}
      {(grid.kind === BarKind.Combined || grid.kind === BarKind.Custom) && <Hint>Sizes are of the base, the top is smaller by the inset.</Hint>}
      {combined && (
        <>
          <LayoutDrawing
            className='pieces'
            pieces={grid.pieces}
            fill={(i) => CHOCOLATES[chocolateOf(grid, i)].color}
            selected={perPiece ? current : undefined}
            onPick={perPiece ? setPiece : undefined}
          />
          <label className='check'>
            <input type='checkbox' checked={grid.sameChocolate} onChange={(e) => set({ sameChocolate: e.target.checked, chocolates: grid.pieces.map((_, i) => chocolateOf(grid, i)) })} />
            Same chocolate for every piece
          </label>
          {perPiece && <Hint>Tap a piece to pick its chocolate.</Hint>}
        </>
      )}
      <Field label='Chocolate' group>
        <div>
          <ChocolatePicker value={chocolateOf(grid, perPiece ? current : 0)} onChange={setChocolate} />
          <Hint inline>{CHOCOLATES[chocolateOf(grid, perPiece ? current : 0)].name}</Hint>
        </div>
      </Field>
      <NumberSetting setting={BAR.height} {...bind('height')} />
      <NumberSetting setting={BAR.inset} {...bind('inset')} />
      {expert && <NumberSetting setting={BAR.divPerMM} {...bind('divPerMM')} />}
      {expert && effectiveDivPerMM(grid) < grid.divPerMM && (
        <Hint>
          Limited to {effectiveDivPerMM(grid).toFixed(2)}/mm here: a side has at most {MAX_DIVS_ONE_SIDE} divisions, all bars together {(MAX_VERTICES / 1e6).toFixed(1)} million
          vertices.
        </Hint>
      )}
      {expert && (
        <Field label='Wireframe'>
          <input type='checkbox' checked={grid.displayWireframe} onChange={(e) => set({ displayWireframe: e.target.checked })} />
        </Field>
      )}
    </>
  );
};
