import { expect, test } from 'vitest';
import { buildOutlineField, levelField } from '../../../src/geometry/outline/outlineField';
import { sampleCentredField } from '../../../src/geometry/field';
import { Contour } from '../../../src/geometry/outline/trace';

/** a regular polygon close to a circle, counter clockwise or (hole) clockwise */
const circle = (cx: number, cy: number, r: number, n = 720, hole = false): Contour =>
  Float64Array.from({ length: 2 * n }, (_, k) => {
    const a = (2 * Math.PI * Math.floor(k / 2)) / n;
    return k % 2 ? cy + r * Math.sin(hole ? -a : a) : cx + r * Math.cos(hole ? -a : a);
  });

// a polygon of 720 sides of radius 20 is within 20 (1 - cos(pi / 720)) = 2e-4 of the circle
const sagitta = (r: number, n = 720) => r * (1 - Math.cos(Math.PI / n));

test('the distance to an outline is exact, negative inside', () => {
  const [w, h, p] = [64, 48, 0.5];
  const field = levelField([circle(15, 12, 7)], 0, 0, w, h, p);
  let worst = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const exact = Math.hypot((i + 0.5) * p - 15, (j + 0.5) * p - 12) - 7;
      worst = Math.max(worst, Math.abs(field[j * w + i] - exact));
    }
  expect(worst).toBeLessThan(sagitta(7) + 1e-6);
});

test('overlapping shapes are one, a hole is outside', () => {
  const [w, h] = [40, 20];
  const field = levelField([circle(12, 10, 6), circle(22, 10, 6), circle(12, 10, 2, 720, true)], 0, 0, w, h, 1);
  const at = (x: number, y: number) => field[Math.floor(y) * w + Math.floor(x)];
  // inside both discs
  expect(at(17, 10)).toBeLessThan(0);
  // in the hole of the first one
  expect(at(12, 10)).toBeGreaterThan(0);
  expect(at(12, 10)).toBeCloseTo(2 - Math.hypot(0.5, 0.5), 3);
  expect(at(35, 10)).toBeGreaterThan(0);
});

test('around a shape the distance has no rays: it is the same all along a ring', () => {
  const [w, h] = [100, 100];
  const field = levelField([circle(50, 50, 15)], 0, 0, w, h, 1);
  const ring = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const r = Math.hypot(i + 0.5 - 50, j + 0.5 - 50);
      if (r > 30 && r < 40) ring.push(field[j * w + i] - (r - 15));
    }
  expect(Math.max(...ring.map(Math.abs))).toBeLessThan(sagitta(15) + 1e-6);
});

test('the levels of a field keep the distance exact far from the shape, without a step between them', () => {
  const field = buildOutlineField([circle(0, 0, 5)], { minX: -8, minZ: -8, maxX: 8, maxZ: 8 }, 0.1);
  expect(field.levels?.length).toBe(3);
  const exact = (x: number, z: number) => Math.hypot(x, z) - 5;
  // far out, up to 64 times the box
  for (const [x, z] of [
    [20, 3],
    [-60, 41],
    [300, -250],
    [500, 10],
  ])
    expect(Math.abs(sampleCentredField(field, x, z) - exact(x, z))).toBeLessThan(0.005 * exact(x, z));
  // across the edges of the levels, in small steps
  let worst = 0;
  // the last level reaches 64 x 16 / 2 = 512 out
  for (let x = 0; x < 480; x += 0.37) worst = Math.max(worst, Math.abs(sampleCentredField(field, x, 0.3 * x) - exact(x, 0.3 * x)));
  expect(worst).toBeLessThan(0.05);
});

test('building the field of a text is quick enough', () => {
  // about the outline of a word: 20 shapes of 400 points over 2048 x 700 pixels
  const shapes = Array.from({ length: 20 }, (_, k) => circle(6 + k * 6, 10, 2.5 + (k % 3), 400));
  const start = performance.now();
  buildOutlineField(shapes, { minX: 0, minZ: 0, maxX: 130, maxZ: 20 }, 130 / 2048);
  const ms = performance.now() - start;
  console.log(`outline field of 2048 x 315 pixels and its levels in ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThan(5000);
});
