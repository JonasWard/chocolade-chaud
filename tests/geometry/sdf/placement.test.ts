import { IDistanceField } from '../../../src/geometry/field';
import { placePattern, placementOffset } from '../../../src/geometry/sdf/placement';
import { DEFAULT_PLACEMENT, IPattern, ITextNode, SdfNode, groupNode, svgNode, textFieldKey, textNode } from '../../../src/geometry/sdf/tree';

const bars = { minX: -80, minZ: -20, maxX: 80, maxZ: 20 };
const pattern = (root: SdfNode, extra: Partial<IPattern> = {}): IPattern => ({ root, center: { x: 0, y: 0, z: 0 }, rotation: 0, svgs: {}, ...extra });
// a field of nothing but the box around what it draws
const field = (bounds: IDistanceField['bounds']): IDistanceField => ({ width: 1, height: 1, pixelSize: 1, distances: new Float32Array(1), bounds });

test('against an edge the ink goes the padding away from it, centred it moves by the padding', () => {
  const ink = { minX: -10, minZ: -3, maxX: 12, maxZ: 5 };
  const at = (alignX: string, alignZ: string, paddingX = 2, paddingZ = 1) =>
    placementOffset({ ...DEFAULT_PLACEMENT, alignX, alignZ, paddingX, paddingZ } as typeof DEFAULT_PLACEMENT, bars, ink);
  expect(at('left', 'top')).toEqual({ x: -80 + 2 + 10, z: -20 + 1 + 3 });
  expect(at('right', 'bottom')).toEqual({ x: 80 - 2 - 12, z: 20 - 1 - 5 });
  expect(at('center', 'middle', -4, 6)).toEqual({ x: -4, z: 6 });
});

test('a pattern places its texts and svgs on the box of the bars, in the plane of the node', () => {
  const text = { ...textNode('a'), alignX: 'left', alignZ: 'top', paddingX: 5, paddingZ: 5 } as ITextNode;
  const star = { ...svgNode('star', 10), alignX: 'right' as const };
  const root = groupNode('union', [text, { ...groupNode('union', [star]), scale: 2 }]);
  const fields = new Map([
    [textFieldKey(text), field({ minX: -6, minZ: -4, maxX: 6, maxZ: 4 })],
    // in units of the long side of the shape
    ['star', field({ minX: -0.5, minZ: -0.4, maxX: 0.5, maxZ: 0.4 })],
  ]);
  const placed = placePattern(pattern(root), bars, fields).root as { children: SdfNode[] };
  expect(placed.children[0]).toMatchObject({ offsetX: -80 + 5 + 6, offsetZ: -20 + 5 + 4 });
  // a scale of 2 makes the bars twice as large in its plane
  expect((placed.children[1] as { children: SdfNode[] }).children[0]).toMatchObject({ offsetX: 160 - 5, offsetZ: 0 });
});

test('a pattern moved and turned aligns to the box around the bars in its plane', () => {
  const text = { ...textNode('a'), alignX: 'left' } as ITextNode;
  const fields = new Map([[textFieldKey(text), field({ minX: -6, minZ: -4, maxX: 6, maxZ: 4 })]]);
  // turned a quarter: the length of the bars runs along x in the plane of the pattern
  const placed = placePattern(pattern(text, { rotation: 90, center: { x: 10, y: 0, z: 0 } }), bars, fields).root;
  expect((placed as ITextNode).offsetX).toBeCloseTo(-20 + 6, 10);
});

test('without its field a text goes with its origin against the edge', () => {
  const text = { ...textNode('a'), alignX: 'right', paddingX: 3 } as ITextNode;
  expect(placePattern(pattern(text), bars).root).toMatchObject({ offsetX: 77, offsetZ: 0 });
});
