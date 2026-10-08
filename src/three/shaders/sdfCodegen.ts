import { DistanceMethodType } from '../../geometry/sdMethods';
import { IPattern, IProfile, SdfNode, SvgFields, textFieldKey } from '../../geometry/sdf/tree';
import { IFieldLevel, LEVEL_BLEND, LEVEL_MARGIN, LEVEL_REACH } from '../../geometry/field';
import { LEVEL_COUNT } from '../../geometry/outline/outlineField';
import { GRADIENT_STEP, Layout, PETAL_SWAY, TINY } from '../../geometry/sdf/waves';

// glsl port of geometry/sdf/evaluate.ts. The structure of the tree is generated into the shader, its numbers are uniforms,
// so only adding, removing or changing the kind of a node compiles a new shader, editing a number does not.

// samplers for the distance fields of svg and text nodes
export const MAX_FIELD_SLOTS = 8;
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

const TURN = (2 * Math.PI).toFixed(12);

const methodFunctions = Object.entries(methodGLSL)
  .map(([method, body]) => `float sd${method.slice(2)}(vec3 q) { return ${body}; }`)
  .join('\n');

/**
 * Bicubic (catmull-rom) by hand, the same sample as sampleField in geometry/field.ts: float textures don't filter everywhere.
 * A field is an atlas of its levels (see createFieldTexture in shaders/bake.ts), a level is a rectangle of it
 */
export const fieldGLSL = /* glsl */ `
// beyond its edge pixels a level continues along its slope there
float levelTexel(sampler2D field, ivec2 origin, ivec2 size, ivec2 p) {
  ivec2 c = clamp(p, ivec2(0), size - 1);
  ivec2 e = p - c;
  float d = texelFetch(field, origin + c, 0).r;
  if (e == ivec2(0)) return d;
  float dx = texelFetch(field, origin + clamp(c - ivec2(sign(e.x), 0), ivec2(0), size - 1), 0).r;
  float dy = texelFetch(field, origin + clamp(c - ivec2(0, sign(e.y)), ivec2(0), size - 1), 0).r;
  return d + float(abs(e.x)) * (d - dx) + float(abs(e.y)) * (d - dy);
}

vec4 catmullRom(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}

float levelDistance(sampler2D field, ivec2 origin, ivec2 size, vec2 local, float pixelSize) {
  vec2 f = local / pixelSize - 0.5;
  vec2 f0 = floor(f);
  vec4 wx = catmullRom(f.x - f0.x);
  vec4 wz = catmullRom(f.y - f0.y);
  ivec2 p = ivec2(f0);
  float sum = 0.0;
  for (int j = 0; j < 4; j++) {
    ivec2 q = p + ivec2(0, j - 1);
    vec4 row = vec4(
      levelTexel(field, origin, size, q + ivec2(-1, 0)),
      levelTexel(field, origin, size, q),
      levelTexel(field, origin, size, q + ivec2(1, 0)),
      levelTexel(field, origin, size, q + ivec2(2, 0))
    );
    sum += dot(row, wx) * wz[j];
  }
  return sum;
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

// level k of a field: the finest (width, height, pixel size) is l0, every coarser one (l1.xy) is LEVEL_REACH times further than
// the one before it, l1.z the pixel size of the first of them, l1.w how many there are
void fieldLevel(int k, vec3 l0, vec4 l1, out ivec2 origin, out ivec2 size, out float pixelSize) {
  origin = k == 0 ? ivec2(0) : ivec2((k - 1) * int(l1.x), int(l0.y));
  size = k == 0 ? ivec2(l0.xy) : ivec2(l1.xy);
  pixelSize = k == 0 ? l0.z : l1.z * pow(${LEVEL_REACH.toFixed(1)}, float(k - 1));
}

float fieldLevelDistance(sampler2D field, int k, vec3 l0, vec4 l1, vec2 v) {
  ivec2 origin;
  ivec2 size;
  float pixelSize;
  fieldLevel(k, l0, l1, origin, size, pixelSize);
  return levelDistance(field, origin, size, v + vec2(size) * pixelSize * 0.5, pixelSize);
}

// see sampleCentredField in geometry/field.ts, a pixel size of 0 means the field isn't there (yet)
float centredFieldDistance(sampler2D field, vec2 v, vec3 l0, vec4 l1) {
  int last = int(l1.w);
  for (int k = 0; k < ${LEVEL_COUNT}; k++) {
    if (k >= last) break;
    ivec2 origin;
    ivec2 size;
    float pixelSize;
    fieldLevel(k, l0, l1, origin, size, pixelSize);
    // how far inside of the part of the level that is used, in its pixels
    vec2 inside = vec2(size) * 0.5 - ${LEVEL_MARGIN.toFixed(1)} - abs(v) / pixelSize;
    float within = min(inside.x, inside.y);
    if (within < 0.0) continue;
    float d = levelDistance(field, origin, size, v + vec2(size) * pixelSize * 0.5, pixelSize);
    if (within >= ${LEVEL_BLEND.toFixed(1)}) return d;
    float t = smoothstep(0.0, 1.0, 1.0 - within / ${LEVEL_BLEND.toFixed(1)});
    return mix(d, fieldLevelDistance(field, k + 1, l0, l1, v), t);
  }
  ivec2 origin;
  ivec2 size;
  float pixelSize;
  fieldLevel(last, l0, l1, origin, size, pixelSize);
  vec2 extent = vec2(size) * pixelSize;
  vec2 local = v + extent * 0.5;
  vec2 clamped = clamp(local, vec2(0.0), extent);
  return levelDistance(field, origin, size, clamped, pixelSize) + length(local - clamped);
}

// see profile in geometry/sdf/evaluate.ts, s is 1 outside and -1 inside
float limited(float v, float limit, float beveled, float bevel, float s) {
  if (limit <= 0.0) return v;
  if (beveled < 0.5) return s * min(s * v, limit);
  return bevel > 0.0 ? s * limit * min(s * v / bevel, 1.0) : s * limit;
}

float profile(float d, float inner, float outer, float beveled, float innerBevel, float outerBevel) {
  return d >= 0.0 ? limited(d, outer, beveled, outerBevel, 1.0) : limited(d, inner, beveled, innerBevel, -1.0);
}

float svgDistance(sampler2D field, vec2 v, float width, vec2 offset, float period, vec3 l0, vec4 l1) {
  if (l0.z <= 0.0 || width <= 0.0) return 0.0;
  return width * centredFieldDistance(field, opRepeat(v - offset, period) / width, l0, l1);
}

// see waves in geometry/sdf/waves.ts, t is a phase in turns
float waveSine(float t) { return sin(${TURN} * t); }
float waveTriangle(float t) { return 4.0 * abs(fract(t - 0.25) - 0.5) - 1.0; }
float waveSawtooth(float t) { return 2.0 * fract(t + 0.5) - 1.0; }

float angleOf(vec2 v) { return v == vec2(0.0) ? 0.0 : atan(v.y, v.x); }

// see fade in geometry/sdf/waves.ts
float waveFade(float radial, float angular, float detail) {
  return detail > 0.0 ? smoothstep(detail, 2.0 * detail, 1.0 / max(length(vec2(radial, angular)), ${TINY})) : 1.0;
}
`;

type Param = (fields: SvgFields) => number;

export interface ISdfShaderPlan {
  /** the glsl of the sdf, it only depends on the structure of the tree, so it is the key of the shader too */
  glsl: string;
  /** the field key of every sampler slot, uField0, uField1, ... */
  fieldKeys: string[];
  /** whether the shader can hold the tree */
  fits: boolean;
  /** the values of uParams */
  params: (fields: SvgFields) => Float32Array;
}

const buildPlan = (root: SdfNode): ISdfShaderPlan => {
  // of the function that is being written, sdf itself or one of the functions before it
  let lines: string[] = [];
  // the children of a sine that are evaluated at more than one point, see its case in generate
  const functions: string[] = [];
  const params: Param[] = [];
  const fieldKeys: string[] = [];
  const slot = (key: string) => {
    let i = fieldKeys.indexOf(key);
    if (i < 0) i = fieldKeys.push(key) - 1;
    return `uField${Math.min(i, MAX_FIELD_SLOTS - 1)}`;
  };
  let count = 0;

  const param = (value: Param): string => {
    const i = params.push(value) - 1;
    return `uParams[${i >> 2}].${'xyzw'[i & 3]}`;
  };
  // the sizes of the levels of a field, see centredFieldDistance
  const levels = (key: string) => {
    const level = (k: number, value: (l: IFieldLevel) => number) => param((fields) => {
      const field = fields.get(key);
      const l = k === 0 ? field : field?.levels?.[0];
      return l ? value(l) : 0;
    });
    const l0 = `vec3(${level(0, (l) => l.width)}, ${level(0, (l) => l.height)}, ${level(0, (l) => l.pixelSize)})`;
    const count = param((fields) => fields.get(key)?.levels?.length ?? 0);
    return `${l0}, vec4(${level(1, (l) => l.width)}, ${level(1, (l) => l.height)}, ${level(1, (l) => l.pixelSize)}, ${count})`;
  };
  const shaped = (d: string, node: IProfile) =>
    `profile(${d}, ${param(() => node.inner)}, ${param(() => node.outer)}, ${param(() => (node.beveled ? 1 : 0))}, ${param(() => node.innerBevel)}, ${param(() => node.outerBevel)})`;

  // returns the name of the variable holding the distance of the node, s is the scale it is evaluated at,
  // parentFrame the static part of it (see compileNode in geometry/sdf/evaluate.ts)
  const generate = (node: SdfNode, s: string, parentFrame: () => number): string => {
    const k = count++;
    const frame = () => parentFrame() * node.scale;
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
        const field = slot(node.asset);
        const offset = `vec2(${param(() => node.offsetX)}, ${param(() => node.offsetZ)})`;
        d = shaped(`svgDistance(${field}, p.xz * ${sk}, ${param(() => node.width)}, ${offset}, ${param(() => node.repeat)}, ${levels(node.asset)}) / ${param(frame)}`, node);
        break;
      }
      case 'text': {
        // in mm around the centre of its field, see the text case in geometry/sdf/evaluate.ts
        const key = textFieldKey(node);
        const field = slot(key);
        // the centre of its field where the text is moved to
        const center = `vec2(${param((fields) => (fields.get(key)?.center?.x ?? 0) + node.offsetX)}, ${param((fields) => (fields.get(key)?.center?.z ?? 0) + node.offsetZ)})`;
        d = shaped(`svgDistance(${field}, p.xz * ${sk}, 1.0, ${center}, 0.0, ${levels(key)}) / ${param(frame)}`, node);
        break;
      }
      case 'chain': {
        d = '0.0';
        const last = node.children.length - 1;
        for (let i = last; i >= 0; i--) d = i === last ? generate(node.children[i], sk, frame) : generate(node.children[i], d, () => 1);
        break;
      }
      case 'union':
      case 'intersection':
      case 'difference': {
        const op = `op${node.kind[0].toUpperCase()}${node.kind.slice(1)}`;
        const smooth = param(() => node.smooth);
        const ds = node.children.map((c) => generate(c, sk, frame));
        d = ds.length ? ds.reduce((a, b) => `${op}(${a}, ${b}, ${smooth})`) : '0.0';
        break;
      }
      case 'add':
      case 'subtract': {
        const ds = node.children.map((c) => generate(c, sk, frame));
        d = ds.length ? ds.join(node.kind === 'add' ? ' + ' : ' - ') : '0.0';
        break;
      }
      // a wave along the distance of its children and around their angle, see the sine case in geometry/sdf/evaluate.ts.
      // Its wave, its layout and where its angle comes from are structure, without a period its amplitude is 0
      case 'sine': {
        const polar = node.layout !== 'rings';
        const outline = polar && node.around === 'outline';
        // around an outline its children are a function of their own, for the points around p
        const outer = lines;
        if (outline) lines = [];
        const ds = node.children.map((c) => generate(c, outline ? 's' : sk, frame));
        if (outline) {
          if (ds.length) functions.push(`float f${k}(vec3 p, float s) {\n  ${lines.join('\n  ')}\n  return ${ds.join(' + ')};\n}`);
          lines = outer;
        }
        const amplitude = param(() => (node.period > 0 ? node.amplitude : 0));
        const frequency = param(() => (node.period > 0 ? 1 / node.period : 0));
        const detail = param(() => node.detail);
        if (!ds.length) {
          d = '0.0';
          break;
        }
        const wave = `wave${node.wave[0].toUpperCase()}${node.wave.slice(1)}`;
        const c = `c${k}`;
        lines.push(`float ${c} = ${outline ? `f${k}(p, ${sk})` : ds.join(' + ')};`);
        if (!polar) {
          d = `${amplitude} * waveFade(${frequency}, 0.0, ${detail}) * ${wave}(${c} * ${frequency})`;
          break;
        }
        const turns = param(() => node.count / (2 * Math.PI));
        const twist = param(() => (node.twist * Math.PI) / 180);
        // the angle and the curvature
        const [a, kappa] = [`a${k}`, `k${k}`];
        if (outline) {
          const e = GRADIENT_STEP;
          const at = (offset: string) => `f${k}(p ${offset}, ${sk})`;
          lines.push(
            `vec4 n${k} = vec4(${at(`+ vec3(${e}, 0.0, 0.0)`)}, ${at(`- vec3(${e}, 0.0, 0.0)`)}, ${at(`+ vec3(0.0, 0.0, ${e})`)}, ${at(`- vec3(0.0, 0.0, ${e})`)});`,
            `vec2 g${k} = vec2(n${k}.x - n${k}.y, n${k}.z - n${k}.w);`,
            `float ${a} = angleOf(g${k});`,
            `float ${kappa} = abs(n${k}.x + n${k}.y + n${k}.z + n${k}.w - 4.0 * ${c}) / ${(e * e).toFixed(6)} / max(length(g${k}) / ${(2 * e).toFixed(6)}, ${TINY});`
          );
        } else lines.push(`float ${a} = angleOf(p.xz);`, `float ${kappa} = 1.0 / max(length(p.xz), ${TINY});`);
        const [r, an] = [`${c} * ${frequency}`, `${turns} * (${a} + ${twist} * ${c})`];
        const shape: Record<Layout, string> = {
          rings: `${wave}(${r})`,
          spiral: `${wave}(${r} + ${an})`,
          petals: `${wave}(${r} + ${PETAL_SWAY} * sin(${TURN} * ${an}))`,
          weave: `${wave}(${r}) * ${wave}(${an})`,
        };
        d = `${amplitude} * waveFade(${frequency} + ${turns} * abs(${twist}), ${turns} * ${kappa}, ${detail}) * ${shape[node.layout]}`;
        break;
      }
    }
    lines.push(`float d${k} = ${param(() => node.gain)} * (${d});`);
    return `d${k}`;
  };

  const result = generate(root, '1.0', () => 1);
  const vectors = Math.max(1, Math.ceil(params.length / 4));
  const samplers = [...Array(MAX_FIELD_SLOTS).keys()].map((j) => `uniform sampler2D uField${j};`).join('\n');

  const glsl = /* glsl */ `
uniform vec4 uParams[${vectors}];
uniform vec3 uCenter;
// cos and sin of the rotation around the vertical axis
uniform vec2 uRotation;
${samplers}
${libraryGLSL}
${functions.join('\n')}
float sdf(vec3 position) {
  vec3 p = position - uCenter;
  p.xz = vec2(uRotation.x * p.x - uRotation.y * p.z, uRotation.y * p.x + uRotation.x * p.z);
  ${lines.join('\n  ')}
  return ${result};
}
`;

  return {
    glsl,
    fieldKeys,
    fits: fieldKeys.length <= MAX_FIELD_SLOTS && vectors <= MAX_PARAM_VECTORS,
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

/** the uniforms of the sdf of the plan, but for the field samplers */
export const sdfUniformValues = (pattern: IPattern, fields: SvgFields) => {
  const angle = (pattern.rotation * Math.PI) / 180;
  return {
    uParams: sdfShaderPlan(pattern).params(fields),
    uCenter: [pattern.center.x, pattern.center.y, pattern.center.z],
    uRotation: [Math.cos(angle), Math.sin(angle)],
  };
};
