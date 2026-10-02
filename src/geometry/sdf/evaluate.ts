import { sampleCentredField } from '../field';
import { DistanceMethod, ScaledDistanceMethod, distanceMethods } from '../sdMethods';
import { IPattern, SdfNode, SvgFields } from './tree';

// the pattern compiled into closures, evaluated per vertex. three/shaders/sdfCodegen.ts generates the same in glsl.
// every node is evaluated at a scale s: s' = s * node.scale is what the node works with, its output is multiplied by node.gain

/** polynomial smooth minimum, k is the radius of the blend, 0 is the plain minimum */
export const smoothMin = (a: number, b: number, k: number): number => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smoothMax = (a: number, b: number, k: number): number => -smoothMin(-a, -b, k);

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
        gain * width * sampleCentredField(field, repeat(x * s * scale - offsetX, period) / width, repeat(z * s * scale - offsetZ, period) / width);
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
