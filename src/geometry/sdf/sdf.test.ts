import { DistanceMethodType, distanceMethods, sdGyroid, sdSchwarzD, sdSphere } from '../sdMethods';
import { IDistanceField, sampleCentredField, sampleField } from '../field';
import { compilePattern, repeat, sdSine, smoothMin, toPattern, toWorld } from './evaluate';
import { IPattern, SdfNode, constantNode, defaultPattern, groupNode, isGroup, methodNode, sineNode, svgKey, svgNode } from './tree';
import { changeKind, duplicateNode, findPath, insertChild, moveNode, removeNode, staticScale, updateNode, wrapNode } from './treeOps';
import { formula } from './formula';
import { MAX_FIELD_SLOTS, sdfShaderPlan } from '../../three/shaders/sdfCodegen';

// the method chain the tree replaced: every method's scale is the output of the one after it, the last gets the product of all the numbers
const oldChain = (methods: [DistanceMethodType, number][]) => (x: number, y: number, z: number) => {
  let d = methods.reduce((s, [, n]) => s * n, 1);
  for (let k = methods.length - 1; k >= 0; k--) d = distanceMethods[methods[k][0]](x, y, z, d);
  return d;
};

const pattern = (root: SdfNode, extra: Partial<IPattern> = {}): IPattern => ({ root, center: { x: 0, y: 0, z: 0 }, rotation: 0, svgs: {}, ...extra });

const points = [...Array(40).keys()].map((i) => [Math.sin(i * 1.3) * 80, 10, Math.cos(i * 0.7) * 30 + i] as const);

test('the default pattern is the old method chain', () => {
  const old = oldChain([
    [DistanceMethodType.SDNeovius, 0.004],
    [DistanceMethodType.SDSchwarzD, 8.5],
  ]);
  const sdf = compilePattern(defaultPattern());
  points.forEach(([x, y, z]) => expect(sdf(x, y, z)).toBeCloseTo(old(x, y, z), 10));
});

test('a chain feeds the inner child into the scale of the outer one', () => {
  const sdf = compilePattern(pattern(groupNode('chain', [methodNode(DistanceMethodType.SDGyroid, 0.5), methodNode(DistanceMethodType.SDSchwarzD, 2)]), { center: { x: 1, y: 2, z: 3 } }));
  expect(sdf(4, 5, 6)).toBeCloseTo(sdGyroid(3, 3, 3, 0.5 * sdSchwarzD(3, 3, 3, 2)), 12);
});

test('booleans and arithmetic', () => {
  const [a, b] = [constantNode(2), constantNode(5)];
  const at = (kind: Parameters<typeof groupNode>[0]) => compilePattern(pattern(groupNode(kind, [a, b])))(0, 0, 0);
  expect(at('union')).toBe(2);
  expect(at('intersection')).toBe(5);
  // the first minus the others
  expect(at('difference')).toBe(2);
  expect(compilePattern(pattern(groupNode('difference', [b, constantNode(-3)])))(0, 0, 0)).toBe(5);
  expect(compilePattern(pattern(groupNode('difference', [constantNode(-1), constantNode(-3)])))(0, 0, 0)).toBe(3);
  expect(at('add')).toBe(7);
  expect(at('subtract')).toBe(-3);
  expect(compilePattern(pattern(groupNode('union')))(1, 2, 3)).toBe(0);
});

test('scale and gain', () => {
  const sphere = { ...methodNode(DistanceMethodType.SDSphere, 0.5), gain: 3 };
  const group = { ...groupNode('union', [sphere]), scale: 2 };
  expect(compilePattern(pattern(group))(1, 2, 3)).toBeCloseTo(3 * sdSphere(1, 2, 3, 1), 12);
});

test('the smooth minimum blends within its radius and is the minimum outside of it', () => {
  expect(smoothMin(1, 1, 0)).toBe(1);
  expect(smoothMin(1, 1, 0.4)).toBeCloseTo(0.9);
  expect(smoothMin(1, 3, 0.4)).toBe(1);
  expect(smoothMin(1, 1.0001, 1e-9)).toBe(1);
});

test('repeat is centred and tiles negative coordinates', () => {
  expect(repeat(12, 10)).toBeCloseTo(2);
  expect(repeat(-12, 10)).toBeCloseTo(-2);
  expect(repeat(-4, 10)).toBeCloseTo(-4);
  expect(repeat(-6, 10)).toBeCloseTo(4);
  expect(repeat(-6, 0)).toBe(-6);
});

test('the rotation turns the pattern around its centre', () => {
  const box = methodNode(DistanceMethodType.SDBox, 1 / 10);
  const rotated = compilePattern(pattern(box, { rotation: 90, center: { x: 1, y: 0, z: 2 } }));
  const plain = compilePattern(pattern(box));
  // (3, 7) is (2, 5) from the centre, turned by 90 degrees that is (-5, 2)
  expect(rotated(3, 0, 7)).toBeCloseTo(plain(-5, 0, 2), 12);
});

test('the sine is zero on its curve and turns with its angle', () => {
  const sine = sineNode(5, 20);
  const sdf = compilePattern(pattern(sine));
  [-13, 0, 4.2, 31].forEach((x) => expect(sdf(x, 0, 5 * Math.sin((2 * Math.PI * x) / 20))).toBeCloseTo(0, 12));
  // at a crest the curve is flat, the distance is vertical
  expect(sdf(5, 0, 8)).toBeCloseTo(3, 12);
  expect(sdf(5, 0, -2)).toBeCloseTo(7, 12);
  expect(sdSine(0, 1, 0, 10)).toBe(1);
  // turned by 90 degrees the curve runs along z
  const turned = compilePattern(pattern({ ...sine, angle: 90 }));
  expect(turned(-8, 0, 5)).toBeCloseTo(sdf(5, 0, 8), 12);
});

test('svg keys depend on the source only', () => {
  expect(svgKey('<svg/>')).toBe(svgKey('<svg/>'));
  expect(svgKey('<svg/>')).not.toBe(svgKey('<svg />'));
  expect(svgKey('')).toMatch(/^h[0-9a-f]{8}$/);
});

// a 4 x 2 field with a pixel size of 0.5, the distance grows along x
const field: IDistanceField = { width: 4, height: 2, pixelSize: 0.5, distances: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]) };

test('a centred field continues outside of its rectangle', () => {
  expect(sampleCentredField(field, 0, 0)).toBeCloseTo(sampleField(field, 1, 0.5));
  // right of the field: the edge value plus the distance to the edge
  expect(sampleCentredField(field, 2, 0)).toBeCloseTo(3 + 1);
  expect(sampleCentredField(field, -1, 0.5 + 3)).toBeCloseTo(0 + 3);
});

test('an svg leaf samples its field at its width, offset and repeat', () => {
  const fields = new Map([['a', field]]);
  const leaf = { ...svgNode('a', 10), offsetX: 5, repeat: 40 };
  const sdf = compilePattern(pattern(leaf), fields);
  expect(sdf(5, 0, 0)).toBeCloseTo(10 * sampleCentredField(field, 0, 0));
  expect(sdf(5 - 40, 0, 0)).toBeCloseTo(sdf(5, 0, 0));
  expect(sdf(15, 0, 3)).toBeCloseTo(10 * sampleCentredField(field, 1, 0.3));
  // a missing field is flat
  expect(compilePattern(pattern(leaf))(1, 2, 3)).toBe(0);
});

describe('tree edits', () => {
  const tree = () => {
    const a = methodNode(DistanceMethodType.SDGyroid);
    const b = constantNode(1);
    const inner = groupNode('chain', [b]);
    const other = groupNode('add', [constantNode(2)]);
    return { a, b, inner, other, root: groupNode('union', [a, inner, other]) };
  };

  test('unchanged subtrees are shared', () => {
    const { b, other, root } = tree();
    const next = updateNode(root, b.id, (n) => ({ ...n, gain: 2 }));
    expect(next).not.toBe(root);
    expect(isGroup(next) && next.children[2]).toBe(other);
    expect(updateNode(root, 'nothing', (n) => n)).toBe(root);
  });

  test('path, insert, move, remove', () => {
    const { a, b, inner, root } = tree();
    expect(findPath(root, b.id)?.map((n) => n.id)).toEqual([root.id, inner.id, b.id]);
    const c = constantNode(3);
    const inserted = insertChild(root, inner.id, c, 0);
    expect(findPath(inserted, c.id)?.length).toBe(3);
    const moved = moveNode(root, a.id, 1);
    expect(isGroup(moved) && moved.children.map((n) => n.id)).toEqual([inner.id, a.id, (root as { children: SdfNode[] }).children[2].id]);
    expect(moveNode(root, a.id, -1)).toBe(root);
    expect(findPath(removeNode(root, inner.id), b.id)).toBeUndefined();
    expect(removeNode(root, root.id)).toBe(root);
  });

  test('wrap, duplicate and change kind', () => {
    const { a, inner, root } = tree();
    const wrapped = wrapNode(root, a.id, 'chain');
    expect(findPath(wrapped.root, a.id)?.map((n) => n.id)).toEqual([root.id, wrapped.group.id, a.id]);

    const { root: duplicated, copy } = duplicateNode(root, inner.id);
    const ids = new Set<string>();
    const collect = (n: SdfNode) => (ids.add(n.id), isGroup(n) && n.children.forEach(collect));
    collect(duplicated);
    // the 6 nodes and the copies of inner and its child
    expect(ids.size).toBe(8);
    expect(copy && formula(copy, {})).toBe(formula(inner, {}));

    const asUnion = changeKind(a, 'union');
    expect(asUnion.id).toBe(a.id);
    expect(isGroup(asUnion) && asUnion.children[0].kind).toBe('method');
    expect(changeKind(inner, 'add')).toMatchObject({ kind: 'add', id: inner.id, children: (inner as { children: SdfNode[] }).children });
  });
});

test('formula', () => {
  expect(formula(defaultPattern().root, {})).toBe('Neovius ∘ SchwarzD@0.034');
  const star = { ...svgNode('s'), gain: 2 };
  expect(formula(groupNode('union', [methodNode(DistanceMethodType.SDGyroid, 0.3), star]), { s: { name: 'star', source: '' } })).toBe('Gyroid@0.3 ∪ 2×star');
});

describe('shader plan', () => {
  test('editing a number keeps the shader, changing the structure does not', () => {
    const p = defaultPattern();
    const plan = sdfShaderPlan(p);
    const edited = { ...p, root: updateNode(p.root, (p.root as { children: SdfNode[] }).children[1].id, (n) => ({ ...n, scale: 2 })) };
    expect(sdfShaderPlan(edited).glsl).toBe(plan.glsl);
    expect(sdfShaderPlan(edited).params(new Map())).not.toEqual(plan.params(new Map()));
    expect(sdfShaderPlan(p)).toBe(plan);
    const restructured = { ...p, root: insertChild(p.root, p.root.id, constantNode(1)) };
    expect(sdfShaderPlan(restructured).glsl).not.toBe(plan.glsl);
  });

  test('params hold scale and gain of every node, padded to vectors', () => {
    const params = sdfShaderPlan(defaultPattern()).params(new Map());
    // chain, schwarz d (the inner child is generated first), neovius
    expect([...params]).toEqual([1, Math.fround(0.004 * 8.5), 1, 1, 1, 1, 0, 0]);
  });

  test('a sine has its numbers as params', () => {
    // scale, cos, sin, amplitude, period, gain, padded to 2 vectors
    expect(sdfShaderPlan(pattern(sineNode())).params(new Map()).length).toBe(8);
    expect([...sdfShaderPlan(pattern({ ...sineNode(2, 7), angle: 90 })).params(new Map())].slice(1, 5)).toEqual([Math.fround(Math.cos(Math.PI / 2)), 1, 2, 7]);
  });

  test('too many svg shapes do not fit', () => {
    const svgs = (n: number) => groupNode('union', [...Array(n).keys()].map((i) => svgNode(`a${i}`)));
    expect(sdfShaderPlan(pattern(svgs(MAX_FIELD_SLOTS))).fits).toBe(true);
    expect(sdfShaderPlan(pattern(svgs(MAX_FIELD_SLOTS + 1))).fits).toBe(false);
    // the same asset twice takes one slot
    expect(sdfShaderPlan(pattern(groupNode('union', [svgNode('a'), svgNode('a')]))).fieldKeys).toEqual(['a']);
  });
});

test('the static scale of a node is the product of the scales down to it, unless a chain makes it vary', () => {
  const inner = methodNode(DistanceMethodType.SDGyroid, 4);
  const outer = methodNode(DistanceMethodType.SDSchwarzD, 3);
  const chain = { ...groupNode('chain', [outer, inner]), scale: 0.5 };
  const root = { ...groupNode('union', [chain]), scale: 2 };
  expect(staticScale(root, inner.id)).toBe(4);
  expect(staticScale(root, chain.id)).toBe(1);
  expect(staticScale(root, outer.id)).toBeUndefined();
  expect(staticScale(root, 'nothing')).toBeUndefined();
});

test('a point of a node is placed on the bars the way the pattern samples it', () => {
  const p = pattern(methodNode(DistanceMethodType.SDBox), { center: { x: 3, y: 0, z: -4 }, rotation: 30 });
  const world = toWorld(p, 2.5, { x: 7, z: -1 });
  expect(toPattern(p, 2.5, world).x).toBeCloseTo(7, 12);
  expect(toPattern(p, 2.5, world).z).toBeCloseTo(-1, 12);
  // a box of half size 1 at scale 2.5 * 0.4 = 1 around the point is sampled 0 at its edge
  const box = compilePattern({ ...p, root: methodNode(DistanceMethodType.SDBox, 2.5) });
  const centre = toWorld(p, 2.5, { x: 0, z: 0 });
  expect(box(centre.x, 0, centre.z)).toBeCloseTo(-1, 12);
});
