import { IPattern, SvgFields, defaultPattern } from './sdf/tree';
import { compilePattern } from './sdf/evaluate';

import { INSET, fanOffset, supportColumns, supportMaxHeight } from './barMath';
import { createBarFaces, weldedWallVertex } from './barLayout';
import { ITextRelief, reliefHeight } from './text/textField';

export const DEFAULT_COLOR = '#A73A08';

export interface IVector {
  x: number;
  y: number;
  z: number;
}

export interface ITriangularMesh {
  vertices: Float32Array;
  faces: Uint32Array;
  normals: Float32Array;
  color: string;
}

export interface IGeometrySettings {
  innerWidth: number;
  innerLength: number;
  height: number;
  amplitude: number;
  inset: number;
  horizontalDivisions: number;
  verticalDivisions: number;
  basePosition: IVector;
  displayWireframe?: boolean;
  color?: string;
}

export const defaultGeometrySettings: IGeometrySettings = {
  innerWidth: 50,
  innerLength: 50,
  height: 10,
  amplitude: 1,
  inset: -3,
  horizontalDivisions: 500,
  verticalDivisions: 500,
  basePosition: { x: -25, y: 0, z: -25 },
  color: DEFAULT_COLOR,
};

/**
 * Averaged vertex normals of the normalized face normals, counter clockwise triangles face outward (right handed)
 */
export const computeNormals = (vertices: ArrayLike<number>, faces: ArrayLike<number>): Float32Array => {
  const normals = new Float64Array(vertices.length);

  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 3;
    const b = faces[f + 1] * 3;
    const c = faces[f + 2] * 3;

    // (b - a) x (c - a)
    const abx = vertices[b] - vertices[a];
    const aby = vertices[b + 1] - vertices[a + 1];
    const abz = vertices[b + 2] - vertices[a + 2];
    const acx = vertices[c] - vertices[a];
    const acy = vertices[c + 1] - vertices[a + 1];
    const acz = vertices[c + 2] - vertices[a + 2];

    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;

    normals[a] += nx;
    normals[a + 1] += ny;
    normals[a + 2] += nz;
    normals[b] += nx;
    normals[b + 1] += ny;
    normals[b + 2] += nz;
    normals[c] += nx;
    normals[c + 1] += ny;
    normals[c + 2] += nz;
  }

  const result = new Float32Array(normals.length);
  for (let v = 0; v < normals.length; v += 3) {
    const l = Math.sqrt(normals[v] * normals[v] + normals[v + 1] * normals[v + 1] + normals[v + 2] * normals[v + 2]) || 1;
    result[v] = normals[v] / l;
    result[v + 1] = normals[v + 1] / l;
    result[v + 2] = normals[v + 2] / l;
  }
  return result;
};

export const createIMesh = (
  geometrySettings: IGeometrySettings = defaultGeometrySettings,
  sdfSettings: IPattern = defaultPattern(),
  withSupports: boolean = false,
  text?: ITextRelief,
  fields?: SvgFields
): ITriangularMesh => {
  // set the geometry settings
  const { innerWidth, innerLength, height, inset, amplitude, horizontalDivisions, verticalDivisions } = geometrySettings;
  const baseVector: IVector = geometrySettings.basePosition;

  // create the base grid
  const gridWidth = innerWidth / horizontalDivisions;
  const gridLength = innerLength / verticalDivisions;

  const vertexCount = (horizontalDivisions + 1) * (verticalDivisions + 1);

  // top (moved by the pattern) and bottom (base) vertices, flat xyz
  const movedGrid = new Float64Array(vertexCount * 3);
  const baseGrid = new Float64Array(vertexCount * 3);

  const sdf = compilePattern(sdfSettings, fields);

  for (let i = 0; i < horizontalDivisions + 1; i++) {
    for (let j = 0; j < verticalDivisions + 1; j++) {
      const k = (i * (verticalDivisions + 1) + j) * 3;

      const x = baseVector.x + i * gridWidth;
      const y = height;
      const z = baseVector.z + j * gridLength;

      // direction in which the pattern moves the surface, fanning out with the inset
      const dx = fanOffset(i, horizontalDivisions, inset);
      const dy = height;
      const dz = fanOffset(j, verticalDivisions, inset);

      const s = reliefHeight(sdf(x, y, z), amplitude, i * gridWidth, j * gridLength, text) / height;
      movedGrid[k] = x + dx * s;
      movedGrid[k + 1] = y + dy * s;
      movedGrid[k + 2] = z + dz * s;

      baseGrid[k] = x - dx;
      baseGrid[k + 1] = y - dy;
      baseGrid[k + 2] = z - dz;
    }
  }

  // moving around the back for improved back support
  const { counts, jStart, jEnd } = supportColumns(horizontalDivisions, verticalDivisions, gridWidth, withSupports);

  // moves a base vertex towards its top vertex, leaving at least INSET of material
  const raiseBase = (index: number, j: number) => {
    const k = index * 3;
    const dx = movedGrid[k] - baseGrid[k];
    const dy = movedGrid[k + 1] - baseGrid[k + 1];
    const dz = movedGrid[k + 2] - baseGrid[k + 2];
    const dL = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const h = Math.min(supportMaxHeight(gridLength * j, innerLength), dL - INSET);
    const s = h / dL;

    baseGrid[k] += dx * s;
    baseGrid[k + 1] += dy * s;
    baseGrid[k + 2] += dz * s;
  };

  for (let i = 0; i < horizontalDivisions + 1; i++) {
    for (let c = 0; c < counts[i]; c++) {
      for (let j = jStart; j < jEnd; j++) raiseBase(i * (verticalDivisions + 1) + j, j);
    }
  }

  const faces = createBarFaces(horizontalDivisions, verticalDivisions, weldedWallVertex(horizontalDivisions, verticalDivisions));

  // top vertices first, then the bottom ones
  const vertices = new Float32Array(vertexCount * 6);
  vertices.set(movedGrid);
  vertices.set(baseGrid, vertexCount * 3);

  return {
    vertices,
    faces,
    normals: computeNormals(vertices, faces),
    color: geometrySettings.color ?? DEFAULT_COLOR,
  };
};

export const makeMeshTiltOnSide = (mesh: ITriangularMesh, geometrySettings: IGeometrySettings): ITriangularMesh => {
  const angle = Math.atan(geometrySettings.inset / geometrySettings.height);

  const s = Math.sin(angle);
  const c = Math.cos(angle);

  // rotate around the x-axis
  const rotate = (values: Float32Array): Float32Array => {
    const rotated = new Float32Array(values.length);
    for (let i = 0; i < values.length; i += 3) {
      const y = values[i + 1];
      const z = values[i + 2];

      rotated[i] = values[i];
      rotated[i + 1] = y * c - z * s;
      rotated[i + 2] = y * s + z * c;
    }
    return rotated;
  };

  return {
    ...mesh,
    vertices: rotate(mesh.vertices),
    normals: rotate(mesh.normals),
  };
};
