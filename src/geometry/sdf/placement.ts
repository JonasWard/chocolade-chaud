import type { IBox } from '../field';
import { toPattern } from './evaluate';
import { IPattern, IPlacement, ISvgNode, ITextNode, SdfNode, SvgFields, isGroup, textFieldKey } from './tree';
import { nodeFrame } from './treeOps';

// where an svg shape or a text goes on the bars: against an edge of them, or centred (see IPlacement)

/** the box around what an svg shape or a text draws, in its own plane before it is moved. Undefined while its field is missing */
export const inkBox = (node: ISvgNode | ITextNode, fields: SvgFields): IBox | undefined => {
  if (node.kind === 'text') return fields.get(textFieldKey(node))?.bounds;
  // an svg field is in units of the long side of the shape
  const b = fields.get(node.asset)?.bounds;
  return b && { minX: b.minX * node.width, minZ: b.minZ * node.width, maxX: b.maxX * node.width, maxZ: b.maxZ * node.width };
};

type IPoint = { x: number; z: number };
const ORIGIN: IPoint = { x: 0, z: 0 };

/**
 * Where the placement moves a node to, in its plane: its ink against the edges of the box (in the plane of the node) it is aligned
 * to, the padding away from them, or by the padding where it is centred: from the centre (in the plane of the node too), which is
 * the centre of the pattern unless one is given. Without its ink the node itself goes against the edges
 */
export const placementOffset = (
  { alignX, alignZ, paddingX, paddingZ }: IPlacement,
  box: IBox,
  ink: IBox = { minX: 0, minZ: 0, maxX: 0, maxZ: 0 },
  centre: IPoint = ORIGIN
) => ({
  x: alignX === 'left' ? box.minX + paddingX - ink.minX : alignX === 'right' ? box.maxX - paddingX - ink.maxX : centre.x + paddingX,
  z: alignZ === 'top' ? box.minZ + paddingZ - ink.minZ : alignZ === 'bottom' ? box.maxZ - paddingZ - ink.maxZ : centre.z + paddingZ,
});

/** a place on the bars (in mm on them) in the plane of the node with the id, at its static scale */
export const pointInNode = (pattern: IPattern, point: IPoint, id: string): IPoint => toPattern(pattern, nodeFrame(pattern.root, id)?.scale ?? 1, point);

/** the box around the bars (in mm on them) in the plane of the node with the id, at its static scale */
export const boxInNode = (pattern: IPattern, bars: IBox, id: string): IBox => {
  const scale = nodeFrame(pattern.root, id)?.scale ?? 1;
  const corners = [
    [bars.minX, bars.minZ],
    [bars.maxX, bars.minZ],
    [bars.minX, bars.maxZ],
    [bars.maxX, bars.maxZ],
  ].map(([x, z]) => toPattern(pattern, scale, { x, z }));
  const [xs, zs] = [corners.map((c) => c.x), corners.map((c) => c.z)];
  return { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs) };
};

/**
 * the pattern with every svg shape and text moved to where its placement puts it on the bars, the box around them. A centred one is
 * at the centre of the pattern, or at centre (in mm on the bars) when it is given: the middle of a piece that has a frame of its own
 */
export const placePattern = (pattern: IPattern, bars: IBox, fields: SvgFields = new Map(), centre?: IPoint): IPattern => {
  const place = (node: SdfNode): SdfNode => {
    if (isGroup(node)) return { ...node, children: node.children.map(place) };
    if (node.kind !== 'svg' && node.kind !== 'text') return node;
    const { x, z } = placementOffset(node, boxInNode(pattern, bars, node.id), inkBox(node, fields), centre && pointInNode(pattern, centre, node.id));
    return node.offsetX === x && node.offsetZ === z ? node : { ...node, offsetX: x, offsetZ: z };
  };
  return { ...pattern, root: place(pattern.root) };
};
