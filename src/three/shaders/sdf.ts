import { DistanceMethodType, IDistanceData } from '../../geometry/sdMethods';

// glsl port of geometry/sdMethods.ts, the method chain is driven by uniforms so editing it never recompiles the shader

export const MAX_METHODS = 8;

const methodIds: Record<DistanceMethodType, number> = {
  [DistanceMethodType.SDGyroid]: 0,
  [DistanceMethodType.SDSchwarzP]: 1,
  [DistanceMethodType.SDSchwarzD]: 2,
  [DistanceMethodType.SDNeovius]: 3,
  [DistanceMethodType.SDSphere]: 4,
  [DistanceMethodType.SDBox]: 5,
  [DistanceMethodType.SDTorus]: 6,
  [DistanceMethodType.SDCylinder]: 7,
};

export const sdfGLSL = /* glsl */ `
uniform int uMethods[${MAX_METHODS}];
uniform int uMethodCount;
// the scale of the innermost method, the product of all the numbers of the chain
uniform float uScale;
uniform vec3 uCenter;

float sdMethod(int method, vec3 p, float s) {
  vec3 q = p * s;
  switch (method) {
    case ${methodIds.SDGyroid}:
      return sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x);
    case ${methodIds.SDSchwarzP}:
      return cos(q.x) + cos(q.y) + cos(q.z);
    case ${methodIds.SDSchwarzD}:
      return cos(q.x) * cos(q.y) * cos(q.z) - sin(q.x) * sin(q.y) * sin(q.z);
    case ${methodIds.SDNeovius}:
      return 3.0 * (cos(q.x) + cos(q.y) + cos(q.z)) - 4.0 * cos(q.x) * cos(q.y) * cos(q.z);
    case ${methodIds.SDSphere}:
      return length(q) - 1.0;
    case ${methodIds.SDBox}:
      return max(abs(q.x), max(abs(q.y), abs(q.z))) - 1.0;
    case ${methodIds.SDTorus}:
      return length(vec2(length(q.xz) - 1.0, q.y)) - 0.25;
    case ${methodIds.SDCylinder}: {
      float qy = length(q.yz);
      return length(vec2(length(vec2(q.x, qy)) - 1.0, qy));
    }
  }
  return 0.0;
}

// each method's scale is driven by the rest of the chain
float sdf(vec3 position) {
  if (uMethodCount == 0) return 0.0;
  vec3 p = position - uCenter;
  float d = uScale;
  for (int k = uMethodCount - 1; k >= 0; k--) d = sdMethod(uMethods[k], p, d);
  return d;
}
`;

/** whether the method chain fits in the uniforms of the shader */
export const sdfFitsShader = (sdf: IDistanceData): boolean => sdf.methods.length <= MAX_METHODS;

export const sdfUniformValues = (sdf: IDistanceData) => {
  const methods = new Array<number>(MAX_METHODS).fill(0);
  let scale = sdf.scale;
  sdf.methods.slice(0, MAX_METHODS).forEach(({ method, number }, k) => {
    methods[k] = methodIds[method];
    scale *= number;
  });
  return { uMethods: methods, uMethodCount: Math.min(sdf.methods.length, MAX_METHODS), uScale: scale, uCenter: [sdf.center.x, sdf.center.y, sdf.center.z] };
};
