import { DistanceMethodType } from '../sdMethods';
import { IPattern, STAR_SVG, SdfNode, constantNode, groupNode, methodNode, sineNode, svgKey, svgNode, textNode } from './tree';

// patterns to start from, picked in simple mode

export interface IPreset {
  name: string;
  /** the tree of the pattern, and the svgs it uses */
  make: () => Pick<IPattern, 'root' | 'svgs'>;
}

const STAR = svgKey(STAR_SVG);
// a tree of new nodes every time
const plain = (root: () => SdfNode) => () => ({ root: root(), svgs: {} });

export const PRESETS: IPreset[] = [
  { name: 'Ripples', make: plain(() => groupNode('chain', [methodNode(DistanceMethodType.SDNeovius), methodNode(DistanceMethodType.SDSchwarzD, 0.004 * 8.5)])) },
  { name: 'Gyroid', make: plain(() => ({ ...methodNode(DistanceMethodType.SDGyroid, 0.35), gain: 3 })) },
  { name: 'Dimples', make: plain(() => ({ ...methodNode(DistanceMethodType.SDSchwarzP, 0.45), gain: 3 })) },
  { name: 'Waves', make: plain(() => groupNode('union', [{ ...sineNode(6, 40), gain: 1 }, constantNode(3)])) },
  {
    name: 'Name on a gyroid',
    make: plain(() =>
      groupNode('union', [
        { ...methodNode(DistanceMethodType.SDGyroid, 0.35), gain: 1.5 },
        { ...textNode('Chaud'), size: 18, inner: 3, outer: 3, beveled: true, innerBevel: 0.8, outerBevel: 3 },
      ])
    ),
  },
  {
    name: 'Stars',
    make: () => ({
      root: groupNode('union', [constantNode(2.5), { ...svgNode(STAR, 12), repeat: 20, inner: 2.5, outer: 2.5, beveled: true, innerBevel: 0.6, outerBevel: 2.5 }]),
      svgs: { [STAR]: { name: 'star', source: STAR_SVG } },
    }),
  },
];
