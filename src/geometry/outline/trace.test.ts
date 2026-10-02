import { expect, test } from 'vitest';
import { placeContour, signedArea, simplifyContour, smoothContour, traceCoverage } from './trace';

/** the coverage of every pixel by a shape, supersampled 16 x 16 */
export const coverageOf = (inside: (x: number, y: number) => boolean, width: number, height: number): Float32Array => {
  const coverage = new Float32Array(width * height);
  const n = 16;
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      let count = 0;
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) if (inside(i + (a + 0.5) / n, j + (b + 0.5) / n)) count++;
      coverage[j * width + i] = count / (n * n);
    }
  return coverage;
};

const points = (c: Float64Array) => Array.from({ length: c.length / 2 }, (_, k) => [c[2 * k], c[2 * k + 1]]);

test('an antialiased disc traces to one contour on its circle, with the inside on its left', () => {
  const [cx, cy, r] = [50.3, 49.6, 40];
  const contours = traceCoverage(coverageOf((x, y) => Math.hypot(x - cx, y - cy) < r, 100, 100), 100, 100);
  expect(contours.length).toBe(1);
  expect(signedArea(contours[0])).toBeGreaterThan(0);
  // linear between the pixel centres is a little off along an antialiased edge
  for (const [x, y] of points(contours[0])) expect(Math.abs(Math.hypot(x - cx, y - cy) - r)).toBeLessThan(0.12);
  // smoothing keeps it there
  for (const [x, y] of points(smoothContour(contours[0]))) expect(Math.abs(Math.hypot(x - cx, y - cy) - r)).toBeLessThan(0.12);
});

test('a hole runs the other way around', () => {
  const ring = (x: number, y: number) => Math.max(Math.abs(x - 20), Math.abs(y - 20)) < 15 && Math.max(Math.abs(x - 20), Math.abs(y - 20)) > 6;
  const contours = traceCoverage(coverageOf(ring, 40, 40), 40, 40);
  expect(contours.length).toBe(2);
  const areas = contours.map(signedArea).sort((a, b) => a - b);
  expect(areas[0]).toBeLessThan(0);
  expect(areas[1]).toBeGreaterThan(0);
  // twice the area: 30 x 30 outside, 12 x 12 the hole
  expect(areas[1]).toBeCloseTo(2 * 30 * 30, -1);
  expect(areas[0]).toBeCloseTo(-2 * 12 * 12, -1);
});

test('a hard shape at the border of the pixels is closed too', () => {
  const contours = traceCoverage([1, 1, 1, 1], 2, 2);
  expect(contours.length).toBe(1);
  // half way between the pixel centres and nothing beyond them, the corners cut off
  expect(signedArea(contours[0])).toBeCloseTo(2 * (4 - 4 * 0.125));
});

test('simplifying keeps the contour within the tolerance', () => {
  const [cx, cy, r] = [30, 30, 25];
  const [contour] = traceCoverage(coverageOf((x, y) => Math.hypot(x - cx, y - cy) < r, 60, 60), 60, 60);
  const simple = simplifyContour(contour, 0.05);
  expect(simple.length).toBeLessThan(contour.length / 2);
  for (const [x, y] of points(simple)) expect(Math.abs(Math.hypot(x - cx, y - cy) - r)).toBeLessThan(0.15);
});

test('a placed contour is scaled, turned and moved', () => {
  const placed = placeContour(Float64Array.from([1, 0, 0, 1]), 2, Math.PI / 2, 10, 20);
  expect([...placed].map((v) => +v.toFixed(9))).toEqual([10, 22, 8, 20]);
});
