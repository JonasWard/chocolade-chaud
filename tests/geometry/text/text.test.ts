import { IDistanceField, fieldDetail, sampleField } from '../../../src/geometry/field';
import { layoutGlyphs } from '../../../src/geometry/text/layout';
import { compilePattern } from '../../../src/geometry/sdf/evaluate';
import { textFieldKey, textNode } from '../../../src/geometry/sdf/tree';

// 4 x 2 pixels of 0.5 mm, the distance equals the pixel column
const field: IDistanceField = { width: 4, height: 2, pixelSize: 0.5, distances: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]) };

test('the field is sampled at the pixel centres, bicubic in between and along its slope outside', () => {
  expect(sampleField(field, 0.25, 0.25)).toBeCloseTo(0);
  expect(sampleField(field, 0.75, 0.75)).toBeCloseTo(1);
  expect(sampleField(field, 1, 0.5)).toBeCloseTo(1.5);
  // half a pixel past the edge centres
  expect(sampleField(field, 0, 0.5)).toBeCloseTo(-0.5);
  expect(sampleField(field, 2, -0.5)).toBeCloseTo(3.5);
});

// 8 x 8 pixels of 1 mm with the given distance at every pixel centre
const fieldOf = (f: (x: number, z: number) => number): IDistanceField => ({
  width: 8,
  height: 8,
  pixelSize: 1,
  distances: Float32Array.from({ length: 64 }, (_, p) => f((p % 8) + 0.5, Math.floor(p / 8) + 0.5)),
});

test('the bicubic sample reproduces a linear field', () => {
  const linear = fieldOf((x, z) => 0.3 * x - 0.7 * z + 1);
  for (const [x, z] of [[2.5, 3.5], [3.1, 4.7], [4.25, 2.9], [5.5, 5.01]]) expect(sampleField(linear, x, z)).toBeCloseTo(0.3 * x - 0.7 * z + 1, 5);
});

test('the slope of the bicubic sample is continuous across the pixel centres, unlike a bilinear one', () => {
  const disc = fieldOf((x, z) => Math.hypot(x - 1.2, z - 0.7) - 2);
  const slope = (x: number) => (sampleField(disc, x + 1e-4, 4.2) - sampleField(disc, x - 1e-4, 4.2)) / 2e-4;
  // on both sides of the pixel centre at x = 3.5
  expect(Math.abs(slope(3.5 - 1e-3) - slope(3.5 + 1e-3))).toBeLessThan(1e-2);
  // bilinear would jump there by the change of the slope between the pixels
  const step = (x: number) => disc.distances[4 * 8 + x];
  const bilinearJump = Math.abs(step(4) - step(3) - (step(3) - step(2)));
  expect(bilinearJump).toBeGreaterThan(0.05);
});

test('a field is drawn finer when its node is enlarged, in powers of two up to 8', () => {
  expect([4, 1, 0.9, 0.5, 0.3, 0.2, 0.01].map(fieldDetail)).toEqual([1, 1, 1, 2, 4, 8, 8]);
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
