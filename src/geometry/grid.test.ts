import { BarKind, IBar, MAX_DIVS_ONE_SIDE, MAX_DIV_PER_MM, MAX_VERTICES, barBases, defaultBar, effectiveDivPerMM, gridBox, gridCells } from './grid';
import { ChocolateType } from './chocolates';
import { TABLET_LAYOUTS } from './tablets';
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
  // a long bar of the usual size fits at full density
  const [{ geometrySettings: usual }] = gridCells(singleGrid(160, 40, 32));
  expect([usual.horizontalDivisions, usual.verticalDivisions]).toEqual([5120, 1280]);
  // a longer one keeps the same density along both sides, within the size of the baked surface
  const long = singleGrid(300, 20, 32);
  expect(effectiveDivPerMM(long)).toBe(MAX_DIVS_ONE_SIDE / 300);
  const [{ geometrySettings: g }] = gridCells(long);
  expect([g.horizontalDivisions, g.verticalDivisions]).toEqual([8192, 546]);
  expect(topVertices(large)).toBeLessThanOrEqual(MAX_VERTICES * 1.01);

  // a whole tablet is a little too large for the budget at the finest
  const tablet = { ...defaultBar(), divPerMM: 32 };
  expect(effectiveDivPerMM(tablet)).toBeLessThan(32);
  expect(topVertices(tablet)).toBeLessThanOrEqual(MAX_VERTICES * 1.01);
  // the pieces of a combined tablet count together, a little over for the rounding and that extra row and column of every bar
  const combined: IBar = { ...tablet, kind: BarKind.Combined, pieces: TABLET_LAYOUTS.at(-1)!, inset: 0 };
  expect(effectiveDivPerMM(combined)).toBeLessThan(32);
  expect(topVertices(combined)).toBeLessThanOrEqual(MAX_VERTICES * 1.05);
  // within the budget the density is as asked
  expect(effectiveDivPerMM({ ...combined, divPerMM: 4 })).toBe(4);
});

test('a whole tablet is 150 by 70 mm at its base, its top smaller by the inset', () => {
  const bar = defaultBar();
  expect(barBases(bar)).toEqual([{ minX: -75, minZ: -35, maxX: 75, maxZ: 35 }]);
  const [{ geometrySettings: g }] = gridCells(bar);
  expect([g.innerWidth, g.innerLength, g.basePosition.x, g.basePosition.z]).toEqual([144, 64, -72, -32]);
  expect(gridBox({ ...bar, tablet: '1x2' })).toEqual({ minX: -9.5, minZ: -32, maxX: 9.5, maxZ: 32 });
});

test('the pieces of a combined tablet have their own chocolate, or all the first one', () => {
  const pieces = TABLET_LAYOUTS[0];
  const bar: IBar = { ...defaultBar(), kind: BarKind.Combined, pieces, chocolates: [ChocolateType.Milk, ChocolateType.White], sameChocolate: false };
  const chocolates = (b: IBar) => gridCells(b).map((c) => c.geometrySettings.chocolate);
  expect(chocolates(bar)).toEqual([ChocolateType.Milk, ChocolateType.White, ...pieces.slice(2).map(() => ChocolateType.Milk)]);
  expect(chocolates({ ...bar, sameChocolate: true })).toEqual(pieces.map(() => ChocolateType.Milk));
  // the pattern is placed on all of them together
  expect(gridBox(bar)).toEqual({ minX: -72, minZ: -32, maxX: 72, maxZ: 32 });
});
