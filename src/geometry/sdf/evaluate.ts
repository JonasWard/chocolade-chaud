import { sampleCentredField } from '../field';
import { DistanceMethod, ScaledDistanceMethod, distanceMethods } from '../sdMethods';
import { IPattern, IProfile, SdfNode, SvgFields, textFieldKey } from './tree';
import { findPath, nodeFrame } from './treeOps';

// the pattern compiled into closures, evaluated per vertex. three/shaders/sdfCodegen.ts generates the same in glsl.
// every node is evaluated at a scale s: s' = s * node.scale is what the node works with, its output is multiplied by node.gain.
// A text or an svg shape divides its distance by its frame, the static part of that scale (see nodeFrame in treeOps.ts), so a scale
// only changes its size: its distances, limits and bevels stay in mm on the bars

/** polynomial smooth minimum, k is the radius of the blend, 0 is the plain minimum */
export const smoothMin = (a: number, b: number, k: number): number => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smoothMax = (a: number, b: number, k: number): number => -smoothMin(-a, -b, k);

/** the distance d (in mm, negative inside) to an svg shape or a text, shaped by its profile, see profile in three/shaders/sdfCodegen.ts */
export const profile = (d: number, { inner, outer, beveled, innerBevel, outerBevel }: IProfile): number => {
  // the distance up to the limit of its side, s is 1 outside and -1 inside
  const limited = (v: number, limit: number, bevel: number, s: number) => {
    if (limit <= 0) return v;
    if (!beveled) return s * Math.min(s * v, limit);
    return bevel > 0 ? s * limit * Math.min((s * v) / bevel, 1) : s * limit;
  };
  return d >= 0 ? limited(d, outer, outerBevel, 1) : limited(d, inner, innerBevel, -1);
};

/** centred tiling, positive for negative coordinates too (unlike %) */
export const repeat = (v: number, period: number): number => (period > 0 ? v - period * Math.floor(v / period + 0.5) : v);

const compileNode = (node: SdfNode, fields: SvgFields, parentFrame = 1): ScaledDistanceMethod => {
  const { scale, gain } = node;
  const frame = parentFrame * scale;

  switch (node.kind) {
    case 'method': {
      const method = distanceMethods[node.method];
      return (x, y, z, s) => gain * method(x, y, z, s * scale);
    }
    case 'constant':
      return () => gain * node.value;
    case 'svg': {
      const field = fields.get(node.asset);
      const { width, offsetX, offsetZ, repeat: period } = node;
      if (!field || !(width > 0)) return () => 0;
      return (x, _y, z, s) =>
        gain *
        profile((width * sampleCentredField(field, repeat(x * s * scale - offsetX, period) / width, repeat(z * s * scale - offsetZ, period) / width)) / frame, node);
    }
    case 'text': {
      const field = fields.get(textFieldKey(node));
      if (!field) return () => 0;
      const { x: cx, z: cz } = field.center ?? { x: 0, z: 0 };
      const [ox, oz] = [cx + node.offsetX, cz + node.offsetZ];
      return (x, _y, z, s) => gain * profile(sampleCentredField(field, x * s * scale - ox, z * s * scale - oz) / frame, node);
    }
    case 'chain': {
      // the last child works at the scale of the chain, the others at the output of the child after them
      const children = node.children.map((c, i) => compileNode(c, fields, i === node.children.length - 1 ? frame : 1));
      if (children.length === 0) return () => 0;
      return (x, y, z, s) => {
        let d = children[children.length - 1](x, y, z, s * scale);
        for (let i = children.length - 2; i >= 0; i--) d = children[i](x, y, z, d);
        return gain * d;
      };
    }
  }

  const children = node.children.map((c) => compileNode(c, fields, frame));
  if (children.length === 0) return () => 0;
  const fold = (combine: (a: number, b: number) => number): ScaledDistanceMethod => (x, y, z, s) => {
    const sc = s * scale;
    let d = children[0](x, y, z, sc);
    for (let i = 1; i < children.length; i++) d = combine(d, children[i](x, y, z, sc));
    return gain * d;
  };

  switch (node.kind) {
    case 'union':
      return fold((a, b) => smoothMin(a, b, node.smooth));
    case 'intersection':
      return fold((a, b) => smoothMax(a, b, node.smooth));
    // the first child minus the others
    case 'difference':
      return fold((a, b) => smoothMax(a, -b, node.smooth));
    case 'add':
      return fold((a, b) => a + b);
    case 'subtract':
      return fold((a, b) => a - b);
    // ripples along the distance of its children
    case 'sine': {
      const { amplitude, period } = node;
      if (!(period > 0)) return () => 0;
      const k = (2 * Math.PI) / period;
      return (x, y, z, s) => {
        const sc = s * scale;
        let d = 0;
        for (const child of children) d += child(x, y, z, sc);
        return gain * amplitude * Math.sin(k * d);
      };
    }
  }
};

/** the distance function of a pattern, around its centre and rotated around the vertical axis */
export const compilePattern = (pattern: IPattern, fields: SvgFields = new Map()): DistanceMethod => {
  const sdf = compileNode(pattern.root, fields);
  const { x: cx, y: cy, z: cz } = pattern.center;
  const angle = (pattern.rotation * Math.PI) / 180;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  return (x, y, z) => {
    const px = x - cx;
    const pz = z - cz;
    return sdf(c * px - sn * pz, y - cy, sn * px + c * pz, 1);
  };
};

/** where a point of the plane a node works in (at the given static scale, see staticScale) is on the bars, in mm */
export const toWorld = (pattern: IPattern, scale: number, { x, z }: { x: number; z: number }): { x: number; z: number } => {
  const angle = (pattern.rotation * Math.PI) / 180;
  const [c, sn] = [Math.cos(angle), Math.sin(angle)];
  const [rx, rz] = [x / scale, z / scale];
  return { x: c * rx + sn * rz + pattern.center.x, z: -sn * rx + c * rz + pattern.center.z };
};

/** the inverse of toWorld */
export const toPattern = (pattern: IPattern, scale: number, { x, z }: { x: number; z: number }): { x: number; z: number } => {
  const angle = (pattern.rotation * Math.PI) / 180;
  const [c, sn] = [Math.cos(angle), Math.sin(angle)];
  const [px, pz] = [x - pattern.center.x, z - pattern.center.z];
  return { x: (c * px - sn * pz) * scale, z: (sn * px + c * pz) * scale };
};

/**
 * The scale the node with the id is evaluated at, as s * node.scale in compileNode, at a point of the plane of the pattern (toPattern
 * with a scale of 1) at the height y above its centre. It is the static scale of nodeFrame, unless a chain makes it vary: a child of a
 * chain that is not its last works at the output of the child after it
 */
export const nodeScaleAt = (pattern: IPattern, id: string, fields: SvgFields = new Map(), y = 0): ((x: number, z: number) => number) | undefined => {
  const path = findPath(pattern.root, id);
  if (!path) return undefined;
  // the scale passed into the node at every step of the path
  let scaleAt = (_x: number, _z: number) => 1;
  path.forEach((node, i) => {
    const next = path[i + 1];
    const outer = scaleAt;
    const own = (x: number, z: number) => outer(x, z) * node.scale;
    if (node.kind !== 'chain' || !next || node.children.at(-1) === next) {
      scaleAt = own;
      return;
    }
    // the children after the next one, evaluated as in the chain
    const k = node.children.indexOf(next);
    const frame = nodeFrame(pattern.root, node.id)?.scale ?? 1;
    const after = node.children.map((c, j) => (j > k ? compileNode(c, fields, j === node.children.length - 1 ? frame : 1) : undefined));
    scaleAt = (x, z) => {
      let d = after[after.length - 1]!(x, y, z, own(x, z));
      for (let j = after.length - 2; j > k; j--) d = after[j]!(x, y, z, d);
      return d;
    };
  });
  const result = scaleAt;
  return (x, z) => result(x, z);
};

/**
 * Where a point q of a node is on the plane of the pattern: the p with p * scale(p) = q, by newton's method from where q is at the
 * scale at q (or from start). Undefined where it doesn't settle: where the scale varies too fast, or is near 0
 */
export const fromNode = (scaleAt: (x: number, z: number) => number, q: { x: number; z: number }, start?: { x: number; z: number }): { x: number; z: number } | undefined => {
  const s0 = scaleAt(q.x, q.z);
  let p = start ?? (Math.abs(s0) > 1e-6 ? { x: q.x / s0, z: q.z / s0 } : { x: q.x, z: q.z });
  const tolerance = 1e-4 * Math.max(1, Math.hypot(q.x, q.z));
  const h = 1e-4;
  for (let i = 0; i < 32; i++) {
    const s = scaleAt(p.x, p.z);
    const [fx, fz] = [p.x * s - q.x, p.z * s - q.z];
    if (!Number.isFinite(fx + fz)) return undefined;
    if (Math.hypot(fx, fz) < tolerance) return Math.abs(s) > 1e-6 ? p : undefined;
    // the jacobian of p * scale(p)
    const [sx, sz] = [(scaleAt(p.x + h, p.z) - s) / h, (scaleAt(p.x, p.z + h) - s) / h];
    const [a, b, c, d] = [s + p.x * sx, p.x * sz, p.z * sx, s + p.z * sz];
    const det = a * d - b * c;
    if (!(Math.abs(det) > 1e-12)) return undefined;
    // a step at most as long as where p is, so it doesn't jump to another place the node repeats at
    let [dx, dz] = [(d * fx - b * fz) / det, (a * fz - c * fx) / det];
    const limit = Math.max(1, Math.hypot(p.x, p.z)) * 0.5;
    const length = Math.hypot(dx, dz);
    if (length > limit) [dx, dz] = [(dx * limit) / length, (dz * limit) / length];
    p = { x: p.x - dx, z: p.z - dz };
  }
  return undefined;
};
