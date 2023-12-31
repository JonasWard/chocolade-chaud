import { Color3, Mesh, PBRMetallicRoughnessMaterial, Scene, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import { DistanceMethodParser, IDistanceData, defaultDistanceData } from './sdMethods';
import { GridParser, IGridSettings } from './grid';

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
  vertices: number[];
  faces: number[];
  normals: number[];
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

export const createMeshForGrid = (scene: Scene, grid: IGridSettings, cleanScene: boolean = true) => {
  if (cleanScene)
    while (scene.meshes.length) {
      const mesh = scene.meshes[0];
      mesh.dispose();
    }
  const meshes = GridParser(grid, undefined, true);
  meshes.map((m, i) => addMeshToScene(m, scene, undefined, `mesh-${i}`));
};

export const createMesh = (
  scene: Scene,
  geometrySettings: IGeometrySettings = defaultGeometrySettings,
  sdfSettings: IDistanceData,
  cleanScene: boolean = true
) => {
  if (cleanScene) scene.meshes.forEach((m) => m.dispose());
  const iMesh = createIMesh(geometrySettings, sdfSettings);
  addMeshToScene(iMesh, scene, geometrySettings);
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

  const insetMethod = (i: number, j: number): Vector3 => {
    return new Vector3((i * inset * 2) / (horizontalDivisions + 1) - inset, height, (j * inset * 2) / (verticalDivisions + 1) - inset);
  };

  const grid: Vector3[] = [];
  const directionGrid: Vector3[] = [];

  for (let i = 0; i < horizontalDivisions + 1; i++) {
    for (let j = 0; j < verticalDivisions + 1; j++) {
      grid.push(new Vector3(baseVector.x + i * gridWidth, height, baseVector.z + j * gridLength));
      directionGrid.push(insetMethod(i, j));
    }
  }

  const sdf = DistanceMethodParser(sdfSettings);

  const movedGrid = grid.map((v, i) => v.add(directionGrid[i].scale((sdf(v) * amplitude) / height)));
  const baseGrid = grid.map((v, i) => v.subtract(directionGrid[i]));

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

    const scales: number[] = [];

    if (gridWidth < SPACING_LENGTH / 10) {
      for (let i = supportStart; i < horizontalDivisions - supportStart; i += 1) {
        if (i % horizontalDivisionsResolution === 0) {
          i += openingWidth;
          continue;
        }
        for (let j = 1; j < verticalDivisions; j++) {
          const indexA = i * (verticalDivisions + 1) + j;
          const indexB = (i + 1) * (verticalDivisions + 1) + j;

          [indexA, indexB].forEach((index) => {
            const d = movedGrid[index].subtract(baseGrid[index]);
            const dL = d.length();
            const maxH = maxHMethod(j);
            const h = Math.min(maxH, dL - INSET);
            const dSc = d.scale(h / dL);

            scales.push(h / dL);

            baseGrid[index] = baseGrid[index].add(dSc);
          });
        }
      }
    } else {
      for (let i = 0; i < horizontalDivisions; i++) {
        for (let j = 0; j < verticalDivisions; j++) {
          const index = i * (verticalDivisions + 1) + j;

          const d = movedGrid[index].subtract(baseGrid[index]);
          const dL = d.length();
          const maxH = maxHMethod(j);
          const h = Math.min(maxH, dL - INSET);
          const dSc = d.scale(h / dL);

          baseGrid[index] = baseGrid[index].add(dSc);
        }
      }
    }
  }

  const iMesh: ITriangularMesh = {
    vertices: [],
    faces: [],
    normals: [],
  };

  // create the faces
  // top and bottom faces
  for (let i = 0; i < horizontalDivisions; i++) {
    for (let j = 0; j < verticalDivisions; j++) {
      const index = i * (verticalDivisions + 1) + j;
      const nextIndex = (i + 1) * (verticalDivisions + 1) + j;
      // splitting quad into two triangles
      if ((i + j) % 2 === 0) {
        iMesh.faces.push(...[index, nextIndex, index + 1]);
        iMesh.faces.push(...[index + 1, nextIndex, nextIndex + 1]);

        iMesh.faces.push(...[baseGrid.length + index, baseGrid.length + index + 1, baseGrid.length + nextIndex]);
        iMesh.faces.push(...[baseGrid.length + index + 1, baseGrid.length + nextIndex + 1, baseGrid.length + nextIndex]);
      } else {
        iMesh.faces.push(...[index, nextIndex + 1, index + 1]);
        iMesh.faces.push(...[index, nextIndex, nextIndex + 1]);

        iMesh.faces.push(...[baseGrid.length + index, baseGrid.length + index + 1, baseGrid.length + nextIndex + 1]);
        iMesh.faces.push(...[baseGrid.length + index, baseGrid.length + nextIndex + 1, baseGrid.length + nextIndex]);
      }
    }
  }

  // add side faces
  for (let i = 0; i < verticalDivisions; i++) {
    const bottomIndex = i;
    const topIndex = i + baseGrid.length;

    if (i % 2 === 0) {
      iMesh.faces.push(...[bottomIndex, bottomIndex + 1, topIndex]);
      iMesh.faces.push(...[bottomIndex + 1, topIndex + 1, topIndex]);
    } else {
      iMesh.faces.push(...[bottomIndex, bottomIndex + 1, topIndex + 1]);
      iMesh.faces.push(...[bottomIndex, topIndex + 1, topIndex]);
    }

    const endBottomIndex = topIndex - verticalDivisions - 1;
    const endTopIndex = endBottomIndex + baseGrid.length;

    if ((i + horizontalDivisions) % 2 === 0) {
      iMesh.faces.push(...[endBottomIndex, endTopIndex, endBottomIndex + 1]);
      iMesh.faces.push(...[endBottomIndex + 1, endTopIndex, endTopIndex + 1]);
    } else {
      iMesh.faces.push(...[endBottomIndex, endTopIndex + 1, endBottomIndex + 1]);
      iMesh.faces.push(...[endBottomIndex, endTopIndex, endTopIndex + 1]);
    }
  }

  for (let i = 0; i < horizontalDivisions; i++) {
    const bottomIndex = i * (verticalDivisions + 1);
    const topIndex = bottomIndex + baseGrid.length;

    if (i % 2 === 0) {
      iMesh.faces.push(...[bottomIndex, topIndex, bottomIndex + verticalDivisions + 1]);
      iMesh.faces.push(...[bottomIndex + verticalDivisions + 1, topIndex, topIndex + verticalDivisions + 1]);
    } else {
      iMesh.faces.push(...[bottomIndex, topIndex + verticalDivisions + 1, bottomIndex + verticalDivisions + 1]);
      iMesh.faces.push(...[bottomIndex, topIndex, topIndex + verticalDivisions + 1]);
    }

    const endBottomIndex = bottomIndex + verticalDivisions;
    const endTopIndex = endBottomIndex + baseGrid.length;

    if ((i + verticalDivisions) % 2 === 0) {
      iMesh.faces.push(...[endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex]);
      iMesh.faces.push(...[endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1, endTopIndex]);
    } else {
      iMesh.faces.push(...[endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1]);
      iMesh.faces.push(...[endBottomIndex, endTopIndex + verticalDivisions + 1, endTopIndex]);
    }
  }

  // create a new mesh
  movedGrid.forEach((v, i) => v.toArray(iMesh.vertices, i * 3));
  baseGrid.forEach((v, i) => v.toArray(iMesh.vertices, (movedGrid.length + i) * 3));

  // compute the normals
  VertexData.ComputeNormals(iMesh.vertices, iMesh.faces, iMesh.normals);

  return iMesh;
};

export const addMeshToScene = (
  iMesh: ITriangularMesh,
  scene: Scene,
  geometrySettings: IGeometrySettings = defaultGeometrySettings,
  name: string = 'custom'
) => {
  const mesh = new Mesh(name, scene);
  mesh.setVerticesData(VertexBuffer.PositionKind, iMesh.vertices);
  mesh.setIndices(iMesh.faces);
  mesh.setVerticesData(VertexBuffer.NormalKind, iMesh.normals);

  const material = new PBRMetallicRoughnessMaterial('texture1', scene);

  mesh.getBoundingInfo();
  material.wireframe = !!geometrySettings.displayWireframe;
  material.baseColor = Color3.FromHexString(geometrySettings.color ?? '#9A4C0D');
  material.roughness = 0.7;

  mesh.material = material;
};

export const makeMeshTiltOnSide = (mesh: ITriangularMesh, geometrySettings: IGeometrySettings) => {
  const angle = Math.atan(geometrySettings.inset / geometrySettings.height);

  const s = Math.sin(angle);
  const c = Math.cos(angle);

  const vertices: number[] = [];
  for (let i = 0; i < mesh.vertices.length / 3; i++) {
    const y = mesh.vertices[i * 3 + 1];
    const z = mesh.vertices[i * 3 + 2];

    vertices.push(mesh.vertices[i * 3], y * c - z * s, y * s + z * c);
  }

  return {
    ...mesh,
    vertices,
  };
};
