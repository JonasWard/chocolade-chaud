import { DistanceMethodType } from '../../geometry/sdMethods';
import { IPattern, SdfNode, SvgFields } from '../../geometry/sdf/tree';

// glsl port of geometry/sdf/evaluate.ts. The structure of the tree is generated into the shader, its numbers are uniforms,
// so only adding, removing or changing the kind of a node compiles a new shader, editing a number does not.

export const MAX_SVG_SLOTS = 4;
// vec4s, webgl2 guarantees 224 uniform vectors in a fragment shader, the bake uses a few more
export const MAX_PARAM_VECTORS = 192;

const methodGLSL: Record<DistanceMethodType, string> = {
  [DistanceMethodType.SDGyroid]: 'sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x)',
  [DistanceMethodType.SDSchwarzP]: 'cos(q.x) + cos(q.y) + cos(q.z)',
  [DistanceMethodType.SDSchwarzD]: 'cos(q.x) * cos(q.y) * cos(q.z) - sin(q.x) * sin(q.y) * sin(q.z)',
  [DistanceMethodType.SDNeovius]: '3.0 * (cos(q.x) + cos(q.y) + cos(q.z)) - 4.0 * cos(q.x) * cos(q.y) * cos(q.z)',
  [DistanceMethodType.SDSphere]: 'length(q) - 1.0',
  [DistanceMethodType.SDBox]: 'max(abs(q.x), max(abs(q.y), abs(q.z))) - 1.0',
  [DistanceMethodType.SDTorus]: 'length(vec2(length(q.xz) - 1.0, q.y)) - 0.25',
  [DistanceMethodType.SDCylinder]: 'length(vec2(length(vec2(q.x, length(q.yz))) - 1.0, length(q.yz)))',
};

const methodFunctions = Object.entries(methodGLSL)
  .map(([method, body]) => `float sd${method.slice(2)}(vec3 q) { return ${body}; }`)
  .join('\n');

/** bilinear by hand: float textures don't filter everywhere, and this way it is the same sample as sampleField in geometry/field.ts */
export const fieldGLSL = /* glsl */ `
float fieldTexel(sampler2D field, ivec2 p) {
  return texelFetch(field, clamp(p, ivec2(0), textureSize(field, 0) - 1), 0).r;
}

float fieldDistance(sampler2D field, vec2 local, float pixelSize) {
  vec2 f = local / pixelSize - 0.5;
  vec2 f0 = floor(f);
  vec2 t = f - f0;
  ivec2 p = ivec2(f0);
  float near = mix(fieldTexel(field, p), fieldTexel(field, p + ivec2(1, 0)), t.x);
  float far = mix(fieldTexel(field, p + ivec2(0, 1)), fieldTexel(field, p + ivec2(1, 1)), t.x);
  return mix(near, far, t.y);
}
`;

const libraryGLSL = /* glsl */ `
${methodFunctions}

float opUnion(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float opIntersection(float a, float b, float k) { return -opUnion(-a, -b, k); }
float opDifference(float a, float b, float k) { return opIntersection(a, -b, k); }

vec2 opRepeat(vec2 v, float period) { return period > 0.0 ? v - period * floor(v / period + 0.5) : v; }

// see sampleCentredField in geometry/field.ts, a pixel size of 0 means the field isn't there (yet)
float centredFieldDistance(sampler2D field, vec2 v, float pixelSize) {
  vec2 size = vec2(textureSize(field, 0)) * pixelSize;
  vec2 local = v + size * 0.5;
  vec2 clamped = clamp(local, vec2(0.0), size);
  return fieldDistance(field, clamped, pixelSize) + length(local - clamped);
}

float svgDistance(sampler2D field, vec2 v, float width, vec2 offset, float period, float pixelSize) {
  if (pixelSize <= 0.0 || width <= 0.0) return 0.0;
  return width * centredFieldDistance(field, opRepeat(v - offset, period) / width, pixelSize);
}
`;

type Param = (fields: SvgFields) => number;

export interface ISdfShaderPlan {
  /** the glsl of the sdf, it only depends on the structure of the tree, so it is the key of the shader too */
  glsl: string;
  /** the svg asset of every sampler slot, uSvg0, uSvg1, ... */
  svgAssets: string[];
  /** whether the shader can hold the tree */
  fits: boolean;
  /** the values of uParams */
  params: (fields: SvgFields) => Float32Array;
}

const buildPlan = (root: SdfNode): ISdfShaderPlan => {
  const lines: string[] = [];
  const params: Param[] = [];
  const svgAssets: string[] = [];
  let count = 0;

  const param = (value: Param): string => {
    const i = params.push(value) - 1;
    return `uParams[${i >> 2}].${'xyzw'[i & 3]}`;
  };

  // returns the name of the variable holding the distance of the node, s is the scale it is evaluated at
  const generate = (node: SdfNode, s: string): string => {
    const k = count++;
    const sk = `s${k}`;
    lines.push(`float ${sk} = ${s} * ${param(() => node.scale)};`);
    let d: string;
    switch (node.kind) {
      case 'method':
        d = `sd${node.method.slice(2)}(p * ${sk})`;
        break;
      case 'constant':
        d = param(() => node.value);
        break;
      case 'svg': {
        let slot = svgAssets.indexOf(node.asset);
        if (slot < 0) slot = svgAssets.push(node.asset) - 1;
        const field = `uSvg${Math.min(slot, MAX_SVG_SLOTS - 1)}`;
        const offset = `vec2(${param(() => node.offsetX)}, ${param(() => node.offsetZ)})`;
        const pixelSize = param((fields) => fields.get(node.asset)?.pixelSize ?? 0);
        d = `svgDistance(${field}, p.xz * ${sk}, ${param(() => node.width)}, ${offset}, ${param(() => node.repeat)}, ${pixelSize})`;
        break;
      }
      case 'chain': {
        d = '0.0';
        for (let i = node.children.length - 1; i >= 0; i--) d = generate(node.children[i], i === node.children.length - 1 ? sk : d);
        break;
      }
      case 'union':
      case 'intersection':
      case 'difference': {
        const op = `op${node.kind[0].toUpperCase()}${node.kind.slice(1)}`;
        const smooth = param(() => node.smooth);
        const ds = node.children.map((c) => generate(c, sk));
        d = ds.length ? ds.reduce((a, b) => `${op}(${a}, ${b}, ${smooth})`) : '0.0';
        break;
      }
      case 'add':
      case 'subtract': {
        const ds = node.children.map((c) => generate(c, sk));
        d = ds.length ? ds.join(node.kind === 'add' ? ' + ' : ' - ') : '0.0';
        break;
      }
    }
    lines.push(`float d${k} = ${param(() => node.gain)} * (${d});`);
    return `d${k}`;
  };

  const result = generate(root, '1.0');
  const vectors = Math.max(1, Math.ceil(params.length / 4));
  const samplers = [...Array(MAX_SVG_SLOTS).keys()].map((j) => `uniform sampler2D uSvg${j};`).join('\n');

  const glsl = /* glsl */ `
uniform vec4 uParams[${vectors}];
uniform vec3 uCenter;
// cos and sin of the rotation around the vertical axis
uniform vec2 uRotation;
${samplers}
${libraryGLSL}
float sdf(vec3 position) {
  vec3 p = position - uCenter;
  p.xz = vec2(uRotation.x * p.x - uRotation.y * p.z, uRotation.y * p.x + uRotation.x * p.z);
  ${lines.join('\n  ')}
  return ${result};
}
`;

  return {
    glsl,
    svgAssets,
    fits: svgAssets.length <= MAX_SVG_SLOTS && vectors <= MAX_PARAM_VECTORS,
    params: (fields) => {
      const values = new Float32Array(vectors * 4);
      params.forEach((value, i) => (values[i] = value(fields)));
      return values;
    },
  };
};

const plans = new WeakMap<SdfNode, ISdfShaderPlan>();

/** the shader of the tree of a pattern, the same tree gives the same plan */
export const sdfShaderPlan = (pattern: IPattern): ISdfShaderPlan => {
  let plan = plans.get(pattern.root);
  if (!plan) plans.set(pattern.root, (plan = buildPlan(pattern.root)));
  return plan;
};

/** the uniforms of the sdf of the plan, but for the svg samplers */
export const sdfUniformValues = (pattern: IPattern, fields: SvgFields) => {
  const angle = (pattern.rotation * Math.PI) / 180;
  return {
    uParams: sdfShaderPlan(pattern).params(fields),
    uCenter: [pattern.center.x, pattern.center.y, pattern.center.z],
    uRotation: [Math.cos(angle), Math.sin(angle)],
  };
};
