import { defaultBar } from '../../../src/geometry/grid';
import { decodeState, encodeState } from '../../../src/state/schema';
import { compilePattern } from '../../../src/geometry/sdf/evaluate';
import { PRESETS } from '../../../src/geometry/sdf/presets';
import { SdfNode, defaultPattern, isGroup } from '../../../src/geometry/sdf/tree';

const svgAssets = (n: SdfNode): string[] => (n.kind === 'svg' ? [n.asset] : isGroup(n) ? n.children.flatMap(svgAssets) : []);

test.each(PRESETS.map((p) => [p.name, p] as const))('the preset %s has its svgs, fits in a link and evaluates', (_, preset) => {
  const { root, svgs } = preset.make();
  svgAssets(root).forEach((asset) => expect(svgs[asset]).toBeDefined());
  const pattern = { ...defaultPattern(), root, svgs: { ...defaultPattern().svgs, ...svgs } };
  const grid = { ...defaultBar(), sdfSetting: pattern };
  expect(decodeState(encodeState(grid), pattern.svgs)!.sdfSetting.root.kind).toBe(root.kind);
  expect(Number.isFinite(compilePattern(pattern)(3, 10, -2))).toBe(true);
});

test('every preset is a new tree', () => {
  expect(PRESETS[0].make().root.id).not.toBe(PRESETS[0].make().root.id);
});
