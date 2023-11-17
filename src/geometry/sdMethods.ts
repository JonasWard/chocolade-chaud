import { Vector3 } from '@babylonjs/core';
import { IVector } from './createMesh';

export const sdGyroid = (v: Vector3, scale = 1) =>
  Math.sin(v.x * scale) * Math.cos(v.y * scale) + Math.sin(v.y * scale) * Math.cos(v.z * scale) + Math.sin(v.z * scale) * Math.cos(v.x * scale);
export const sdSchwarzP = (v: Vector3, scale = 1) => Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale);
export const sdSchwarzD = (v: Vector3, scale = 1) =>
  Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale) - Math.sin(v.x * scale) * Math.sin(v.y * scale) * Math.sin(v.z * scale);
export const sdNeovius = (v: Vector3, scale = 1) =>
  3 * (Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale)) - 4 * Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale);

export const sdSphere = (v: Vector3, scale = 1) => v.scale(scale).length() - 1;
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

export const sdLine = (v: Vector3, v0: Vector3, d: Vector3): number => Vector3.Dot(v.subtract(v0), d);

export const sdBoolean = (d0: number, d1: number): number => Math.min(d0, d1);
export const sdDifference = (d0: number, d1: number): number => Math.max(-d0, d1);
export const sdIntersection = (d0: number, d1: number): number => Math.max(d0, d1);

export const sdCircle = (v: Vector3, position: Vector3, radius: number) => v.subtract(position).length() - radius;
const cs = [
  [new Vector3(18, 0, -86), 100],
  [new Vector3(20, 0, -119), 150],
  [new Vector3(214, 0, -23), 198],
  [new Vector3(187, 0, -45), 160],
  [new Vector3(159, 0, -76), 134],
  [new Vector3(-209, 0, -34), 200],
  [new Vector3(-178, 0, -58), 160],
] as [Vector3, number][];

const vShift = new Vector3(80, 0, 0);
const l0 = new Vector3(3, 0, 0);
const ld = new Vector3(100, 0, 5).normalize();
const s = 1;

const sideMap = (n: number): number => (Math.abs(n) + n * 0.5) / 1.5;

export const sdGeometry = (v: Vector3): number => {
  const locV = new Vector3(v.x, 0, v.z).subtract(vShift);
  const l = sideMap(sdLine(locV, l0.scale(s), ld));
  const cDs = cs.map(([c, r]) => sideMap(sdCircle(locV, c.scale(s), r * s))).reduce((a, b) => sdBoolean(a, b));
  const d = sdBoolean(l, cDs);
  return d - 2;
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
      method: DistanceMethodType.SDSchwarzP,
      number: 0.05,
    },
    {
      method: DistanceMethodType.SDGyroid,
      number: 2.5,
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
  return (v: Vector3) => Math.min(localDistanceParser(iDD.methods)(v, iDD.scale) * 0.3, sdGeometry(v));
};

export type DistanceMethod = (v: Vector3) => number;
export const defaultDistanceMethod: DistanceMethod = DistanceMethodParser(defaultDistanceData);
