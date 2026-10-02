import { sampleCentredField } from '../field';
import { DistanceMethod, ScaledDistanceMethod, distanceMethods } from '../sdMethods';
import { IPattern, IProfile, SdfNode, SvgFields, textFieldKey } from './tree';

// the pattern compiled into closures, evaluated per vertex. three/shaders/sdfCodegen.ts generates the same in glsl.
// every node is evaluated at a scale s: s' = s * node.scale is what the node works with, its output is multiplied by node.gain

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

/** the distance d (in mm, negative inside) to an svg shape or a text, shaped by its profile, see profile in three/shaders/sdfCodegen.ts */
export const profile = (d: number, { inside, depth, bevel, cutoff }: IProfile): number => {
  if (d >= 0) return cutoff > 0 ? Math.min(d, cutoff) : d;
  if (inside === 'distance') return d;
  return bevel > 0 ? -depth * Math.min(-d / bevel, 1) : -depth;
};

/** centred tiling, positive for negative coordinates too (unlike %) */
export const repeat = (v: number, period: number): number => (period > 0 ? v - period * Math.floor(v / period + 0.5) : v);

const compileNode = (node: SdfNode, fields: SvgFields): ScaledDistanceMethod => {
  const { scale, gain } = node;

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
        gain * profile(width * sampleCentredField(field, repeat(x * s * scale - offsetX, period) / width, repeat(z * s * scale - offsetZ, period) / width), node);
    }
    case 'text': {
      const field = fields.get(textFieldKey(node));
      if (!field) return () => 0;
      const { x: cx, z: cz } = field.center ?? { x: 0, z: 0 };
      return (x, _y, z, s) => gain * profile(sampleCentredField(field, x * s * scale - cx, z * s * scale - cz), node);
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
      const children = node.children.map((c) => compileNode(c, fields));
      if (children.length === 0) return () => 0;
      return (x, y, z, s) => {
        let d = children[children.length - 1](x, y, z, s * scale);
        for (let i = children.length - 2; i >= 0; i--) d = children[i](x, y, z, d);
        return gain * d;
      };
    }
  }

  const children = node.children.map((c) => compileNode(c, fields));
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
