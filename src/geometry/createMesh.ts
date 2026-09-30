import { DistanceMethodParser, IDistanceData, defaultDistanceData } from './sdMethods';

const SPACING_LENGTH = 8.0;
const START_LENGTH = 2.5;
const GRADIENT = 0.5;
const INSET = 2.9;

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
 * Averaged vertex normals of the normalized face normals, same convention as babylon's VertexData.ComputeNormals
 */
export const computeNormals = (vertices: ArrayLike<number>, faces: ArrayLike<number>): Float32Array => {
  const normals = new Float64Array(vertices.length);

  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 3;
    const b = faces[f + 1] * 3;
    const c = faces[f + 2] * 3;

    const abx = vertices[a] - vertices[b];
    const aby = vertices[a + 1] - vertices[b + 1];
    const abz = vertices[a + 2] - vertices[b + 2];
    const cbx = vertices[c] - vertices[b];
    const cby = vertices[c + 1] - vertices[b + 1];
    const cbz = vertices[c + 2] - vertices[b + 2];

    let nx = aby * cbz - abz * cby;
    let ny = abz * cbx - abx * cbz;
    let nz = abx * cby - aby * cbx;
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
  sdfSettings: IDistanceData = defaultDistanceData,
  withSupports: boolean = false
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

  const sdf = DistanceMethodParser(sdfSettings);

  for (let i = 0; i < horizontalDivisions + 1; i++) {
    for (let j = 0; j < verticalDivisions + 1; j++) {
      const k = (i * (verticalDivisions + 1) + j) * 3;

      const x = baseVector.x + i * gridWidth;
      const y = height;
      const z = baseVector.z + j * gridLength;

      // direction in which the pattern moves the surface, fanning out with the inset
      const dx = (i * inset * 2) / (horizontalDivisions + 1) - inset;
      const dy = height;
      const dz = (j * inset * 2) / (verticalDivisions + 1) - inset;

      const s = (sdf(x, y, z) * amplitude) / height;
      movedGrid[k] = x + dx * s;
      movedGrid[k + 1] = y + dy * s;
      movedGrid[k + 2] = z + dz * s;

      baseGrid[k] = x - dx;
      baseGrid[k + 1] = y - dy;
      baseGrid[k + 2] = z - dz;
    }
  }

  // moving around the back for improved back support
  // first of all, only add backsupport if the back resolution is higher than 1/4 of the spacing
  const horizontalDivisionsResolution = Math.floor(SPACING_LENGTH / gridWidth);
  const supportStart = Math.ceil(START_LENGTH / gridWidth);
  const openingWidth = Math.ceil(1.5 / gridWidth);

  if (withSupports && gridWidth < SPACING_LENGTH / 4) {
    // helper method that returns the maximum height for a given location
    const maxHMethod = (j: number): number => {
      const l = gridLength * j;
      return Math.max(0, (innerLength / 2 - Math.abs(l - innerLength / 2) - START_LENGTH) * GRADIENT); // switch to negative value to visualize on the outside support geometry
    };

    // moves a base vertex towards its top vertex, leaving at least INSET of material
    const raiseBase = (index: number, j: number) => {
      const k = index * 3;
      const dx = movedGrid[k] - baseGrid[k];
      const dy = movedGrid[k + 1] - baseGrid[k + 1];
      const dz = movedGrid[k + 2] - baseGrid[k + 2];
      const dL = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const h = Math.min(maxHMethod(j), dL - INSET);
      const s = h / dL;

      baseGrid[k] += dx * s;
      baseGrid[k + 1] += dy * s;
      baseGrid[k + 2] += dz * s;
    };

    if (gridWidth < SPACING_LENGTH / 10) {
      for (let i = supportStart; i < horizontalDivisions - supportStart; i += 1) {
        if (i % horizontalDivisionsResolution === 0) {
          i += openingWidth;
          continue;
        }
        for (let j = 1; j < verticalDivisions; j++) {
          raiseBase(i * (verticalDivisions + 1) + j, j);
          raiseBase((i + 1) * (verticalDivisions + 1) + j, j);
        }
      }
    } else {
      for (let i = 0; i < horizontalDivisions; i++) {
        for (let j = 0; j < verticalDivisions; j++) raiseBase(i * (verticalDivisions + 1) + j, j);
      }
    }
  }

  // create the faces, 4 triangles per quad (top and bottom) and 4 per side segment
  const faces = new Uint32Array(3 * (4 * horizontalDivisions * verticalDivisions + 4 * (horizontalDivisions + verticalDivisions)));
  let f = 0;
  const tri = (a: number, b: number, c: number) => {
    faces[f++] = a;
    faces[f++] = b;
    faces[f++] = c;
  };

  // top and bottom faces
  for (let i = 0; i < horizontalDivisions; i++) {
    for (let j = 0; j < verticalDivisions; j++) {
      const index = i * (verticalDivisions + 1) + j;
      const nextIndex = (i + 1) * (verticalDivisions + 1) + j;
      // splitting quad into two triangles
      if ((i + j) % 2 === 0) {
        tri(index, nextIndex, index + 1);
        tri(index + 1, nextIndex, nextIndex + 1);

        tri(vertexCount + index, vertexCount + index + 1, vertexCount + nextIndex);
        tri(vertexCount + index + 1, vertexCount + nextIndex + 1, vertexCount + nextIndex);
      } else {
        tri(index, nextIndex + 1, index + 1);
        tri(index, nextIndex, nextIndex + 1);

        tri(vertexCount + index, vertexCount + index + 1, vertexCount + nextIndex + 1);
        tri(vertexCount + index, vertexCount + nextIndex + 1, vertexCount + nextIndex);
      }
    }
  }

  // add side faces
  for (let i = 0; i < verticalDivisions; i++) {
    const bottomIndex = i;
    const topIndex = i + vertexCount;

    if (i % 2 === 0) {
      tri(bottomIndex, bottomIndex + 1, topIndex);
      tri(bottomIndex + 1, topIndex + 1, topIndex);
    } else {
      tri(bottomIndex, bottomIndex + 1, topIndex + 1);
      tri(bottomIndex, topIndex + 1, topIndex);
    }

    const endBottomIndex = topIndex - verticalDivisions - 1;
    const endTopIndex = endBottomIndex + vertexCount;

    if ((i + horizontalDivisions) % 2 === 0) {
      tri(endBottomIndex, endTopIndex, endBottomIndex + 1);
      tri(endBottomIndex + 1, endTopIndex, endTopIndex + 1);
    } else {
      tri(endBottomIndex, endTopIndex + 1, endBottomIndex + 1);
      tri(endBottomIndex, endTopIndex, endTopIndex + 1);
    }
  }

  for (let i = 0; i < horizontalDivisions; i++) {
    const bottomIndex = i * (verticalDivisions + 1);
    const topIndex = bottomIndex + vertexCount;

    if (i % 2 === 0) {
      tri(bottomIndex, topIndex, bottomIndex + verticalDivisions + 1);
      tri(bottomIndex + verticalDivisions + 1, topIndex, topIndex + verticalDivisions + 1);
    } else {
      tri(bottomIndex, topIndex + verticalDivisions + 1, bottomIndex + verticalDivisions + 1);
      tri(bottomIndex, topIndex, topIndex + verticalDivisions + 1);
    }

    const endBottomIndex = bottomIndex + verticalDivisions;
    const endTopIndex = endBottomIndex + vertexCount;

    if ((i + verticalDivisions) % 2 === 0) {
      tri(endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex);
      tri(endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1, endTopIndex);
    } else {
      tri(endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1);
      tri(endBottomIndex, endTopIndex + verticalDivisions + 1, endTopIndex);
    }
  }

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
