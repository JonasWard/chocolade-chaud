import { BarKind, IBar, defaultBar, piecePattern, withPiecePattern } from '../../src/geometry/grid';
import { DEFAULT_REPEAT, IRepeat, differs } from '../../src/geometry/pieces';
import { insertChild, updateNode } from '../../src/geometry/sdf/treeOps';
import { DistanceMethodType } from '../../src/geometry/sdMethods';
import { IBooleanNode, IPattern, IProfile, SdfNode, constantNode, defaultPattern, groupNode, methodNode, sineNode, svgKey, svgNode, textNode } from '../../src/geometry/sdf/tree';
import { STATE_VERSION, decodeState, encodeState, numberField, schemaFingerprint } from '../../src/state/schema';
import { profile } from '../../src/geometry/sdf/evaluate';
import { ChocolateType } from '../../src/geometry/chocolates';
import { DEFAULT_PIECES, TABLET_LAYOUTS } from '../../src/geometry/tablets';

const single = defaultBar;

// the same up to the precision of the fields, ids are new
const expectClose = (actual: unknown, expected: unknown, path = ''): void => {
  // colours come back in lower case
  if (typeof expected === 'string' && /^#[0-9a-f]{6}$/i.test(expected)) return expect([path, actual]).toEqual([path, expected.toLowerCase()]);
  if (typeof expected === 'number') return expect([path, actual]).toEqual([path, expect.closeTo(expected, 2)]);
  if (expected && typeof expected === 'object') {
    Object.entries(expected).forEach(([k, v]) => k !== 'id' && expectClose((actual as Record<string, unknown>)[k], v, `${path}.${k}`));
    return;
  }
  expect([path, actual]).toEqual([path, expected]);
};

const library = defaultPattern().svgs;

test('the default state survives a round trip and is short', () => {
  const grid = single();
  const encoded = encodeState(grid);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(encoded.length).toBeLessThanOrEqual(64);
  expectClose(decodeState(encoded, library), grid);
  // the numbers come back as they were typed, without the noise of their steps
  expect(decodeState(encoded, library)?.sdfSetting.root.gain).toBe(0.2);
});

test('a tree with every kind of node survives a round trip', () => {
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
  const star = Object.keys(library)[0];
  const root = groupNode('union', [
    groupNode('chain', [methodNode(DistanceMethodType.SDGyroid, 0.3), { ...svgNode(svgKey(logo), 25), alignX: 'left', paddingX: 4.5, repeat: 40 }]),
    { ...(groupNode('difference', [sineNode(2.5, 17, [methodNode(DistanceMethodType.SDSphere, 0.5)]), constantNode(-0.75)]) as IBooleanNode), smooth: 1.5 },
    { ...sineNode(-0.4, 3.25, [constantNode(1)]), wave: 'sawtooth', layout: 'weave', count: 12, twist: -7.5, around: 'outline', detail: 0.45 },
    { ...groupNode('intersection', [svgNode(star)]), gain: -2 },
    groupNode('add', [methodNode(DistanceMethodType.SDTorus, 1e-3)]),
    groupNode('subtract', [
      { ...textNode('Ça ¡chaud! 🍫'), font: 'Playfair Display', fontSource: 'google', bold: false, size: 9.5, alignZ: 'bottom', paddingX: -3, paddingZ: 2, angle: 30, inner: 1.25, outer: 3.5, beveled: true, innerBevel: 0, outerBevel: 2 },
      {
        ...textNode('on a curve'),
        curve: { mode: 'spline', points: [{ x: -20, z: 0 }, { x: -10, z: -8.25 }, { x: 10, z: 8 }, { x: 20, z: 0.5 }] },
      },
      { ...textNode('on a smooth curve'), curve: { mode: 'smooth', points: [{ x: -20, z: 0 }, { x: 0, z: 5 }, { x: 20, z: 0 }] } },
    ]),
  ]);
  const pattern: IPattern = { root, center: { x: 1.5, y: -2, z: 30 }, rotation: 45, svgs: { ...library, [svgKey(logo)]: { name: 'logo', source: logo } } };
  const grid: IBar = { ...single(), kind: BarKind.Custom, width: 123.45, length: 32.5, displayWireframe: true, chocolates: [ChocolateType.Ruby], sdfSetting: pattern };

  const withLogo = { ...library, [svgKey(logo)]: { name: 'logo', source: logo } };
  const decoded = decodeState(encodeState(grid), withLogo);
  expectClose(decoded, grid);

  // without the logo in the library, the node keeps its key but the asset is missing
  const missing = decodeState(encodeState(grid), library)!;
  expect(Object.keys(missing.sdfSetting.svgs)).toEqual(Object.keys(library));
  const chain = (missing.sdfSetting.root as { children: SdfNode[] }).children[0] as { children: SdfNode[] };
  expect(chain.children[1]).toMatchObject({ kind: 'svg', asset: svgKey(logo) });
});

test('a combined tablet keeps its layout and the chocolate of every piece, out of range values are clamped', () => {
  const pieces = TABLET_LAYOUTS[7];
  const chocolates = pieces.map((_, i) => [ChocolateType.Dark85, ChocolateType.White, ChocolateType.Matcha][i % 3]);
  const grid: IBar = { ...single(), kind: BarKind.Combined, pieces, chocolates, sameChocolate: false, width: 1e6 };
  const decoded = decodeState(encodeState(grid), library)!;
  expect(decoded).toMatchObject({ kind: BarKind.Combined, pieces, chocolates, sameChocolate: false, width: 400 });
  // the same chocolate for every piece only keeps the first
  expect(decodeState(encodeState({ ...grid, sameChocolate: true }), library)).toMatchObject({ chocolates: [ChocolateType.Dark85], sameChocolate: true });
  // pieces that don't fill the tablet are the default layout
  expect(decodeState(encodeState({ ...grid, pieces: pieces.slice(1) }), library)?.pieces).toEqual(DEFAULT_PIECES);
});

describe('the pieces of a combined tablet', () => {
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
  const withLogo = { ...library, [svgKey(logo)]: { name: 'logo', source: logo } };
  const text = { ...textNode('all'), size: 6 };
  const inner = groupNode('add', [text, constantNode(1)]);
  const root = groupNode('union', [methodNode(DistanceMethodType.SDGyroid, 0.3), inner, svgNode(Object.keys(library)[0])]);
  const repeat: IRepeat = { anchorX: 'left', anchorZ: 'bottom', fit: 'inside', reference: 'custom', referenceWidth: 80.5, referenceLength: 30 };
  const base: IBar = { ...single(), kind: BarKind.Combined, sdfSetting: { ...defaultPattern(), root }, repeat };

  test('one design is not written, a repeat is with where the pattern is on a piece', () => {
    expect(decodeState(encodeState(base), library)).toMatchObject({ pieceMode: 'one', repeat: DEFAULT_REPEAT, overrides: [] });
    // one bit more than a single tablet with the pattern
    expect(encodeState(base).length).toBeLessThanOrEqual(encodeState({ ...base, pieceMode: 'repeat' }).length - 5);
    expect(decodeState(encodeState({ ...base, pieceMode: 'repeat' }), library)).toMatchObject({ pieceMode: 'repeat', repeat, overrides: [] });
  });

  test('a unique tablet keeps what differs on every piece: settings of a node, the centre and the rotation, a group of its own', () => {
    let unique: IBar = { ...base, pieceMode: 'unique' };
    unique = withPiecePattern(unique, 1, {
      ...piecePattern(unique, 1),
      rotation: 30,
      center: { x: 1.5, y: 0, z: -2 },
      root: updateNode(root, text.id, (n) => ({ ...n, text: 'Jonas', bold: false }) as SdfNode),
    });
    // with an svg shape only this piece has
    unique = withPiecePattern(unique, 3, { ...piecePattern(unique, 3), root: insertChild(root, inner.id, svgNode(svgKey(logo), 9)) });

    const decoded = decodeState(encodeState(unique), withLogo)!;
    expect(decoded).toMatchObject({ pieceMode: 'unique', repeat });
    expect(decoded.overrides.map((o) => differs(o))).toEqual([false, true, false, true]);
    unique.pieces.forEach((_, i) => expectClose(piecePattern(decoded, i), piecePattern(unique, i)));
    expectClose(decoded.sdfSetting, unique.sdfSetting);

    const [named, own] = [decoded.overrides[1]!, decoded.overrides[3]!];
    expect(named).toMatchObject({ rotation: 30, center: { x: 1.5, y: 0, z: -2 } });
    expect(Object.values(named.nodes)).toEqual([{ values: { text: 'Jonas', bold: false } }]);
    // by the node of the shared tree as it is read now
    const [, add] = (decoded.sdfSetting.root as { children: SdfNode[] }).children;
    expect(Object.keys(own.nodes)).toEqual([add.id]);
    expect(own.nodes[add.id]).toMatchObject({ own: { kind: 'add', id: add.id, children: [{ text: 'all' }, { value: 1 }, { kind: 'svg', asset: svgKey(logo), width: 9 }] } });
    // and it is written the same again
    expect(encodeState(decoded)).toBe(encodeState(unique));
    // what differs is only read by a unique tablet
    expect(decodeState(encodeState({ ...unique, pieceMode: 'repeat' }), withLogo)?.overrides).toEqual([]);
  });

  test('six pieces with a name each are a short link', () => {
    const pieces = TABLET_LAYOUTS.find((layout) => layout.length === 6)!;
    const names = ['Ada', 'Jonas', 'Marie', 'Linus', 'Grace', 'Alan'];
    const bar = names.reduce<IBar>(
      (b, name, i) => withPiecePattern(b, i, { ...b.sdfSetting, root: updateNode(root, text.id, (n) => ({ ...n, text: name }) as SdfNode) }),
      { ...base, pieces, pieceMode: 'unique' }
    );
    const encoded = encodeState(bar);
    expect(encoded.length).toBeLessThan(600);
    const decoded = decodeState(encoded, library)!;
    expect(pieces.map((_, i) => ((piecePattern(decoded, i).root as { children: SdfNode[] }).children[1] as { children: SdfNode[] }).children[0])).toMatchObject(names.map((name) => ({ text: name })));
  });
});

test('anything else is not a state', () => {
  expect(decodeState('', library)).toBeUndefined();
  expect(decodeState('!!!', library)).toBeUndefined();
  // a state of another version
  expect(decodeState('_' + encodeState(single()).slice(1), library)).toBeUndefined();
});

// written by version 4: a union of a gyroid, the text 'flat' with a plateau 1.25 deep, a bevel of 0.5 and a cutoff of 3.5, the text 'step'
// with a plateau 2 deep without a bevel, the star with a cutoff of 2 and the text 'curve' on a spline
const V4 =
  'BB5GBtYAD6ElxO6BdwU50EMNQMNQMNQIygBX7JiYlTiGKiAAAoIvrFRAJOIYqIBABmAGwAYQB0FADmAMIA3ADmAFoA5gDKAOQA0gDMhH4AMK6MQYPPKeNAMgCvEnEMVEAgA5gDoAMoA4CgBzAGEAbgBzAC0AcwBlAHIAaQBmQj8AGGoGGoHCFPsAAAAABTiGKiAAZCcQTiAAATugBkAMgk4hiogFAGMAdQByAHYAZRQA5gDCANwA5gBaAOYAygDkANIAzIR-gi_aDDUDBXDBwDFRDE4DHODDUDDUDDUDhAndADIAAA';

test('a state of version 4 still reads, its profiles shaped the same', () => {
  const grid = decodeState(V4, library)!;
  const [gyroid, flat, step, star, curve] = (grid.sdfSetting.root as { children: SdfNode[] }).children;
  expect(gyroid).toMatchObject({ kind: 'method', method: DistanceMethodType.SDGyroid });
  expect(flat).toMatchObject({ kind: 'text', text: 'flat', alignX: 'center', alignZ: 'middle', paddingX: -3, paddingZ: 4, angle: 30, inner: 1.25, outer: 3.5, beveled: true, innerBevel: 0.5, outerBevel: 3.5 });
  expect(step).toMatchObject({ text: 'step', inner: 2, outer: 0, beveled: true, innerBevel: 0 });
  expect(star).toMatchObject({ kind: 'svg', width: 20, inner: 0, outer: 2, beveled: false });
  expect(curve).toMatchObject({ text: 'curve', curve: { mode: 'spline' }, inner: 0, outer: 0, beveled: false });
  // the plateau of the old profile: -depth * min(-d / bevel, 1) inside, min(d, cutoff) outside
  const old = (d: number) => (d >= 0 ? Math.min(d, 3.5) : -1.25 * Math.min(-d / 0.5, 1));
  for (const d of [-3, -0.4, -0.1, 0, 0.2, 2, 9]) expect(profile(d, flat as IProfile)).toBeCloseTo(old(d), 12);
  // and it is written as the current version
  expectClose(decodeState(encodeState(grid), library), grid);
});

// written by version 5: the text 'flat' with limits and bevels, the text 'curve' on a spline
const V5 =
  'BR5GBtYAD6ElxO6BdwU50EMNQMNQMNQIygBX7JiYlTiGKiAAARJxDFRAIAMwA2ADCAOgoAcwBhAG4AcwAtAHMAZQByAGkAZkI_ABhqBhqBwgAH0Ar0AGQAyCTiGKiAUAYwB1AHIAdgBlFADmAMIA3ADmAFoA5gDKAOQA0gDMhH6CL9oMNQMFcMHAMVEMTgMc4MNQMNQMNQOEAAAAAAAAAAAA';

test('a state of version 5 still reads', () => {
  const grid = decodeState(V5, library)!;
  const [flat, curve] = (grid.sdfSetting.root as { children: SdfNode[] }).children;
  expect(flat).toMatchObject({ kind: 'text', text: 'flat', inner: 1.25, outer: 3.5, beveled: true, innerBevel: 0.5, outerBevel: 2 });
  expect(curve).toMatchObject({ text: 'curve', curve: { mode: 'spline', points: [{ x: -20, z: 0 }, { x: -10, z: -8 }, { x: 10, z: 8 }, { x: 20, z: 0 }] } });
});

// written by version 6: the text 'moved' at an offset of (-12.5, 6), the text 'curve' on a smooth curve with an offset it ignored,
// the star at an offset of (4.5, -3)
const V6 =
  'Bh5GBtYAD6ElxO6BdwU50EMNQMNQMNQIygBX7JiYlTiGKiAAAZJxDFRAKANoA3gDsAMoAyCgBzAGEAbgBzAC0AcwBlAHIAaQBmQj8AGBvmI-HCAAAAAAAAAAAAJOIYqIBQBjAHUAcgB2AGUUAOYAwgDcAOYAWgDmAMoA5ADSAMyEfsGv2gw1Aw1AxEoxzgw1AySwwlY4QAAAAAAAAAAAApxDFRAAMhOepvIAAAAAAAAAAAAAA';

test('a state of version 6 keeps where its texts and svgs were', () => {
  const grid = decodeState(V6, library)!;
  const [moved, curve, star] = (grid.sdfSetting.root as { children: SdfNode[] }).children;
  expect(moved).toMatchObject({ text: 'moved', alignX: 'center', alignZ: 'middle', paddingX: -12.5, paddingZ: 6 });
  expect(curve).toMatchObject({ text: 'curve', alignX: 'center', alignZ: 'middle', paddingX: 0, paddingZ: 0, curve: { mode: 'smooth' } });
  expect(star).toMatchObject({ kind: 'svg', alignX: 'center', alignZ: 'middle', paddingX: 4.5, paddingZ: -3 });
});

// written by version 7: a single bar of 120 by 45 mm with an inset of -2.5, an amplitude of 0.35 and the colour #f2e6d0, a union of a
// gyroid, a sine curve and a constant with a gain of 2
const V7_SINGLE = 'BxZ2B9AAD6Eo5PfhdweXNoMNQMNQMNQIygBX7JiYlTiGOcAAAYI4DFRANOIYqIUBQGpHniJxDFRD034';
// a grid of 3 by 2 bars of 40 by 30 mm, coloured #3b1f12 and #ffffff
const V7_GRID = 'B4bWBOIQj6ElxO6BdwnY-Jf___sNQMNQMNQIygBX7JiYqTiGKiBAnEMVEMDctiohA';

test('a bar of version 7 is a custom bar with its top where it was, the amplitude in the gain of its pattern', () => {
  const bar = decodeState(V7_SINGLE, library)!;
  expect(bar).toMatchObject({ kind: BarKind.Custom, width: 125, length: 50, inset: -2.5, chocolates: [ChocolateType.White], sameChocolate: true });
  const root = bar.sdfSetting.root as { gain: number; children: SdfNode[] };
  expect(root.gain).toBeCloseTo(0.7, 10);
  // a sine curve has no equivalent, it is a sine of nothing
  expect(root.children.map((c) => c.kind)).toEqual(['method', 'sine', 'constant']);
  expect(root.children[1]).toMatchObject({ amplitude: 2.5, period: 17, children: [] });

  // one bar of a grid
  const grid = decodeState(V7_GRID, library)!;
  expect(grid).toMatchObject({ kind: BarKind.Custom, width: 46, length: 36, chocolates: [ChocolateType.Dark85] });
  expect(grid.sdfSetting.root.gain).toBeCloseTo(0.2, 10);
  expectClose(decodeState(encodeState(grid), library), grid);
});

// written by version 8: a combined tablet of milk and white pieces, 20 mm high, wireframe on, a union with a gain of 50 of a gyroid, a
// sine of the text 'v8' padded 600 mm and a constant
const V8 = 'CHNCGRk8jA2sPoJYAu800zDUDDUDDUCSfAV-yYmJU4iSfAAAGCOAxUQDTiGKiE6EAZAJJxDFRAEAOwAcCgBzAGEAbgBzAC0AcwBlAHIAaQBmQj8AAnEAYagcIAAAAAAAAAAABE4hioh6b8A';

test('a state of version 8 still reads, its numbers clamped into the ranges of the settings', () => {
  const bar = decodeState(V8, library)!;
  expect(bar).toMatchObject({ kind: BarKind.Combined, pieces: TABLET_LAYOUTS[3], sameChocolate: false, displayWireframe: true, inset: -2, height: 10 });
  expect(bar.chocolates).toEqual(TABLET_LAYOUTS[3].map((_, i) => (i % 2 ? ChocolateType.White : ChocolateType.Milk)));
  expect(bar.sdfSetting.rotation).toBe(15);
  const root = bar.sdfSetting.root as { gain: number; children: SdfNode[] };
  expect(root.gain).toBe(20);
  expect((root.children[1] as { children: SdfNode[] }).children[0]).toMatchObject({ kind: 'text', text: 'v8', paddingX: 400 });
  expectClose(decodeState(encodeState(bar), library), bar);
});

// written by version 9: the default tablet with its wireframe on, an add with a gain of 2 of a sine of the text 'v9' and a constant
const V9 = 'CTOBhGU8jA2su5Xgu8DTiAnEBOICMoAV-yYmKE4hV8BGnEKQROINSBJOIUggCAHYAORQA5gDCANwA5gBaAOYAygDkANIAzIVGAAJxATiA4QAAAAAAAAAicQpBDB2Q';

test('a state of version 9 still reads, its sine a plain sine along the distance', () => {
  const bar = decodeState(V9, library)!;
  expect(bar).toMatchObject({ kind: BarKind.Tablet, displayWireframe: true, pieceMode: 'one', overrides: [] });
  const root = bar.sdfSetting.root as { gain: number; children: SdfNode[] };
  expect(root).toMatchObject({ kind: 'add', gain: 2 });
  expect(root.children[0]).toMatchObject({ kind: 'sine', amplitude: 2.5, period: 17, wave: 'sine', layout: 'rings', count: 5, twist: 0, around: 'centre', detail: 0 });
  expect((root.children[0] as { children: SdfNode[] }).children[0]).toMatchObject({ kind: 'text', text: 'v9', size: 14 });
  expect(root.children[1]).toMatchObject({ kind: 'constant', value: -0.75 });
  expectClose(decodeState(encodeState(bar), library), bar);
});

// written by version 10: the default tablet with a union of a spiral of 5 around the star, fading below 0.8 mm, and the star with limits
const V10 = 'CjOBhGU8jA2su5Xgu4DTiAnEBOICMoAV-yYmJU4hSCAACNOIUgiAwGQEjhAUAinEKQQASwE4gJxAAAAAAAAAAAAKcQpBABLATiAnEAAAB4A8gKAHg';

test('a state of version 10 still reads, its tablet one design', () => {
  const bar = decodeState(V10, library)!;
  expect(bar).toMatchObject({ kind: BarKind.Tablet, pieceMode: 'one', repeat: DEFAULT_REPEAT, overrides: [] });
  const [spiral, star] = (bar.sdfSetting.root as { children: SdfNode[] }).children;
  expect(spiral).toMatchObject({ kind: 'sine', amplitude: 0.3, period: 4, wave: 'sine', layout: 'spiral', count: 5, around: 'centre', detail: 0.8, children: [{ kind: 'svg', width: 30 }] });
  expect(star).toMatchObject({ kind: 'svg', inner: 0.6, outer: 0.6, beveled: true });
  expectClose(decodeState(encodeState(bar), library), bar);
});

// how every version is written: a version that is out can never change, a change of the current one needs a new version
const FINGERPRINTS: Record<number, string> = {
  4: '119400cc',
  5: '77cb243c',
  6: '33368f48',
  7: '5e339f22',
  8: '19cb9349',
  9: 'eaad37f7',
  10: '097e2c58',
  11: '86ab083b',
};

test('the schema of every version is as it was written', () => {
  expect(Math.max(...Object.keys(FINGERPRINTS).map(Number))).toBe(STATE_VERSION);
  Object.entries(FINGERPRINTS).forEach(([version, fingerprint]) => expect([version, schemaFingerprint(Number(version))]).toEqual([version, fingerprint]));
});

test('the default bar is written as it was by densing 0.3, but for its version and for the pieces it does not have', () => {
  expect(encodeState(defaultBar())).toBe('CzOBhGU8jA2su5Xgu4DJxATiAnEBGUAK_ZMTFScQndAgTiFIIYG5akEI');
});

test('a number of the state is found by its path, with its range', () => {
  expect(numberField('height')).toMatchObject({ type: 'fixed', min: 2.5, max: 10 });
  expect(numberField('center.x')).toMatchObject({ min: -400, max: 400 });
  // a field of a node, in the union that is the root: densing 0.4 looks into it
  expect(numberField('root.gain')).toMatchObject({ min: -20, max: 20 });
  expect(numberField('root.size')).toMatchObject({ min: 0.5, max: 200 });
  // a whole number
  expect(numberField('root.count')).toMatchObject({ min: 1, max: 24, precision: 1 });
  // a field of what is only there for the pieces of a combined tablet
  expect(numberField('repeat.frames.referenceWidth')).toMatchObject({ min: 5, max: 400 });
  expect(numberField('root.points[].point.x')).toMatchObject({ min: -400, max: 400 });
  expect(() => numberField('hieght')).toThrow();
  // not a number
  expect(() => numberField('sameChocolate')).toThrow();
});
