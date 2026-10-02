import type { IVector } from '../createMesh';
import type { IDistanceField } from '../field';
import { DistanceMethodType } from '../sdMethods';

// the pattern is a tree of distance functions, see evaluate.ts for what every node computes

export type BooleanKind = 'union' | 'difference' | 'intersection';
export type ArithmeticKind = 'add' | 'subtract';
export type GroupKind = BooleanKind | ArithmeticKind | 'chain';
export type LeafKind = 'method' | 'svg' | 'constant';
export type NodeKind = GroupKind | LeafKind;

interface INodeBase {
  id: string;
  /** multiplies the scale the node is evaluated at, on a logarithmic slider */
  scale: number;
  /** multiplies the output of the node */
  gain: number;
}

export interface IMethodNode extends INodeBase {
  kind: 'method';
  method: DistanceMethodType;
}

/** an svg shape in the xz plane, distances in mm */
export interface ISvgNode extends INodeBase {
  kind: 'svg';
  /** key in IPattern.svgs */
  asset: string;
  /** of the long side of the shape, in mm */
  width: number;
  offsetX: number;
  offsetZ: number;
  /** tiles the shape every repeat mm, 0 is once */
  repeat: number;
}

/** a number, regardless of the scale */
export interface IConstantNode extends INodeBase {
  kind: 'constant';
  value: number;
}

export interface IBooleanNode extends INodeBase {
  kind: BooleanKind;
  /** radius of the smooth blend, 0 is sharp */
  smooth: number;
  children: SdfNode[];
}

export interface IArithmeticNode extends INodeBase {
  kind: ArithmeticKind;
  children: SdfNode[];
}

/** the output of every child is the scale of the one before it, the last child is the innermost */
export interface IChainNode extends INodeBase {
  kind: 'chain';
  children: SdfNode[];
}

export type LeafNode = IMethodNode | ISvgNode | IConstantNode;
export type GroupNode = IBooleanNode | IArithmeticNode | IChainNode;
export type SdfNode = LeafNode | GroupNode;

export interface ISvgAsset {
  name: string;
  source: string;
}

export interface IPattern {
  root: SdfNode;
  center: IVector;
  /** around the vertical axis, in degrees */
  rotation: number;
  svgs: Record<string, ISvgAsset>;
}

/** the distance fields of the svg assets of a pattern, by asset key */
export type SvgFields = ReadonlyMap<string, IDistanceField>;

export const GROUP_KINDS: GroupKind[] = ['union', 'difference', 'intersection', 'add', 'subtract', 'chain'];

export const isGroup = (node: SdfNode): node is GroupNode => 'children' in node;

let idCounter = 0;
export const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `node-${Date.now()}-${idCounter++}`);

const base = (scale = 1) => ({ id: newId(), scale, gain: 1 });

export const methodNode = (method: DistanceMethodType, scale = 1): IMethodNode => ({ ...base(scale), kind: 'method', method });
export const svgNode = (asset: string, width = 30): ISvgNode => ({ ...base(), kind: 'svg', asset, width, offsetX: 0, offsetZ: 0, repeat: 0 });
export const constantNode = (value = 0): IConstantNode => ({ ...base(), kind: 'constant', value });

export const groupNode = (kind: GroupKind, children: SdfNode[] = []): GroupNode => {
  switch (kind) {
    case 'union':
    case 'difference':
    case 'intersection':
      return { ...base(), kind, smooth: 0, children };
    case 'add':
    case 'subtract':
    case 'chain':
      return { ...base(), kind, children };
  }
};

const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 4l13.5 30.5 33 3.5-24.8 22.2 7 32.6L50 76.2 21.3 92.8l7-32.6L3.5 38l33-3.5z"/></svg>`;

export const defaultPattern = (): IPattern => ({
  // the same as the old method chain of neovius 0.004 and schwarz d 8.5
  root: groupNode('chain', [methodNode(DistanceMethodType.SDNeovius), methodNode(DistanceMethodType.SDSchwarzD, 0.004 * 8.5)]),
  center: { x: 0, y: 0, z: 0 },
  rotation: 0,
  svgs: { star: { name: 'star', source: STAR_SVG } },
});
