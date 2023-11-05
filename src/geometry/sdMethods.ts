import { Vector3 } from '@babylonjs/core';

export const sdGyroid = (v: Vector3, scale = 1) =>
  Math.sin(v.x * scale) * Math.cos(v.y * scale) + Math.sin(v.y * scale) * Math.cos(v.z * scale) + Math.sin(v.z * scale) * Math.cos(v.x * scale);
export const sdSchwarzP = (v: Vector3, scale = 1) => Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale);
export const sdSchwarzD = (v: Vector3, scale = 1) =>
  Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale) - Math.sin(v.x * scale) * Math.sin(v.y * scale) * Math.sin(v.z * scale);
export const sdNeovius = (v: Vector3, scale = 1) =>
  3 * (Math.cos(v.x * scale) + Math.cos(v.y * scale) + Math.cos(v.z * scale)) - 4 * Math.cos(v.x * scale) * Math.cos(v.y * scale) * Math.cos(v.z * scale);

export const sdSphere = (v: Vector3, scale = 1) => v.length() - 1;
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
      method: DistanceMethodType.SDGyroid,
      number: 1,
    },
    {
      method: DistanceMethodType.SDNeovius,
      number: 1,
    },
  ],
  scale: 1,
};

export const DistanceMethodParser =
  (iDD: IDistanceData): ((v: Vector3) => number) =>
  (v: Vector3) =>
    localDistanceParser(iDD.methods)(v.scale(iDD.scale));

export type DistanceMethod = (v: Vector3) => number;
export const defaultDistanceMethod: DistanceMethod = DistanceMethodParser(defaultDistanceData);
