import { DefaultGridSettings, GridType, ISimpleGrid, MAX_DIV_PER_MM, MAX_VERTICES, effectiveDivPerMM, gridCells } from './grid';
import { singleGrid } from './testUtils';

// the budget is in divisions, a bar has one more row and column of vertices
const topVertices = (grid: Parameters<typeof gridCells>[0]) =>
  gridCells(grid).reduce((n, { geometrySettings: g }) => n + (g.horizontalDivisions + 1) * (g.verticalDivisions + 1), 0);

test('a small bar gets up to 32 divisions per mm', () => {
  const grid = singleGrid(40, 20, MAX_DIV_PER_MM);
  expect(effectiveDivPerMM(grid)).toBe(32);
  const [{ geometrySettings }] = gridCells(grid);
  expect([geometrySettings.horizontalDivisions, geometrySettings.verticalDivisions]).toEqual([1280, 640]);
  // more than the maximum is the maximum
  expect(effectiveDivPerMM(singleGrid(40, 20, 100))).toBe(32);
});

test('large bars and grids stay within the vertex budget', () => {
  const large = singleGrid(400, 400, 32);
  expect(effectiveDivPerMM(large)).toBeCloseTo(Math.sqrt(MAX_VERTICES / (400 * 400)), 12);
  // a long bar keeps the same density along both sides, within the size of the baked surface
  const long = singleGrid(160, 40, 32);
  expect(effectiveDivPerMM(long)).toBe(2048 / 160);
  const [{ geometrySettings: g }] = gridCells(long);
  expect([g.horizontalDivisions, g.verticalDivisions]).toEqual([2048, 512]);
  expect(topVertices(large)).toBeLessThanOrEqual(MAX_VERTICES * 1.01);

  const grid: ISimpleGrid = { ...(DefaultGridSettings(GridType.Simple) as ISimpleGrid), uCount: 10, vCount: 10, divPerMM: 32 };
  expect(effectiveDivPerMM(grid)).toBeLessThan(5);
  // a little over for the rounding and that extra row and column of every bar
  expect(topVertices(grid)).toBeLessThanOrEqual(MAX_VERTICES * 1.05);
  // within the budget the density is as asked
  expect(effectiveDivPerMM({ ...grid, uCount: 2, vCount: 2, divPerMM: 4 })).toBe(4);
});
