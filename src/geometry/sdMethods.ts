import { Vector3 } from '@babylonjs/core';

export const sdGyroid = (v: Vector3) => Math.sin(v.x) * Math.cos(v.y) + Math.sin(v.y) * Math.cos(v.z) + Math.sin(v.z) * Math.cos(v.x);
export const sdSchwarzP = (v: Vector3) => Math.cos(v.x) + Math.cos(v.y) + Math.cos(v.z);
export const sdSchwarzD = (v: Vector3) => Math.cos(v.x) * Math.cos(v.y) * Math.cos(v.z) - Math.sin(v.x) * Math.sin(v.y) * Math.sin(v.z);
export const sdNeovius = (v: Vector3) => 3 * sdSchwarzP(v) - 4 * Math.cos(v.x) * Math.cos(v.y) * Math.cos(v.z);

export const sdSphere = (v: Vector3) => v.length() - 1;
export const sdBox = (v: Vector3) => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) - 1;
export const sdTorus = (v: Vector3) => {
  const r1 = 1;
  const r2 = 0.25;
  const q = new Vector3(new Vector3(v.x, v.z).length() - r1, v.y);
  return q.length() - r2;
};
export const sdCylinder = (v: Vector3) => {
  const r = 1;
  const q = new Vector3(v.x, new Vector3(v.y, v.z).length());
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

const distanceMap = (dm: DistanceMethodType): ((v: Vector3) => number) => {
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

const localDistanceParser = (methods: IMethodEntry[]): ((v: Vector3) => number) => {
  if (methods.length === 0) {
    return () => 0;
  } else if (methods.length === 1) {
    return (v: Vector3) => distanceMap(methods[0].method)(v.scale(methods[0].number ?? 1));
  } else {
    return (v: Vector3) => distanceMap(methods[0].method)(v.scale((methods[0].number ?? 1) * localDistanceParser(methods.slice(1))(v)));
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
