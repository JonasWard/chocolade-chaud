import { COLUMNS, DEFAULT_PIECES, TABLET_LAYOUTS, TABLET_SIZES, isLayout, pieceBoxes, sameLayout, tabletSize } from './tablets';

test('the tablets are measured from the whole one of 150 by 70 mm', () => {
  expect(TABLET_SIZES.map(tabletSize)).toEqual([
    { width: 25, length: 70 },
    { width: 50, length: 35 },
    { width: 100, length: 35 },
    { width: 150, length: 70 },
  ]);
});

test('there are 30 layouts, each fills the whole tablet once', () => {
  expect(TABLET_LAYOUTS.length).toBe(30);
  TABLET_LAYOUTS.forEach((layout) => expect(isLayout(layout)).toBe(true));
  TABLET_LAYOUTS.forEach((a, i) => TABLET_LAYOUTS.forEach((b, j) => i !== j && expect(sameLayout(a, b)).toBe(false)));
  expect(TABLET_LAYOUTS.some((l) => sameLayout(l, DEFAULT_PIECES))).toBe(true);
  // the fewest pieces first
  expect(TABLET_LAYOUTS[0].length).toBe(4);
  expect(TABLET_LAYOUTS.at(-1)!.length).toBe(COLUMNS);
});

test('a layout is pieces that fill the tablet without overlapping', () => {
  expect(isLayout(DEFAULT_PIECES.slice(1))).toBe(false);
  expect(isLayout([...DEFAULT_PIECES, { size: '1x2', u: 0, v: 0 }])).toBe(false);
  expect(isLayout(DEFAULT_PIECES.map((p) => ({ ...p, u: p.u + 1 })))).toBe(false);
});

test('the pieces fill 150 by 70 mm, a gap of 1 mm between them', () => {
  const boxes = pieceBoxes(DEFAULT_PIECES);
  expect(boxes).toEqual([
    { minX: -75, maxX: 24.5, minZ: -35, maxZ: -0.5 },
    { minX: 25.5, maxX: 75, minZ: -35, maxZ: -0.5 },
    { minX: -75, maxX: -25.5, minZ: 0.5, maxZ: 35 },
    { minX: -24.5, maxX: 75, minZ: 0.5, maxZ: 35 },
  ]);
  const area = boxes.reduce((a, b) => a + (b.maxX - b.minX) * (b.maxZ - b.minZ), 0);
  // a gap across the width between the rows, one between the pieces of each row
  expect(area).toBeCloseTo(150 * 70 - 150 - 2 * 34.5, 6);
});
