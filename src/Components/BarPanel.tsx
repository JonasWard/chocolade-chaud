import React from 'react';
import { DefaultGridSettings, GridType, IEditableGrid, MAX_DIV_PER_MM, MAX_UV_COUNT } from '../geometry/grid';
import { DEFAULT_COLOR } from '../geometry/createMesh';
import { Field, NumberField, Select } from './ui';

const GRID_TYPES = [GridType.Single, GridType.Simple] as const;

export const BarPanel: React.FC<{ grid: IEditableGrid; setGrid: (g: IEditableGrid) => void }> = ({ grid, setGrid }) => {
  const set = (patch: Partial<IEditableGrid>) => setGrid({ ...grid, ...patch } as IEditableGrid);
  const number = (label: string, key: 'cellWidth' | 'cellLength' | 'uCount' | 'vCount' | 'height' | 'inset' | 'amplitude' | 'divPerMM', step: number, min?: number, max?: number) => (
    <Field label={label}>
      <NumberField value={grid[key]} step={step} min={min} max={max} onChange={(v) => set({ [key]: v })} />
    </Field>
  );
  const maxSize = grid.type === GridType.Single ? 400 : 200;
  const colors = grid.type === GridType.Single ? [grid.color] : grid.colors;
  const setColors = (colors: string[]) => set(grid.type === GridType.Single ? { color: colors[0] } : { colors });

  return (
    <>
      <Field label='Type'>
        {/* the pattern stays when switching */}
        <Select value={grid.type} options={GRID_TYPES} onChange={(type) => setGrid({ ...(DefaultGridSettings(type) as IEditableGrid), sdfSetting: grid.sdfSetting })} />
      </Field>
      {number('Width', 'cellWidth', 5, 5, maxSize)}
      {number('Length', 'cellLength', 5, 5, maxSize)}
      {grid.type === GridType.Simple && number('Columns', 'uCount', 1, 1, MAX_UV_COUNT)}
      {grid.type === GridType.Simple && number('Rows', 'vCount', 1, 1, MAX_UV_COUNT)}
      {number('Height', 'height', 0.5, 2.5, 10)}
      {number('Inset', 'inset', 0.5)}
      {number('Amplitude', 'amplitude', 0.05)}
      {number('Divisions/mm', 'divPerMM', 0.25, 0.25, MAX_DIV_PER_MM)}
      <Field label='Wireframe'>
        <input type='checkbox' checked={!!grid.displayWireframe} onChange={(e) => set({ displayWireframe: e.target.checked })} />
      </Field>
      <Field label='Colour'>
        <div className='row'>
          {colors.map((color, i) => (
            <input key={i} type='color' aria-label={`colour ${i + 1}`} value={color} onChange={(e) => setColors(colors.map((c, j) => (i === j ? e.target.value : c)))} />
          ))}
          {grid.type === GridType.Simple && (
            <>
              <button onClick={() => setColors([...colors, DEFAULT_COLOR])}>+</button>
              {colors.length > 1 && <button onClick={() => setColors(colors.slice(0, -1))}>−</button>}
            </>
          )}
        </div>
      </Field>
    </>
  );
};
