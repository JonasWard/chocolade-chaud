import { signedDistanceTransform } from './edt';
import { IDistanceField, sampleField } from '../field';
import { layoutGlyphs } from './layout';
import { compilePattern } from '../sdf/evaluate';
import { textFieldKey, textNode } from '../sdf/tree';

// the distance from a pixel centre to the nearest pixel on the other side of the outline, the slow way
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
])('the distance transform of a hard mask is exact (%i x %i)', (width, height) => {
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

test('an antialiased edge puts the outline where it crosses its pixel', () => {
  // a half plane from x = 10.3 on: the pixel with its centre at 10 is covered for 0.2
  const width = 24;
  const coverage = [...Array(width).keys()].map((x) => Math.min(Math.max(x + 0.5 - 10.3, 0), 1));
  const distances = [...signedDistanceTransform(coverage, width, 1)];
  distances.forEach((d, x) => expect(d).toBeCloseTo(10.3 - x, 1));
});

test('an antialiased disc is within a sixth of a pixel, a thresholded one is not', () => {
  const [size, r, c] = [64, 20, { x: 31.7, y: 30.2 }];
  // the coverage of every pixel by supersampling
  const n = 8;
  const coverage = [...Array(size * size).keys()].map((p) => {
    const [px, py] = [p % size, Math.floor(p / size)];
    let inside = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (Math.hypot(px + (i + 0.5) / n - c.x, py + (j + 0.5) / n - c.y) < r) inside++;
    return inside / (n * n);
  });
  const error = (distances: Float32Array) => {
    let max = 0;
    distances.forEach((d, p) => {
      const exact = Math.hypot((p % size) + 0.5 - c.x, Math.floor(p / size) + 0.5 - c.y) - r;
      if (Math.abs(exact) < 4) max = Math.max(max, Math.abs(d - exact));
    });
    return max;
  };
  const antialiased = error(signedDistanceTransform(coverage, size, size));
  const thresholded = error(signedDistanceTransform(coverage.map((a) => (a >= 0.5 ? 1 : 0)), size, size));
  expect(antialiased).toBeLessThan(0.15);
  expect(thresholded).toBeGreaterThan(2 * antialiased);
});

test('a mask without an outline has no finite distance', () => {
  expect([...signedDistanceTransform([0, 0, 0, 0], 2, 2)]).toEqual([Infinity, Infinity, Infinity, Infinity]);
  expect([...signedDistanceTransform([1, 1, 1, 1], 2, 2)]).toEqual([-Infinity, -Infinity, -Infinity, -Infinity]);
});

// 4 x 2 pixels of 0.5 mm, the distance equals the pixel column
const field: IDistanceField = { width: 4, height: 2, pixelSize: 0.5, distances: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]) };

test('the field is sampled at the pixel centres, bilinear in between and clamped outside', () => {
  expect(sampleField(field, 0.25, 0.25)).toBeCloseTo(0);
  expect(sampleField(field, 0.75, 0.75)).toBeCloseTo(1);
  expect(sampleField(field, 1, 0.5)).toBeCloseTo(1.5);
  expect(sampleField(field, -5, -5)).toBeCloseTo(0);
  expect(sampleField(field, 50, 50)).toBeCloseTo(3);
});

test('a straight line of text is centred on its offset and turned by its angle', () => {
  const glyphs = layoutGlyphs([2, 4, 2], { x: 10, z: -5, angle: 0 });
  expect(glyphs.map((g) => g.x)).toEqual([7, 10, 13]);
  expect(glyphs.every((g) => g.z === -5 && g.angle === 0)).toBe(true);
  const turned = layoutGlyphs([2, 2], { x: 0, z: 0, angle: 90 });
  expect(turned[1].x).toBeCloseTo(0);
  expect(turned[1].z).toBeCloseTo(1);
});

test('text along a curve is centred on it and follows its tangent', () => {
  // an L of 20 mm along x, then 20 mm along z
  const curve = { mode: 'polyline' as const, points: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 20 }] };
  const glyphs = layoutGlyphs([4, 4, 4, 4], curve);
  expect(glyphs.map((g) => [g.x, g.z])).toEqual([
    [14, 0],
    [18, 0],
    [20, 2],
    [20, 6],
  ]);
  expect(glyphs.map((g) => g.angle)).toEqual([0, 0, Math.PI / 2, Math.PI / 2]);
});

test('a text node samples its field around the centre of it', () => {
  const node = textNode('a');
  const centred: IDistanceField = { ...field, center: { x: 30, z: -10 } };
  const sdf = compilePattern({ root: node, center: { x: 0, y: 0, z: 0 }, rotation: 0, svgs: {} }, new Map([[textFieldKey(node), centred]]));
  // the middle of the field, 1 by 0.5 mm, is at its centre
  expect(sdf(30, 0, -10)).toBeCloseTo(sampleField(field, 1, 0.5));
  // without its field it is flat
  expect(compilePattern({ root: node, center: { x: 0, y: 0, z: 0 }, rotation: 0, svgs: {} })(30, 0, -10)).toBe(0);
});

test('the field key changes with what is drawn only', () => {
  const node = textNode('a');
  expect(textFieldKey({ ...node, gain: 3, scale: 2 })).toBe(textFieldKey(node));
  expect(textFieldKey({ ...node, font: 'serif' })).not.toBe(textFieldKey(node));
  expect(textFieldKey({ ...node, curve: { mode: 'polyline', points: [{ x: 0, z: 0 }, { x: 1, z: 0 }] } })).not.toBe(textFieldKey(node));
});
