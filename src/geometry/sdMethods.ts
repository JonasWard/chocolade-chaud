import { Vec2 } from './vec2';

const tolerance = 0.0001;

// 3d methods, work on plain numbers so sampling a grid does not allocate
export type ScaledDistanceMethod = (x: number, y: number, z: number, scale: number) => number;

export const sdGyroid: ScaledDistanceMethod = (x, y, z, s) =>
  Math.sin(x * s) * Math.cos(y * s) + Math.sin(y * s) * Math.cos(z * s) + Math.sin(z * s) * Math.cos(x * s);
export const sdSchwarzP: ScaledDistanceMethod = (x, y, z, s) => Math.cos(x * s) + Math.cos(y * s) + Math.cos(z * s);
export const sdSchwarzD: ScaledDistanceMethod = (x, y, z, s) =>
  Math.cos(x * s) * Math.cos(y * s) * Math.cos(z * s) - Math.sin(x * s) * Math.sin(y * s) * Math.sin(z * s);
export const sdNeovius: ScaledDistanceMethod = (x, y, z, s) =>
  3 * (Math.cos(x * s) + Math.cos(y * s) + Math.cos(z * s)) - 4 * Math.cos(x * s) * Math.cos(y * s) * Math.cos(z * s);

const length2 = (a: number, b: number) => Math.sqrt(a * a + b * b);
const length3 = (a: number, b: number, c: number) => Math.sqrt(a * a + b * b + c * c);

export const sdSphere: ScaledDistanceMethod = (x, y, z, s) => length3(x * s, y * s, z * s) - 1;
export const sdBox: ScaledDistanceMethod = (x, y, z, s) => Math.max(Math.abs(x * s), Math.abs(y * s), Math.abs(z * s)) - 1;
export const sdTorus: ScaledDistanceMethod = (x, y, z, s) => {
  const r1 = 1;
  const r2 = 0.25;
  return length2(length2(x * s, z * s) - r1, y * s) - r2;
};
export const sdCylinder: ScaledDistanceMethod = (x, y, z, s) => {
  const r = 1;
  const qy = length2(y * s, z * s);
  return length2(length2(x * s, qy) - r, qy);
};

export const sdBoolean = (d0: number, d1: number): number => Math.min(d0, d1);
export const sdDifference = (d0: number, d1: number): number => Math.max(-d0, d1);
export const sdIntersection = (d0: number, d1: number): number => Math.max(d0, d1);

// 2d methods
export const sdLineParametric = (v: Vec2, v0: Vec2, d: Vec2): { t: number; sign: -1 | 1; distance: number } => {
  const n = new Vec2(-d.y, d.x);
  const vD = v.subtract(v0);
  const t = Vec2.Dot(vD, d) / d.lengthSquared();
  const tN = Vec2.Dot(vD, n);
  return { t, sign: tN < 0 ? -1 : 1, distance: v.subtract(v0.add(d.scale(t))).length() };
};

export const sdHalfSpaceLine = (p: Vec2, p0: Vec2, p1: Vec2): number => {
  const dir = p1.subtract(p0);
  const n = new Vec2(-dir.y, dir.x).normalize();

  return Vec2.Dot(p.subtract(p0), n);
};

export const sdCircleSegment = (p: Vec2, c: Vec2, p0: Vec2, p1: Vec2): number => {
  const dc = Math.abs(sdCircle(p, c, c.subtract(p0).length()));
  let dl: number;

  if (sdHalfSpaceLine(c, p0, p1) > 0.0) {
    const dl0 = sdHalfSpaceLine(p, c, p1);
    const dl1 = -sdHalfSpaceLine(p, c, p0);
    dl = sdIntersection(dl0, dl1);
  } else {
    const dl0 = -sdHalfSpaceLine(p, c, p1);
    const dl1 = sdHalfSpaceLine(p, c, p0);
    dl = sdIntersection(dl0, dl1);
  }
  if (dl > 0.0) return sdBoolean(p.subtract(p0).length(), p.subtract(p1).length());
  return dc;
};

export const sdLine = (v: Vec2, v0: Vec2, v1: Vec2): number => {
  const { sign, distance } = sdLineParametric(v, v0, v1.subtract(v0));
  return sign * distance;
};

export const sdCurtailedLine = (v: Vec2, v0: Vec2, v1: Vec2): number => {
  const d = v1.subtract(v0);
  const { t, distance } = sdLineParametric(v, v0, d);
  if (t <= 0) return v.subtract(v0).length();
  if (t >= 1) return v.subtract(v1).length();
  return distance;
};

/**
 * Checks if a point is inside of a closed polyline
 *
 * @param v the point to test
 * @param vs the closed polyline. Curve direction does not matter!
 */
export const vectorInPolygon = (v: Vec2, vs: Vec2[]): boolean => {
  // we add the signed angles the segments span as seen from the point. If this is +-2PI, the point is inside. If it is 0, the point is outside.
  let angleSum = 0;
  for (let i = 0; i < vs.length; i++) {
    const p1 = vs[i];
    const p2 = vs[(i + 1) % vs.length];
    // if the point is on the segment, we return "preferIn"
    if (sdCurtailedLine(v, p1, p2) < tolerance) return true;
    const v1 = p1.subtract(v);
    const v2 = p2.subtract(v);
    angleSum += Math.atan2(Vec2.Cross(v1, v2), Vec2.Dot(v1, v2));
  }
  return Math.abs(angleSum) > Math.PI; // this will be negative if the curve is CW
};

export const sdCurtailedPolyLine = (v: Vec2, vs: Vec2[], closed?: boolean): number => {
  let d = Infinity;
  for (let i = 0; i < vs.length - (closed ? 0 : 1); i++) d = Math.min(d, sdCurtailedLine(v, vs[i], vs[(i + 1) % vs.length]));
  return closed && vectorInPolygon(v, vs) ? -d : d;
};

export const sdCircle = (v: Vec2, c: Vec2, radius: number) => v.subtract(c).length() - radius;

export enum DistanceMethodType {
  SDGyroid = 'SDGyroid',
  SDSchwarzP = 'SDSchwarzP',
  SDSchwarzD = 'SDSchwarzD',
  SDNeovius = 'SDNeovius',
  SDSphere = 'SDSphere',
  SDBox = 'SDBox',
  SDTorus = 'SDTorus',
  SDCylinder = 'SDCylinder',
}

export const distanceMethods: Record<DistanceMethodType, ScaledDistanceMethod> = {
  [DistanceMethodType.SDGyroid]: sdGyroid,
  [DistanceMethodType.SDSchwarzP]: sdSchwarzP,
  [DistanceMethodType.SDSchwarzD]: sdSchwarzD,
  [DistanceMethodType.SDNeovius]: sdNeovius,
  [DistanceMethodType.SDSphere]: sdSphere,
  [DistanceMethodType.SDBox]: sdBox,
  [DistanceMethodType.SDTorus]: sdTorus,
  [DistanceMethodType.SDCylinder]: sdCylinder,
};

export type DistanceMethod = (x: number, y: number, z: number) => number;
