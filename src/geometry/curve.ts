// a base curve in the xz plane: a polyline, or a chain of cubic beziers as in an svg path (M p0 C c1 c2 p1 C c3 c4 p2 ...)

export interface IPoint2 {
  x: number;
  z: number;
}

export type CurveMode = 'polyline' | 'spline';

/** a spline has 3n + 1 points: anchor, control, control, anchor, ... */
export interface ICurve {
  mode: CurveMode;
  points: IPoint2[];
}

export const SAMPLES_PER_SEGMENT = 32;

const lerp = (a: IPoint2, b: IPoint2, t: number): IPoint2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

export const cubicPoint = (p0: IPoint2, c1: IPoint2, c2: IPoint2, p3: IPoint2, t: number): IPoint2 => {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return { x: a * p0.x + b * c1.x + c * c2.x + d * p3.x, z: a * p0.z + b * c1.z + c * c2.z + d * p3.z };
};

export const isAnchor = ({ mode }: ICurve, index: number): boolean => mode === 'polyline' || index % 3 === 0;

export const segmentCount = ({ mode, points }: ICurve): number => Math.max(0, mode === 'polyline' ? points.length - 1 : Math.floor((points.length - 1) / 3));

const segment = ({ points }: ICurve, k: number) => [points[3 * k], points[3 * k + 1], points[3 * k + 2], points[3 * k + 3]] as const;

/** the middle of every segment, where a point can be inserted */
export const segmentMidpoints = (curve: ICurve): IPoint2[] =>
  [...Array(segmentCount(curve)).keys()].map((k) => (curve.mode === 'polyline' ? lerp(curve.points[k], curve.points[k + 1], 0.5) : cubicPoint(...segment(curve, k), 0.5)));

/** the curve as a dense polyline */
export const flatten = (curve: ICurve): IPoint2[] => {
  if (curve.mode === 'polyline') return curve.points.slice();
  const result = curve.points.slice(0, 1);
  for (let k = 0; k < segmentCount(curve); k++) {
    const s = segment(curve, k);
    for (let i = 1; i <= SAMPLES_PER_SEGMENT; i++) result.push(cubicPoint(...s, i / SAMPLES_PER_SEGMENT));
  }
  return result;
};

/** the length along a polyline up to every point */
export const arcLengths = (polyline: IPoint2[]): number[] => {
  const lengths = [0];
  for (let i = 1; i < polyline.length; i++) lengths.push(lengths[i - 1] + Math.hypot(polyline[i].x - polyline[i - 1].x, polyline[i].z - polyline[i - 1].z));
  return lengths;
};

/** the point at length s along a polyline and its unit tangent, before the start and after the end it continues straight */
export const pointAt = (polyline: IPoint2[], lengths: number[], s: number): { point: IPoint2; tangent: IPoint2 } => {
  const last = polyline.length - 1;
  let i = 0;
  while (i < last - 1 && lengths[i + 1] < s) i++;
  const [a, b] = [polyline[i], polyline[Math.min(i + 1, last)]];
  const length = lengths[Math.min(i + 1, last)] - lengths[i];
  const tangent = length > 0 ? { x: (b.x - a.x) / length, z: (b.z - a.z) / length } : { x: 1, z: 0 };
  const along = s - lengths[i];
  return { point: { x: a.x + tangent.x * along, z: a.z + tangent.z * along }, tangent };
};

/** a point in the middle of a segment, the shape of a spline stays the same. Returns the index of the new anchor */
export const insertAt = (curve: ICurve, k: number): { curve: ICurve; index: number } => {
  const points = curve.points.slice();
  if (curve.mode === 'polyline') {
    points.splice(k + 1, 0, lerp(points[k], points[k + 1], 0.5));
    return { curve: { ...curve, points }, index: k + 1 };
  }
  // de casteljau at t = 1/2
  const [p0, c1, c2, p3] = segment(curve, k);
  const [p01, p12, p23] = [lerp(p0, c1, 0.5), lerp(c1, c2, 0.5), lerp(c2, p3, 0.5)];
  const [p012, p123] = [lerp(p01, p12, 0.5), lerp(p12, p23, 0.5)];
  points.splice(3 * k + 1, 2, p01, p012, lerp(p012, p123, 0.5), p123, p23);
  return { curve: { ...curve, points }, index: 3 * k + 3 };
};

/** whether the point can be deleted: an anchor, while the curve keeps at least one segment */
export const canDelete = (curve: ICurve, index: number): boolean => isAnchor(curve, index) && segmentCount(curve) > 1;

/** removes an anchor, the segments on both sides of it become one */
export const deleteAt = (curve: ICurve, index: number): ICurve => {
  if (!canDelete(curve, index)) return curve;
  const points = curve.points.slice();
  if (curve.mode === 'polyline') points.splice(index, 1);
  else if (index === 0) points.splice(0, 3);
  else if (index === points.length - 1) points.splice(index - 2, 3);
  else points.splice(index - 1, 3);
  return { ...curve, points };
};

/** moves a point, the controls of a spline anchor move along with it */
export const moveAt = (curve: ICurve, index: number, to: IPoint2): ICurve => {
  const points = curve.points.slice();
  const from = points[index];
  const [dx, dz] = [to.x - from.x, to.z - from.z];
  const move = (i: number) => points[i] && (points[i] = { x: points[i].x + dx, z: points[i].z + dz });
  move(index);
  if (curve.mode === 'spline' && isAnchor(curve, index)) [index - 1, index + 1].forEach(move);
  return { ...curve, points };
};

/** a polyline gets its controls on the thirds of its segments, a spline keeps its anchors */
export const convert = (curve: ICurve, mode: CurveMode): ICurve => {
  if (curve.mode === mode) return curve;
  if (mode === 'polyline') return { mode, points: curve.points.filter((_, i) => i % 3 === 0) };
  const points = curve.points.slice(0, 1);
  for (let i = 1; i < curve.points.length; i++) {
    const [a, b] = [curve.points[i - 1], curve.points[i]];
    points.push(lerp(a, b, 1 / 3), lerp(a, b, 2 / 3), b);
  }
  return { mode, points };
};

/** a straight curve of the given length along x, centred on the origin */
export const straightCurve = (mode: CurveMode, length: number): ICurve =>
  convert({ mode: 'polyline', points: [{ x: -length / 2, z: 0 }, { x: length / 2, z: 0 }] }, mode);
