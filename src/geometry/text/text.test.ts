import { signedDistanceTransform } from './edt';
import { ITextField, ITextRelief, reliefHeight, textMask } from './textField';
import { sampleField } from '../field';
import { GridParser } from '../grid';
import { singleGrid } from '../testUtils';

// the distance to the nearest pixel on the other side of the outline, the slow way
const bruteForce = (mask: number[], width: number): number[] =>
  mask.map((m, p) => {
    let nearest = Infinity;
    for (let q = 0; q < mask.length; q++) {
      if (!!mask[q] === !!m) continue;
      nearest = Math.min(nearest, Math.hypot((q % width) - (p % width), Math.floor(q / width) - Math.floor(p / width)));
    }
    return (m ? -1 : 1) * (nearest - 0.5);
  });

test.each([
  [7, 5],
  [16, 16],
  [3, 31],
  [40, 9],
])('the distance transform is exact (%i x %i)', (width, height) => {
  // a few deterministic blobs
  const mask = [...Array(width * height).keys()].map((p) => {
    const [x, y] = [p % width, Math.floor(p / width)];
    return Math.hypot(x - width * 0.3, y - height * 0.4) < Math.min(width, height) * 0.3 || (x * 7 + y * 13) % 11 === 0 ? 1 : 0;
  });
  const distances = signedDistanceTransform(mask, width, height);
  bruteForce(mask, width).forEach((d, p) => expect(distances[p]).toBeCloseTo(d, 4));
});

test('the distance is negative inside, and half a pixel from the outline next to it', () => {
  const distances = signedDistanceTransform([0, 0, 1, 1, 1, 0], 6, 1);
  expect([...distances]).toEqual([1.5, 0.5, -0.5, -1.5, -0.5, 0.5]);
});

test('a mask without an outline has no finite distance', () => {
  expect([...signedDistanceTransform([0, 0, 0, 0], 2, 2)]).toEqual([Infinity, Infinity, Infinity, Infinity]);
  expect([...signedDistanceTransform([1, 1, 1, 1], 2, 2)]).toEqual([-Infinity, -Infinity, -Infinity, -Infinity]);
});

// 4 x 2 pixels of 0.5 mm, the distance equals the pixel column
const field: ITextField = { width: 4, height: 2, pixelSize: 0.5, distances: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]) };

test('the field is sampled at the pixel centres, bilinear in between and clamped outside', () => {
  expect(sampleField(field, 0.25, 0.25)).toBeCloseTo(0);
  expect(sampleField(field, 0.75, 0.75)).toBeCloseTo(1);
  expect(sampleField(field, 1, 0.5)).toBeCloseTo(1.5);
  expect(sampleField(field, -5, -5)).toBeCloseTo(0);
  expect(sampleField(field, 50, 50)).toBeCloseTo(3);
});

test('the mask blends over the bevel width around the outline', () => {
  expect(textMask(-1, 1)).toBe(1);
  expect(textMask(-0.5, 1)).toBe(1);
  expect(textMask(0, 1)).toBeCloseTo(0.5);
  expect(textMask(0.5, 1)).toBe(0);
  expect(textMask(0.25, 1)).toBeGreaterThan(0);
  expect(textMask(0.25, 1)).toBeLessThan(0.5);
  // no bevel is a step
  expect(textMask(-0.01, 0)).toBe(1);
  expect(textMask(0.01, 0)).toBe(0);
});

test('the relief is the pattern, faded on the text, plus the text', () => {
  const inside: ITextField = { ...field, distances: new Float32Array(8).fill(-10) };
  const outside: ITextField = { ...field, distances: new Float32Array(8).fill(10) };
  const relief = (f: ITextField, patternFade: number): ITextRelief => ({ field: f, depth: 0.6, bevelWidth: 0.5, patternFade });

  expect(reliefHeight(2, 0.2, 1, 0.5)).toBeCloseTo(0.4);
  expect(reliefHeight(2, 0.2, 1, 0.5, relief(outside, 1))).toBeCloseTo(0.4);
  expect(reliefHeight(2, 0.2, 1, 0.5, relief(inside, 1))).toBeCloseTo(0.6);
  expect(reliefHeight(2, 0.2, 1, 0.5, relief(inside, 0))).toBeCloseTo(1);
  expect(reliefHeight(2, 0.2, 1, 0.5, relief(inside, 0.5))).toBeCloseTo(0.8);
});

test('text raises the top of the mesh where it is, and leaves the rest of the bar as it was', () => {
  const [hd, vd] = [20, 10];
  // a 6 x 4 mm block in the middle of the bar
  const mask = [...Array(hd * vd).keys()].map((p) => (Math.abs((p % hd) + 0.5 - hd / 2) < 3 && Math.abs(Math.floor(p / hd) + 0.5 - vd / 2) < 2 ? 1 : 0));
  const text: ITextRelief = { field: { width: hd, height: vd, pixelSize: 1, distances: signedDistanceTransform(mask, hd, vd) }, depth: 1.5, bevelWidth: 0.5, patternFade: 1 };

  const grid = { ...singleGrid(hd, vd, 1), inset: 0 };
  const [plain] = GridParser(grid, [], true);
  const [embossed] = GridParser(grid, [], true, text);

  expect(embossed.faces).toEqual(plain.faces);
  const top = (mesh: typeof plain, i: number, j: number) => mesh.vertices[(i * (vd + 1) + j) * 3 + 1];
  // in the middle of the block: flat, at the height of the text
  expect(top(embossed, hd / 2, vd / 2)).toBeCloseTo(grid.height + 1.5);
  // away from it nothing changed
  for (const [i, j] of [[0, 0], [2, 5], [hd, vd], [hd / 2, 0]]) expect(top(embossed, i, j)).toBe(top(plain, i, j));
});
