import { DistanceMethodType } from '../sdMethods';
import { IPattern, STAR_SVG, SdfNode, constantNode, groupNode, methodNode, sineNode, svgKey, svgNode, textNode } from './tree';

// patterns to start from, picked in simple mode. Their output is how far the top moves, in mm

export interface IPreset {
  name: string;
  /** the tree of the pattern, and the svgs it uses */
  make: () => Pick<IPattern, 'root' | 'svgs'>;
}

const STAR = svgKey(STAR_SVG);
// a tree of new nodes every time
const plain = (root: () => SdfNode) => () => ({ root: root(), svgs: {} });

export const PRESETS: IPreset[] = [
  {
    name: 'Ripples',
    make: plain(() => ({ ...groupNode('chain', [methodNode(DistanceMethodType.SDNeovius), methodNode(DistanceMethodType.SDSchwarzD, 0.004 * 8.5)]), gain: 0.2 })),
  },
  { name: 'Gyroid', make: plain(() => ({ ...methodNode(DistanceMethodType.SDGyroid, 0.35), gain: 0.6 })) },
  { name: 'Dimples', make: plain(() => ({ ...methodNode(DistanceMethodType.SDSchwarzP, 0.45), gain: 0.6 })) },
  // ripples around the outline of the letters, the letters themselves flat
  {
    name: 'Echo',
    make: plain(() =>
      groupNode('union', [
        sineNode(0.3, 3, [{ ...textNode('Chaud'), size: 18, outer: 30 }]),
        { ...textNode('Chaud'), size: 18, inner: 0.6, outer: 0.6, beveled: true, innerBevel: 0.4, outerBevel: 0.6 },
      ])
    ),
  },
  {
    name: 'Name on a gyroid',
    make: plain(() =>
      groupNode('union', [
        { ...methodNode(DistanceMethodType.SDGyroid, 0.35), gain: 0.3 },
        { ...textNode('Chaud'), size: 18, inner: 0.6, outer: 0.6, beveled: true, innerBevel: 0.8, outerBevel: 3 },
      ])
    ),
  },
  // a spiral winding out of the points of a star, the star itself flat
  {
    name: 'Spiral',
    make: () => ({
      root: groupNode('union', [
        { ...sineNode(0.3, 4, [svgNode(STAR, 30)]), layout: 'spiral', detail: 0.8 },
        { ...svgNode(STAR, 30), inner: 0.6, outer: 0.6, beveled: true, innerBevel: 0.4, outerBevel: 0.6 },
      ]),
      svgs: { [STAR]: { name: 'star', source: STAR_SVG } },
    }),
  },
  {
    name: 'Stars',
    make: () => ({
      root: groupNode('union', [constantNode(0.5), { ...svgNode(STAR, 12), repeat: 20, inner: 0.5, outer: 0.5, beveled: true, innerBevel: 0.6, outerBevel: 2.5 }]),
      svgs: { [STAR]: { name: 'star', source: STAR_SVG } },
    }),
  },
];
