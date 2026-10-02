import { DefaultGridSettings, GridType, IEditableGrid, ISimpleGrid, ISingleGrid } from '../geometry/grid';
import { DistanceMethodType } from '../geometry/sdMethods';
import { IBooleanNode, IPattern, SdfNode, constantNode, defaultPattern, groupNode, isGroup, methodNode, sineNode, svgKey, svgNode, textNode } from '../geometry/sdf/tree';
import { decodeState, encodeState } from './schema';

const single = () => DefaultGridSettings(GridType.Single) as ISingleGrid;

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
  expect(decodeState(encoded, library)?.amplitude).toBe(0.2);
});

test('a tree with every kind of node survives a round trip', () => {
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>';
  const star = Object.keys(library)[0];
  const root = groupNode('union', [
    groupNode('chain', [methodNode(DistanceMethodType.SDGyroid, 0.3), { ...svgNode(svgKey(logo), 25), offsetX: -4.5, repeat: 40 }]),
    { ...(groupNode('difference', [sineNode(2.5, 17), constantNode(-0.75)]) as IBooleanNode), smooth: 1.5 },
    { ...groupNode('intersection', [svgNode(star)]), gain: -2 },
    groupNode('add', [methodNode(DistanceMethodType.SDTorus, 1e-3)]),
    groupNode('subtract', [
      { ...textNode('Ça ¡chaud! 🍫'), font: 'Playfair Display', fontSource: 'google', bold: false, size: 9.5, offsetX: -3, angle: 30, inside: 'constant', depth: 1.25, bevel: 0, cutoff: 3.5 },
      {
        ...textNode('on a curve'),
        curve: { mode: 'spline', points: [{ x: -20, z: 0 }, { x: -10, z: -8.25 }, { x: 10, z: 8 }, { x: 20, z: 0.5 }] },
      },
    ]),
  ]);
  const pattern: IPattern = { root, center: { x: 1.5, y: -2, z: 30 }, rotation: 45, svgs: { ...library, [svgKey(logo)]: { name: 'logo', source: logo } } };
  const grid: IEditableGrid = { ...single(), cellWidth: 123.45, amplitude: -0.35, displayWireframe: true, color: '#12abef', sdfSetting: pattern };

  const withLogo = { ...library, [svgKey(logo)]: { name: 'logo', source: logo } };
  const decoded = decodeState(encodeState(grid), withLogo);
  expectClose(decoded, grid);

  // without the logo in the library, the node keeps its key but the asset is missing
  const missing = decodeState(encodeState(grid), library) as ISingleGrid;
  expect(Object.keys(missing.sdfSetting.svgs)).toEqual(Object.keys(library));
  const chain = (missing.sdfSetting.root as { children: SdfNode[] }).children[0] as { children: SdfNode[] };
  expect(chain.children[1]).toMatchObject({ kind: 'svg', asset: svgKey(logo) });
});

test('a grid keeps its colours, out of range values are clamped', () => {
  const grid: ISimpleGrid = { ...(DefaultGridSettings(GridType.Simple) as ISimpleGrid), uCount: 3, colors: ['#000000', '#ffffff', '#a73a08'], cellWidth: 1e6 };
  const decoded = decodeState(encodeState(grid), library) as ISimpleGrid;
  expect(decoded.colors).toEqual(grid.colors);
  expect(decoded.uCount).toBe(3);
  expect(decoded.cellWidth).toBe(400);
});

test('a state of version 4 still opens, its profiles without rounding', () => {
  // a union of a text "ab" (constant inside, depth 1.5, bevel 0.5, cutoff 2) and the star svg (cutoff 1), encoded by version 4
  const v4 = 'BB5GBtYAD6ElxO6BdwU50EMNQMNQMNQIygBX7JiYlTiGKiAAARJxDFRAEAMIAxCgBzAGEAbgBzAC0AcwBlAHIAaQBmQj8AGGoGGoHCFPTAGQAyBTiGKiAAZCcQTiAAATugBkAGQ';
  const decoded = decodeState(v4, library);
  const root = decoded?.sdfSetting.root;
  expect(root?.kind).toBe('union');
  const [text, svg] = root && isGroup(root) ? root.children : [];
  expect(text).toMatchObject({ kind: 'text', text: 'ab', inside: 'constant', depth: 1.5, bevel: 0.5, cutoff: 2, round: 0 });
  expect(svg).toMatchObject({ kind: 'svg', width: 20, cutoff: 1, round: 0 });
});

test('anything else is not a state', () => {
  expect(decodeState('', library)).toBeUndefined();
  expect(decodeState('!!!', library)).toBeUndefined();
  // a state of another version
  expect(decodeState('_' + encodeState(single()).slice(1), library)).toBeUndefined();
});
