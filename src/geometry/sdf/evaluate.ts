import { sampleCentredField } from '../field';
import { DistanceMethod, ScaledDistanceMethod, distanceMethods } from '../sdMethods';
import { IPattern, IProfile, ISvgNode, ITextNode, SdfNode, SvgFields, isGroup, textFieldKey } from './tree';

// the pattern compiled into closures, evaluated per vertex. three/shaders/sdfCodegen.ts generates the same in glsl.
// every node is evaluated at a scale s: s' = s * node.scale is what the node works with, its output is multiplied by node.gain.
// A text or an svg shape divides its distance by its frame, the static part of that scale (see nodeFrame in treeOps.ts), so a scale
// only changes its size: its distances, depth, bevel and cutoff stay in mm on the bars

/** polynomial smooth minimum, k is the radius of the blend, 0 is the plain minimum */
export const smoothMin = (a: number, b: number, k: number): number => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smoothMax = (a: number, b: number, k: number): number => -smoothMin(-a, -b, k);

/** the first order distance to z = amplitude * sin(2 pi x / period), see sdSine in three/shaders/sdfCodegen.ts */
export const sdSine = (x: number, z: number, amplitude: number, period: number): number => {
  const k = (2 * Math.PI) / period;
  const slope = amplitude * k * Math.cos(k * x);
  return Math.abs(z - amplitude * Math.sin(k * x)) / Math.sqrt(1 + slope * slope);
};

/**
 * The distance d (in mm, negative inside) to an svg shape or a text, shaped by its profile: d outside, inside d or a plateau at
 * -depth with a rim as wide as the bevel, flat beyond the cutoff. Its edges rounded (smooth minimum and maximum), see profile in
 * three/shaders/sdfCodegen.ts
 */
export const profile = (d: number, { inside, depth, bevel, cutoff, round = 0 }: IProfile): number => {
  let f = d;
  if (inside === 'constant') {
    if (bevel > 0) {
      // the rim down to the plateau: d outside, slope * max(d, -bevel) inside
      const e = smoothMax(d, -bevel, round);
      f = e + (depth / bevel - 1) * smoothMin(e, 0, round);
    } else f = d >= 0 ? d : -depth;
  }
  return cutoff > 0 ? smoothMin(f, cutoff, round) : f;
};

/** centred tiling, positive for negative coordinates too (unlike %) */
export const repeat = (v: number, period: number): number => (period > 0 ? v - period * Math.floor(v / period + 0.5) : v);

/** the distance of an svg or a text at a location of the plane it works in, already scaled; undefined without its field */
const fieldSample = (node: ISvgNode | ITextNode, fields: SvgFields): ((u: number, v: number) => number) | undefined => {
  if (node.kind === 'svg') {
    const field = fields.get(node.asset);
    const { width, offsetX, offsetZ, repeat: period } = node;
    if (!field || !(width > 0)) return undefined;
    return (u, v) => width * sampleCentredField(field, repeat(u - offsetX, period) / width, repeat(v - offsetZ, period) / width);
  }
  const field = fields.get(textFieldKey(node));
  if (!field) return undefined;
  const { x: cx, z: cz } = field.center ?? { x: 0, z: 0 };
  return (u, v) => sampleCentredField(field, u - cx, v - cz);
};

/** no kink, far from any distance */
const NO_KINK = 1e9;

/** the distances where the profile has a sharp edge (unrounded): the rim, the plateau, the cutoff; NO_KINK where there is none */
export const creaseKinks = ({ inside, depth, bevel, cutoff }: IProfile): [number, number, number] => {
  const constant = inside === 'constant';
  // a rim as steep as the distance outside has no edge where they meet
  const rim = constant && (bevel <= 0 || Math.abs(depth / bevel - 1) > 1e-6);
  return [rim ? 0 : NO_KINK, constant && bevel > 0 ? -bevel : NO_KINK, cutoff > 0 ? cutoff : NO_KINK];
};

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
    case 'svg':
    case 'text': {
      const sample = fieldSample(node, fields);
      if (!sample) return () => 0;
      return (x, _y, z, s) => gain * profile(sample(x * s * scale, z * s * scale) / frame, node);
    }
    case 'sine': {
      const { amplitude, period } = node;
      if (!(period > 0)) return () => 0;
      const angle = (node.angle * Math.PI) / 180;
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      // turned back by the angle, so the curve runs along u
      return (x, _y, z, s) => gain * sdSine((c * x + sn * z) * s * scale, (c * z - sn * x) * s * scale, amplitude, period);
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

/**
 * Moves a location (x, z) of the bars onto the nearest sharp edge of the profile of an svg or a text (see creaseKinks) when it is
 * less than half the grid step h from it (one Newton step along the gradient of the distance), so that the edges of a mesh on a grid
 * follow those of the relief instead of crossing them in steps. Only nodes with a static frame (see nodeFrame in treeOps.ts) and
 * a round smaller than the step. See creaseSnap in three/shaders/sdfCodegen.ts
 */
export const compileCreaseSnap = (pattern: IPattern, fields: SvgFields = new Map()): ((x: number, z: number, h: number) => [number, number]) => {
  const { x: cx, z: cz } = pattern.center;
  const angle = (pattern.rotation * Math.PI) / 180;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);

  const leaves: { distance: (x: number, z: number) => number; kinks: [number, number, number]; round: number }[] = [];
  const visit = (node: SdfNode, parentFrame: number, exact: boolean) => {
    const frame = parentFrame * node.scale;
    if (node.kind === 'svg' || node.kind === 'text') {
      const sample = fieldSample(node, fields);
      if (!sample || !exact) return;
      const distance = (x: number, z: number) => {
        const [px, pz] = [x - cx, z - cz];
        return sample((c * px - sn * pz) * frame, (sn * px + c * pz) * frame) / frame;
      };
      leaves.push({ distance, kinks: creaseKinks(node), round: node.round ?? 0 });
    } else if (isGroup(node)) {
      const last = node.children.length - 1;
      node.children.forEach((child, i) => (node.kind === 'chain' && i !== last ? visit(child, 1, false) : visit(child, frame, exact)));
    }
  };
  visit(pattern.root, 1, true);

  return (x, z, h) => {
    let best = 0.5 * h;
    let [mx, mz] = [0, 0];
    for (const { distance, kinks, round } of leaves) {
      if (round >= h) continue;
      const d = distance(x, z);
      let e = d - kinks[0];
      if (Math.abs(d - kinks[1]) < Math.abs(e)) e = d - kinks[1];
      if (Math.abs(d - kinks[2]) < Math.abs(e)) e = d - kinks[2];
      if (!(Math.abs(e) < best)) continue;
      const eps = 0.25 * h;
      const gx = (distance(x + eps, z) - distance(x - eps, z)) / (2 * eps);
      const gz = (distance(x, z + eps) - distance(x, z - eps)) / (2 * eps);
      const g2 = gx * gx + gz * gz;
      if (g2 < 0.01) continue;
      let [ox, oz] = [(-e * gx) / g2, (-e * gz) / g2];
      const length = Math.hypot(ox, oz);
      if (length > 0.5 * h) [ox, oz] = [(ox * 0.5 * h) / length, (oz * 0.5 * h) / length];
      best = Math.abs(e);
      [mx, mz] = [ox, oz];
    }
    return [x + mx, z + mz];
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
