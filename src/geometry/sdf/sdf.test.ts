import { DistanceMethodType, distanceMethods, sdGyroid, sdSchwarzD, sdSphere } from '../sdMethods';
import { IDistanceField, sampleCentredField, sampleField } from '../field';
import { compilePattern, fromNode, nodeScaleAt, profile, repeat, smoothMin, toPattern, toWorld } from './evaluate';
import { DEFAULT_PROFILE, IPattern, SdfNode, constantNode, defaultPattern, groupNode, isGroup, methodNode, sineNode, svgKey, svgNode, textNode } from './tree';
import { canUnwrap, changeKind, duplicateNode, findPath, insertChild, moveInto, moveNode, moveOut, moveTargets, nodeFrame, removeNode, staticScale, unwrap, updateNode, wrapNode } from './treeOps';
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

test('the default pattern is the old method chain, times the amplitude the bars had', () => {
  const old = oldChain([
    [DistanceMethodType.SDNeovius, 0.004],
    [DistanceMethodType.SDSchwarzD, 8.5],
  ]);
  const sdf = compilePattern(defaultPattern());
  points.forEach(([x, y, z]) => expect(sdf(x, y, z)).toBeCloseTo(0.2 * old(x, y, z), 10));
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

test('a sine ripples along the distance of its children', () => {
  const sphere = methodNode(DistanceMethodType.SDSphere, 0.1);
  const sdf = compilePattern(pattern({ ...sineNode(2, 7, [sphere, constantNode(0.5)]), gain: 1.5 }));
  const child = compilePattern(pattern(sphere));
  points.forEach(([x, y, z]) => expect(sdf(x, y, z)).toBeCloseTo(1.5 * 2 * Math.sin((2 * Math.PI * (child(x, y, z) + 0.5)) / 7), 12));
  // nothing to modify, or no period, is nothing
  expect(compilePattern(pattern(sineNode(2, 7)))(1, 2, 3)).toBe(0);
  expect(compilePattern(pattern(sineNode(2, 0, [constantNode(1)])))(1, 2, 3)).toBe(0);
  // the scale of the sine is the scale of its children
  const scaled = compilePattern(pattern({ ...sineNode(2, 7, [methodNode(DistanceMethodType.SDSphere)]), scale: 0.1 }));
  points.forEach(([x, y, z]) => expect(scaled(x, y, z)).toBeCloseTo(2 * Math.sin((2 * Math.PI * child(x, y, z)) / 7), 12));
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
  // right of the field: the value at the edge (half a pixel past the last centre, along the slope) plus the distance to the edge
  expect(sampleCentredField(field, 2, 0)).toBeCloseTo(3.5 + 1);
  expect(sampleCentredField(field, -1, 0.5 + 3)).toBeCloseTo(-0.5 + 3);
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

test('a scale changes the size of an svg, not its distances in mm', () => {
  const fields = new Map([['a', field]]);
  const leaf = svgNode('a', 10);
  const once = compilePattern(pattern(leaf), fields);
  const twice = compilePattern(pattern({ ...leaf, scale: 2 }), fields);
  // twice as small, the same distance in mm
  for (const x of [-12, -3, 0.5, 4, 9]) expect(twice(x / 2, 0, 1)).toBeCloseTo(once(x, 0, 2) / 2);
  // the profile is in mm on the bars too
  const flat = { ...leaf, scale: 2, outer: 1 };
  expect(compilePattern(pattern(flat), fields)(40, 0, 0)).toBeCloseTo(1);
});

test('in a chain, a child that is not the last divides by its own scale only', () => {
  const fields = new Map([['a', field]]);
  const leaf = { ...svgNode('a', 10), scale: 3 };
  const chain = { ...groupNode('chain', [leaf, constantNode(0.5)]), scale: 2 };
  const sdf = compilePattern(pattern(chain), fields);
  // evaluated at the output of the constant times its scale, divided by its scale
  expect(sdf(4, 0, 0)).toBeCloseTo((10 * sampleCentredField(field, (4 * 0.5 * 3) / 10, 0)) / 3);
  expect(nodeFrame(chain, leaf.id)).toEqual({ scale: 3, exact: false });
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
  expect(formula(defaultPattern().root, {})).toBe('0.2×(Neovius ∘ SchwarzD@0.034)');
  expect(formula(sineNode(0.5, 4, [textNode('a'), constantNode(1)]), {})).toBe('Sine(0.5, 4)("a" + 1)');
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
    expect([...params]).toEqual([1, Math.fround(0.004 * 8.5), 1, 1, 1, Math.fround(0.2), 0, 0]);
  });

  test('a sine has its numbers as params', () => {
    // scale, amplitude, 2 pi / period, gain
    expect([...sdfShaderPlan(pattern(sineNode(2, 7))).params(new Map())]).toEqual([1, 2, Math.fround((2 * Math.PI) / 7), 1]);
    // its child comes first, then its own; without a period it is 0
    expect([...sdfShaderPlan(pattern(sineNode(2, 0, [constantNode(3)]))).params(new Map())]).toEqual([1, 1, 3, 1, 0, 0, 1, 0]);
  });

  test('an svg and a text node have their profile as params', () => {
    // svg: scale, offset x z, width, repeat, the sizes of its levels (7), its frame, 5 of the profile, gain: 19 in 5 vec4s
    expect(sdfShaderPlan(pattern(svgNode('a'))).params(new Map()).length).toBe(20);
    // text: scale, centre x z, the sizes of its levels (7), its frame, 5 of the profile, gain: 17 in 5 vec4s
    expect(sdfShaderPlan(pattern(textNode('a'))).params(new Map()).length).toBe(20);
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
  // the outer child of a chain has a frame as if the inner one gave 1
  expect(nodeFrame(root, outer.id)).toEqual({ scale: 3, exact: false });
  expect(nodeFrame(root, inner.id)).toEqual({ scale: 4, exact: true });
  expect(nodeFrame(root, root.id)).toEqual({ scale: 2, exact: true });
});

test('the profile of a distance: limits inside and outside, optional bevels', () => {
  const ds = [-5, -1, -0.25, 0, 0.5, 4];
  // the default is the distance itself
  expect(ds.map((d) => profile(d, DEFAULT_PROFILE))).toEqual(ds);
  // the distance stops at the limits, 0 is none
  const limited = { ...DEFAULT_PROFILE, inner: 2, outer: 3 };
  expect(ds.map((d) => profile(d, limited))).toEqual([-2, -1, -0.25, 0, 0.5, 3]);
  expect(profile(-7, { ...limited, inner: 0 })).toBe(-7);
  expect(profile(7, { ...limited, outer: 0 })).toBe(7);
  // with bevels a limit is reached over the width of its bevel, on both sides
  const beveled = { ...limited, beveled: true, innerBevel: 1, outerBevel: 6 };
  expect(ds.map((d) => profile(d, beveled))).toEqual([-2, -2, -0.5, 0, 0.25, 2]);
  // a bevel of 0 is a step, a bevel as wide as its limit the same as none
  expect(profile(-0.01, { ...beveled, innerBevel: 0 })).toBe(-2);
  expect(ds.map((d) => profile(d, { ...beveled, innerBevel: 2, outerBevel: 3 }))).toEqual(ds.map((d) => profile(d, limited)));
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

describe('moving nodes between groups', () => {
  // union [ a, chain [ b, c ], add [ d ] ]
  const tree = () => {
    const [a, b, c, d] = [constantNode(1), methodNode(DistanceMethodType.SDGyroid), methodNode(DistanceMethodType.SDSchwarzD, 0.1), constantNode(4)];
    const chain = groupNode('chain', [b, c]);
    const add = groupNode('add', [d]);
    return { a, b, c, d, chain, add, root: groupNode('union', [a, chain, add]) };
  };
  const ids = (n: SdfNode): unknown => (isGroup(n) ? [n.kind, n.children.map(ids)] : n.id);

  test('into another group, last, which in a chain is the innermost', () => {
    const { a, b, c, d, chain, add, root } = tree();
    expect(ids(moveInto(root, a.id, chain.id))).toEqual(['union', [['chain', [b.id, c.id, a.id]], ['add', [d.id]]]]);
    const moved = moveInto(root, b.id, add.id);
    expect(ids(moved)).toEqual(['union', [a.id, ['chain', [c.id]], ['add', [d.id, b.id]]]]);
    // the untouched part is shared
    expect((moved as { children: SdfNode[] }).children[0]).toBe(a);
  });

  test('not into itself, what is inside it, or where it already is', () => {
    const { a, chain, root } = tree();
    expect(moveInto(root, chain.id, chain.id)).toBe(root);
    expect(moveInto(root, a.id, root.id)).toBe(root);
    const nested = moveInto(root, a.id, chain.id);
    expect(moveInto(nested, chain.id, chain.id)).toBe(nested);
    expect(moveTargets(root, chain.id).map((t) => t.group.kind)).toEqual(['add']);
    expect(moveTargets(root, a.id).map((t) => t.path.map((n) => n.kind).join(' › '))).toEqual(['union › chain', 'union › add']);
  });

  test('out of a group, right after it', () => {
    const { a, b, c, d, chain, root } = tree();
    expect(ids(moveOut(root, b.id))).toEqual(['union', [a.id, ['chain', [c.id]], b.id, ['add', [d.id]]]]);
    expect(moveOut(root, chain.id)).toBe(root);
  });

  test('unwrapping replaces a group by its children', () => {
    const { a, b, c, d, chain, add, root } = tree();
    expect(ids(unwrap(root, chain.id))).toEqual(['union', [a.id, b.id, c.id, ['add', [d.id]]]]);
    expect(canUnwrap(root, root.id)).toBe(false);
    expect(unwrap(root, root.id)).toBe(root);
    // a root with one child gives it its place
    const single = groupNode('union', [add]);
    expect(unwrap(single, single.id)).toBe(add);
    expect(canUnwrap(root, a.id)).toBe(false);
  });

  test('a method moved out of the default chain and back in at the end gives the same pattern', () => {
    const p = defaultPattern();
    const [neovius, schwarzD] = (p.root as { children: SdfNode[] }).children;
    const wrapped = wrapNode(p.root, neovius.id, 'union').root;
    const out = moveInto(wrapped, schwarzD.id, (wrapped as { children: SdfNode[] }).children[0].id);
    const back = moveOut(out, schwarzD.id);
    const sdf = compilePattern({ ...p, root: back });
    const original = compilePattern(p);
    points.forEach(([x, y, z]) => expect(sdf(x, y, z)).toBeCloseTo(original(x, y, z), 10));
  });
});

describe('the scale a node is evaluated at', () => {
  test('is its static scale outside a chain', () => {
    const leaf = methodNode(DistanceMethodType.SDGyroid, 3);
    const p = pattern({ ...groupNode('union', [leaf]), scale: 2 });
    expect(nodeScaleAt(p, leaf.id)!(5, -7)).toBe(6);
    expect(fromNode(nodeScaleAt(p, leaf.id)!, { x: 12, z: -6 })).toEqual({ x: 2, z: -1 });
  });

  test('inside a chain it is the output of the children after it, as the pattern evaluates it', () => {
    const gyroid = methodNode(DistanceMethodType.SDGyroid, 2);
    const sine = { ...sineNode(0.5, 40, [methodNode(DistanceMethodType.SDGyroid, 0.05)]), gain: 0.2 };
    const inner = groupNode('add', [sine, constantNode(1)]);
    const p = pattern({ ...groupNode('chain', [gyroid, inner]), scale: 1.5 });
    const scaleAt = nodeScaleAt(p, gyroid.id, new Map(), 2)!;
    const sdf = compilePattern(p);
    for (const [x, z] of [
      [0, 0],
      [3, -8],
      [-12.5, 4],
      [20, 17],
    ]) {
      expect(sdf(x, 2, z)).toBeCloseTo(distanceMethods[DistanceMethodType.SDGyroid](x, 2, z, scaleAt(x, z)), 10);
      // and a point of the gyroid is found back on the plane
      const q = { x: x * scaleAt(x, z), z: z * scaleAt(x, z) };
      const found = fromNode(scaleAt, q)!;
      expect(found.x * scaleAt(found.x, found.z)).toBeCloseTo(q.x, 2);
      expect(found.z * scaleAt(found.x, found.z)).toBeCloseTo(q.z, 2);
    }
  });

  test('where the scale is 0, a point of the node is nowhere', () => {
    const gyroid = methodNode(DistanceMethodType.SDGyroid);
    const p = pattern(groupNode('chain', [gyroid, constantNode(0)]));
    expect(fromNode(nodeScaleAt(p, gyroid.id)!, { x: 1, z: 1 })).toBeUndefined();
  });
});
