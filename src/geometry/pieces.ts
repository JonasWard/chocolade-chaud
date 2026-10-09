import type { IVector } from './createMesh';
import type { IBox } from './field';
import { AlignX, AlignZ, IPattern, SdfNode, isGroup, newId } from './sdf/tree';

// the pattern on the pieces of a combined tablet: one design across all of them, the same repeated on every piece, or unique, a
// repeat with what differs on a piece. A frame is the pattern as a piece sees it: around a centre of its own, scaled to fit it.
// What differs on a piece is an override, the difference of its pattern with the shared one, so the editors only ever see a pattern

export const PIECE_MODES = ['one', 'repeat', 'unique'] as const;
export type PieceMode = (typeof PIECE_MODES)[number];

/** how the pattern is scaled on a piece: as it is, or by the size of the piece over the size of the reference */
export const FITS = ['same', 'inside', 'fill', 'width', 'length'] as const;
export type Fit = (typeof FITS)[number];

/** what the pattern is 1 to 1 on: the largest piece, the box around all of them, or a size in mm */
export const REFERENCES = ['largest', 'tablet', 'custom'] as const;
export type Reference = (typeof REFERENCES)[number];

export interface IRepeat {
  /** the place on every piece the centre of the pattern is at */
  anchorX: AlignX;
  anchorZ: AlignZ;
  fit: Fit;
  reference: Reference;
  /** of a custom reference, in mm */
  referenceWidth: number;
  referenceLength: number;
}

export const DEFAULT_REPEAT: IRepeat = { anchorX: 'center', anchorZ: 'middle', fit: 'same', reference: 'largest', referenceWidth: 100, referenceLength: 35 };

export interface ISize {
  width: number;
  length: number;
}

const sizeOf = ({ minX, minZ, maxX, maxZ }: IBox): ISize => ({ width: maxX - minX, length: maxZ - minZ });

/** the size the pattern is 1 to 1 on, tops are the tops of the pieces */
export const referenceSize = (tops: IBox[], { reference, referenceWidth, referenceLength }: IRepeat): ISize => {
  if (reference === 'custom' || tops.length === 0) return { width: referenceWidth, length: referenceLength };
  const sizes = tops.map(sizeOf);
  if (reference === 'largest') return sizes.reduce((a, b) => (b.width * b.length > a.width * a.length ? b : a));
  const [xs, zs] = [tops.flatMap((t) => [t.minX, t.maxX]), tops.flatMap((t) => [t.minZ, t.maxZ])];
  return { width: Math.max(...xs) - Math.min(...xs), length: Math.max(...zs) - Math.min(...zs) };
};

/** how much smaller (or larger) the pattern is on a piece than on the reference */
export const fitFactor = (top: IBox, reference: ISize, fit: Fit): number => {
  const { width, length } = sizeOf(top);
  const [w, l] = [width / reference.width, length / reference.length];
  const k = fit === 'same' ? 1 : fit === 'width' ? w : fit === 'length' ? l : fit === 'inside' ? Math.min(w, l) : Math.max(w, l);
  return Number.isFinite(k) && k > 0 ? k : 1;
};

const middle = ({ minX, minZ, maxX, maxZ }: IBox) => ({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 });

/** the place on a box an anchor names */
export const anchorOf = (box: IBox, anchorX: AlignX, anchorZ: AlignZ): { x: number; z: number } => ({
  x: anchorX === 'left' ? box.minX : anchorX === 'right' ? box.maxX : middle(box).x,
  z: anchorZ === 'top' ? box.minZ : anchorZ === 'bottom' ? box.maxZ : middle(box).z,
});

/**
 * the pattern as a bar sees it, the box its svg shapes and texts are placed in and where a centred one of them goes (see
 * placePattern in sdf/placement.ts), the centre of the pattern when it is left out
 */
export interface IFrame {
  pattern: IPattern;
  box: IBox;
  centre?: { x: number; z: number };
}

// the same pattern in the same frame is the same object, so what is made from it (a shader, a distance field) is made once
const framedRoots = new WeakMap<SdfNode, Map<number, SdfNode>>();
const framedPatterns = new WeakMap<IPattern, Map<string, IPattern>>();
const memo = <K extends object, I, V>(cache: WeakMap<K, Map<I, V>>, key: K, inner: I, make: () => V): V => {
  let made = cache.get(key);
  if (!made) cache.set(key, (made = new Map()));
  if (!made.has(inner)) made.set(inner, make());
  return made.get(inner) as V;
};

/**
 * The pattern on a piece: its centre at the anchor of the piece, moved by the centre the pattern has itself, and k times its size
 * (a scale of its root, so its distances stay in mm as with any scale). A centred svg shape or text stays in the middle of the piece
 */
export const pieceFrame = (pattern: IPattern, top: IBox, reference: ISize, repeat: IRepeat): IFrame => {
  const k = fitFactor(top, reference, repeat.fit);
  const anchor = anchorOf(top, repeat.anchorX, repeat.anchorZ);
  const mid = middle(top);
  const { x, y, z } = pattern.center;
  const center = { x: anchor.x + k * x, y, z: anchor.z + k * z };
  const framed = memo(framedPatterns, pattern, [center.x, center.y, center.z, k].join(), () => ({
    ...pattern,
    center,
    root: k === 1 ? pattern.root : memo(framedRoots, pattern.root, k, () => ({ ...pattern.root, scale: pattern.root.scale / k })),
  }));
  return { pattern: framed, box: top, centre: { x: mid.x + k * x, z: mid.z + k * z } };
};

/** what differs on a node of a piece: some of its settings, or all of it with what is below it, its own */
export type NodeOverride = { values: Record<string, unknown> } | { own: SdfNode };

/** what differs on a piece from the shared pattern, its nodes by their id in the shared tree */
export interface IPieceOverride {
  center?: IVector;
  rotation?: number;
  nodes: Record<string, NodeOverride>;
}

export const NO_OVERRIDE: IPieceOverride = { nodes: {} };

/** whether a piece differs from the shared pattern */
export const differs = (override?: IPieceOverride): boolean =>
  !!override && (override.center !== undefined || override.rotation !== undefined || Object.keys(override.nodes).length > 0);

// not settings of a node: who it is, what is below it and where its placement puts it (see IPlacement)
const NOT_SETTINGS = new Set(['id', 'children', 'offsetX', 'offsetZ']);
const settings = (node: SdfNode) => Object.entries(node).filter(([key]) => !NOT_SETTINGS.has(key));
// a setting is a number, a text or the curve of a text
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const sameChildren = (a: SdfNode[], b: SdfNode[]) => a.length === b.length && a.every((c, i) => c.id === b[i].id);

/** the settings of a node that are not what the shared node has */
const settingsThatDiffer = (shared: SdfNode, node: SdfNode): Record<string, unknown> =>
  Object.fromEntries(settings(node).filter(([key, value]) => !same(value, (shared as unknown as Record<string, unknown>)[key])));

const resolved = new WeakMap<IPattern, WeakMap<IPieceOverride, IPattern>>();

/** the pattern of a piece: the shared one with its settings replaced and its own groups in place of the shared ones */
export const resolvePattern = (shared: IPattern, override: IPieceOverride = NO_OVERRIDE): IPattern => {
  if (!differs(override)) return shared;
  let ofShared = resolved.get(shared);
  if (!ofShared) resolved.set(shared, (ofShared = new WeakMap()));
  let pattern = ofShared.get(override);
  if (pattern) return pattern;

  const resolve = (node: SdfNode): SdfNode => {
    const o = override.nodes[node.id];
    if (o && 'own' in o) return o.own;
    const set = o ? ({ ...node, ...o.values } as SdfNode) : node;
    if (!isGroup(node)) return set;
    const children = node.children.map(resolve);
    return children.every((c, i) => c === node.children[i]) ? set : ({ ...set, children } as SdfNode);
  };
  pattern = { ...shared, center: override.center ?? shared.center, rotation: override.rotation ?? shared.rotation, root: resolve(shared.root) };
  ofShared.set(override, pattern);
  return pattern;
};

/**
 * What differs in a pattern that was the shared one: a node of another kind or with other children is the piece's own, with all
 * that is below it, of the others the settings that differ. A group that has the children of the shared one again follows it again
 */
export const diffPattern = (shared: IPattern, edited: IPattern): IPieceOverride => {
  const nodes: IPieceOverride['nodes'] = {};
  const diff = (s: SdfNode, t: SdfNode) => {
    if (s.id !== t.id || s.kind !== t.kind || (isGroup(s) && isGroup(t) && !sameChildren(s.children, t.children))) {
      nodes[s.id] = { own: t };
      return;
    }
    const values = settingsThatDiffer(s, t);
    if (Object.keys(values).length) nodes[s.id] = { values };
    if (isGroup(s) && isGroup(t)) s.children.forEach((c, i) => diff(c, t.children[i]));
  };
  diff(shared.root, edited.root);
  return {
    ...(same(shared.center, edited.center) ? {} : { center: edited.center }),
    ...(shared.rotation === edited.rotation ? {} : { rotation: edited.rotation }),
    nodes,
  };
};

const renamed = (node: SdfNode, taken: Set<string>): SdfNode => {
  const id = taken.has(node.id) ? newId() : node.id;
  taken.add(id);
  const children = isGroup(node) ? node.children.map((c) => renamed(c, taken)) : undefined;
  const changed = id !== node.id || (isGroup(node) && children!.some((c, i) => c !== node.children[i]));
  return changed ? ({ ...node, id, ...(children ? { children } : {}) } as SdfNode) : node;
};

/**
 * An override as it holds on the shared pattern as it is now: without what is on a node that is gone from it (or below a group the
 * piece has its own of), without the settings its node doesn't have or has the same, and without an id twice in the pattern of the
 * piece (a node of an own group that is elsewhere in the shared tree gets a new one). The same object when nothing changed
 */
export const settleOverride = (shared: IPattern, override: IPieceOverride = NO_OVERRIDE): IPieceOverride => {
  if (!differs(override)) return override;
  const nodes: IPieceOverride['nodes'] = {};
  const own: string[] = [];
  const taken = new Set<string>();
  let changed = false;

  const visit = (node: SdfNode) => {
    taken.add(node.id);
    const o = override.nodes[node.id];
    if (o && 'own' in o) {
      own.push(node.id);
      return;
    }
    if (o) {
      const kept = Object.entries(o.values).filter(([key, value]) => key in node && !same(value, (node as unknown as Record<string, unknown>)[key]));
      if (kept.length < Object.keys(o.values).length) changed = true;
      if (kept.length) nodes[node.id] = kept.length < Object.keys(o.values).length ? { values: Object.fromEntries(kept) } : o;
    }
    if (isGroup(node)) node.children.forEach(visit);
  };
  visit(shared.root);

  // the node an own group stands for keeps its id, so the group stays in its place
  for (const id of own) {
    const o = override.nodes[id] as { own: SdfNode };
    taken.delete(o.own.id);
    const settled = renamed(o.own, taken);
    if (settled !== o.own) changed = true;
    nodes[id] = settled === o.own ? o : { own: settled };
  }
  if (Object.keys(nodes).length < Object.keys(override.nodes).length) changed = true;

  const center = override.center && !same(override.center, shared.center) ? override.center : undefined;
  const rotation = override.rotation !== undefined && override.rotation !== shared.rotation ? override.rotation : undefined;
  if (!changed && center === override.center && rotation === override.rotation) return override;
  return { ...(center ? { center } : {}), ...(rotation !== undefined ? { rotation } : {}), nodes };
};

/** what differs on the node with the id in the pattern of a piece, with the id it has in the shared tree: an own group can have another */
export const overrideAt = (override: IPieceOverride | undefined, id: string): [string, NodeOverride] | undefined =>
  override && Object.entries(override.nodes).find(([key, o]) => ('own' in o ? o.own.id : key) === id);

/** an override without what differs on a node: one of its settings, or (without a key) all of it, an own group too */
export const resetNode = (override: IPieceOverride, id: string, key?: string): IPieceOverride => {
  const o = override.nodes[id];
  if (!o) return override;
  const without = (record: Record<string, unknown>, name: string) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== name));
  const others = without(override.nodes, id) as IPieceOverride['nodes'];
  if (key === undefined || 'own' in o) return { ...override, nodes: others };
  const values = without(o.values, key);
  return { ...override, nodes: Object.keys(values).length ? { ...others, [id]: { values } } : others };
};
