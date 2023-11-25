import { Vector3 } from '@babylonjs/core';

const tolerance = 0.0001;

export const sdGyroid = (v: Vector3, scale = 1) =>
  Math.sin(v.x * scale) * Math.cos(v.y * scale) + Math.sin(v.y * scale) * Math.cos(v.z * scale) + Math.sin(v.z * scale) * Math.cos(v.x * scale);
export const sdSchwarzP = (v: Vector3, scale = 1) => Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale);
export const sdSchwarzD = (v: Vector3, scale = 1) =>
  Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale) - Math.sin(v.x * scale) * Math.sin(v.y * scale) * Math.sin(v.z * scale);
export const sdNeovius = (v: Vector3, scale = 1) =>
  3 * (Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale)) - 4 * Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale);

export const sdSphere = (v: Vector3, scale = 1, c: Vector3 = new Vector3(0, 0, 0)) => v.subtract(c).scale(scale).length() - 1;
export const sdBox = (v: Vector3, scale = 1) => Math.max(Math.abs(v.x * scale), Math.abs(v.y * scale), Math.abs(v.z * scale)) - 1;
export const sdTorus = (v: Vector3, scale = 1) => {
  const r1 = 1;
  const r2 = 0.25;
  const q = new Vector3(new Vector3(v.x * scale, v.z * scale).length() - r1, v.y * scale);
  return q.length() - r2;
};
export const sdCylinder = (v: Vector3, scale = 1) => {
  const r = 1;
  const q = new Vector3(v.x * scale, new Vector3(v.y * scale, v.z * scale).length());
  return new Vector3(q.length() - r, q.y).length();
};

export const sdLineParametric = (v: Vector3, v0: Vector3, d: Vector3): { t: number; sign: -1 | 1; distance: number } => {
  const n = new Vector3(-d.z, 0, d.x);
  const vD = v.subtract(v0);
  const t = Vector3.Dot(vD, d) / d.lengthSquared();
  const tN = Vector3.Dot(vD, n);
  return { t, sign: tN < 0 ? -1 : 1, distance: v.subtract(v0.add(d.scale(t))).length() };
};

export const sdBoolean = (d0: number, d1: number): number => Math.min(d0, d1);
export const sdDifference = (d0: number, d1: number): number => Math.max(-d0, d1);
export const sdIntersection = (d0: number, d1: number): number => Math.max(d0, d1);

export const sdHalfSpaceLine = (p: Vector3, p0: Vector3, p1: Vector3): number => {
  const dir = p1.subtract(p0);
  const n = new Vector3(-dir.z, 0, dir.x).normalize();

  return Vector3.Dot(p.subtract(p0), n);
};

export const sdCircleSegment = (p: Vector3, c: Vector3, p0: Vector3, p1: Vector3): number => {
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
  // const dl0 = -sdHalfSpaceLine(p, c, p0);
  // const dl1 = sdHalfSpaceLine(p, c, p1);
  // const dl = sdIntersection(dl0, dl1);
  // return dc;
  // return sdBoolean(dl, dc);
  // return sdBoolean(p.subtract(p0).length(), p.subtract(p1).length());
  // return sdBoolean(dl, dc);
  if (dl > 0.0) return sdBoolean(p.subtract(p0).length(), p.subtract(p1).length());
  return dc;
};

export const sdLine = (v: Vector3, v0: Vector3, v1: Vector3): number => {
  const { sign, distance } = sdLineParametric(v, v0, v1.subtract(v0));
  return sign * distance;
};

export const sdCurtailedLine = (v: Vector3, v0: Vector3, v1: Vector3): number => {
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
 * @param normal normal vector (defaults to global Z)
 */
export const vectorInPolygon = (v: Vector3, vs: Vector3[], normal: Vector3 = new Vector3(0, 1, 0)): boolean => {
  // we add the angle sum of all segments with the point. If this is 2PI, the point is inside. If it is 0, the point is outside.
  let angleSum = 0;
  for (let i = 0; i < vs.length; i++) {
    const p1 = vs[i];
    const p2 = vs[(i + 1) % vs.length];
    // if the point is on the segment, we return "preferIn"
    if (sdCurtailedLine(v, p1, p2) < tolerance) return true;
    const v1 = p1.subtract(v);
    const v2 = p2.subtract(v);
    let ang = Vector3.GetAngleBetweenVectors(v1, v2, v);
    if (Vector3.Dot(Vector3.Cross(v1, v2), normal) < 0) ang *= -1;
    angleSum += ang;
  }
  return Math.abs(angleSum) > Math.PI; // this will be negative if the curve is CW
};

/**
 * Computes the area of a closed polyline
 *
 * @param points the vertices of a closed polyline. Will be projected to XY plane (the Z coordinate is ignored)
 * @returns signed polygon area (negative if clockwise)
 */
const signedPolygonArea = (points: Vector3[]): number => {
  // Polygon area formula: ((x1y2 - x2y1) + (x2y3 - x3y2) + ... + (xny1 - x1yn)) / 2
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += p1.x * p2.z - p2.x * p1.z;
  }
  return area * 0.5;
};

export const sdCurtailedPolyLine = (v: Vector3, vs: Vector3[], closed?: boolean): number => {
  let d = Infinity;
  for (let i = 0; i < vs.length - (closed ? 0 : 1); i++) d = Math.min(d, sdCurtailedLine(v, vs[i], vs[(i + 1) % vs.length]));
  return closed ? (vectorInPolygon(v, vs) ? -1 : 1 * d) : d;
};

export const sdCircle = (v: Vector3, c: Vector3, radius: number) => v.subtract(c).length() - radius;
const cs = [
  [new Vector3(18, 0, -86), 100, -1],
  [new Vector3(20, 0, -119), 150, -1],
  [new Vector3(214, 0, -23), 198, -1],
  [new Vector3(187, 0, -45), 160, -1],
  [new Vector3(159, 0, -76), 134, -1],
  [new Vector3(-209, 0, -34), 200, -1],
  [new Vector3(-178, 0, -58), 160, -1],
] as [Vector3, number, -1 | 1][];

const cSs = [
  [new Vector3(34.998646, 0, 44.265769), 8.17819, 1],
  [new Vector3(48.144327, 0, 40.597789), 5.469631, -1],
  [new Vector3(63.76365, 0, 36.726881), 10.622204, 1],
  [new Vector3(56.868644, 0, 20.942161), 6.602734, -1],
  [new Vector3(42.900881, 0, 9.008452), 11.768761, 1],
  [new Vector3(31.02926, 0, 26.862558), 9.671959, -1],
] as [Vector3, number, -1 | 1][];

const plg = [
  new Vector3(42.875937, 0, 42.067799),
  new Vector3(53.45335, 0, 39.282063),
  new Vector3(59.511664, 0, 26.992825),
  new Vector3(51.848616, 0, 16.653174),
  new Vector3(36.384576, 0, 18.808529),
  new Vector3(33.180035, 0, 36.292349),
].reverse();

const curvePolygon = (v: Vector3) => {
  const cDs = cSs.map(([c, r, m]) => -m * sdCircle(v, c.scale(s), r));
  let d = sdCurtailedPolyLine(
    v,
    plg.map((v) => v.scale(s)),
    true
  );
  // d = 0;
  cDs.forEach((cD, i) => {
    if (i % 2 === 0) d = sdBoolean(d, cD);
    if (i % 2 === 1) d = sdDifference(d, cD);
  });

  return -d;
};

const vs = [new Vector3(0, 0, 0), new Vector3(0, 0, 100), new Vector3(200, 0, 200), new Vector3(100, 0, 300)];

const vShift = new Vector3(40, 0, 80);
const l0 = new Vector3(3, 0, 0);
const ld = new Vector3(5, 0, 100);
const s = 1;

const sideMap = (n: number): number => (Math.abs(n) + n * 0.5) / 1.5;

export const sdGeometry = (p: Vector3): number => {
  const v = p.subtract(vShift).scale(0.5);
  v.y = 0;

  let d = 1000;
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(28.5496441825, 0, -49.876256281),
      new Vector3(34.8625303151, 0, -37.193994026),
      new Vector3(38.8436252875, 0, -40.1435146201)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(41.8864249142, 0, -37.2984497859),
      new Vector3(38.8436252875, 0, -40.1435146201),
      new Vector3(42.4549136739, 0, -41.4251729422)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(39.9981623366, 0, -19.6195055984),
      new Vector3(42.4549136739, 0, -41.4251729422),
      new Vector3(51.3746058391, 0, -38.3838145033)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(21.5765506077, 0, 22.3202460519),
      new Vector3(51.3746058391, 0, -38.3838145033),
      new Vector3(60.4919276317, 0, -32.9834653474)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(59.343132455, 0, -30.9845269838),
      new Vector3(60.4919276317, 0, -32.9834653474),
      new Vector3(61.6206770219, 0, -30.6263710325)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(47.5342918149, 0, -31.6293162903),
      new Vector3(61.6206770219, 0, -30.6263710325),
      new Vector3(58.6953831712, 0, -22.9770225408)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(41.2841284545, 0, -36.6666584225),
      new Vector3(58.6953831712, 0, -22.9770225408),
      new Vector3(50.6092677933, 0, -16.5768675402)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(45.9244459658, 0, -26.9009237664),
      new Vector3(50.6092677933, 0, -16.5768675402),
      new Vector3(40.9776008829, 0, -16.6998249901)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(59.6239994368, 0, -46.7553455874),
      new Vector3(40.9776008829, 0, -16.6998249901),
      new Vector3(29.2423952351, 0, -28.6451102621)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vector3(38.9973256731, 0, -35.90241029), new Vector3(29.2423952351, 0, -28.6451102621), new Vector3(27.1953230731, 0, -32.980115614))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(28.8765423944, 0, -33.6521131325),
      new Vector3(27.1953230731, 0, -32.980115614),
      new Vector3(28.4054088164, 0, -35.4002871007)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(25.5538778852, 0, -60.3808688004),
      new Vector3(28.4054088164, 0, -35.4002871007),
      new Vector3(32.575027363, 0, -36.2382891802)
    )
  );
  d = sdBoolean(
    d,
    sdCircleSegment(
      v,
      new Vector3(30.0956308923, 0, -45.3882349389),
      new Vector3(32.575027363, 0, -36.2382891802),
      new Vector3(34.8625303151, 0, -37.193994026)
    )
  );

  return sideMap((d * 0.5) % 1);

  return d;
};

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

export interface IMethodEntry {
  method: DistanceMethodType;
  number: number;
}

export interface IDistanceData {
  methods: IMethodEntry[];
  scale: number;
}

const distanceMap = (dm: DistanceMethodType): ((v: Vector3, s: number) => number) => {
  switch (dm) {
    case DistanceMethodType.SDGyroid:
      return sdGyroid;
    case DistanceMethodType.SDSchwarzP:
      return sdSchwarzP;
    case DistanceMethodType.SDSchwarzD:
      return sdSchwarzD;
    case DistanceMethodType.SDNeovius:
      return sdNeovius;
    case DistanceMethodType.SDSphere:
      return sdSphere;
    case DistanceMethodType.SDBox:
      return sdBox;
    case DistanceMethodType.SDTorus:
      return sdTorus;
    case DistanceMethodType.SDCylinder:
      return sdCylinder;
  }
};

const stringDistanceParser = (dm: DistanceMethodType): string => {
  switch (dm) {
    case DistanceMethodType.SDGyroid:
      return 'sdGyroid';
    case DistanceMethodType.SDSchwarzP:
      return 'sdSchwarzP';
    case DistanceMethodType.SDSchwarzD:
      return 'sdSchwarzD';
    case DistanceMethodType.SDNeovius:
      return 'sdNeovius';
    case DistanceMethodType.SDSphere:
      return 'sdSphere';
    case DistanceMethodType.SDBox:
      return 'sdBox';
    case DistanceMethodType.SDTorus:
      return 'sdTorus';
    case DistanceMethodType.SDCylinder:
      return 'sdCylinder';
  }
};

const localDistanceAsStringParser = (methods: IMethodEntry[]): ((v: Vector3, s: number) => number) => {
  const strings = ['const v0 = v.scale(s);', 'let d = 0;'];
  strings.push(...methods.map((m) => `d = (${distanceMap(m.method)})(v0, d * ${m.number});`));
  strings.push('return d;');
  // console.log(strings.join('\n'));
  return new Function('v', 's', strings.join('\n')) as (v: Vector3, s: number) => number;
};

const localDistanceParser = (methods: IMethodEntry[]): ((v: Vector3, s: number) => number) => {
  if (methods.length === 0) {
    return () => 0;
  } else if (methods.length === 1) {
    return (v: Vector3, s: number) => distanceMap(methods[0].method)(v, s * methods[0].number);
  } else {
    return (v: Vector3, s: number) => distanceMap(methods[0].method)(v, localDistanceParser(methods.slice(1))(v, s * methods[0].number));
  }
};

export const defaultDistanceData: IDistanceData = {
  methods: [
    {
      method: DistanceMethodType.SDNeovius,
      number: 0.004,
    },
    {
      method: DistanceMethodType.SDSchwarzD,
      number: 8.5,
    },
  ],
  scale: 1,
};

// export const DistanceMethodParser =
//   (iDD: IDistanceData): ((v: Vector3) => number) =>
//   (v: Vector3) =>
//     localDistanceAsStringParser(iDD.methods)(v, iDD.scale);

export const DistanceMethodParser = (iDD: IDistanceData): ((v: Vector3) => number) => {
  // console.log(localDistanceAsStringParser(iDD.methods));
  return (v: Vector3) => sdGeometry(v) * 0.1; // Math.min(localDistanceParser(iDD.methods)(v, iDD.scale) * 0.1, sdGeometry(v));
};

export type DistanceMethod = (v: Vector3) => number;
export const defaultDistanceMethod: DistanceMethod = DistanceMethodParser(defaultDistanceData);
