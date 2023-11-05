import { Color3, FloatArray, Mesh, Scene, StandardMaterial, Vector3, VertexBuffer, VertexData } from '@babylonjs/core';
import { DistanceMethodParser, IDistanceData } from './sdMethods';

export interface IVector {
  x: number;
  y: number;
  z: number;
}

export interface IGeometrySettings {
  innerWidth: number;
  innerLength: number;
  height: number;
  amplitude: number;
  inset: number;
  horizontalDivisions: number | null;
  verticalDivisions: number | null;
  basePosition: IVector;
  displayWireframe?: boolean;
  color?: string;
}

export const defaultGeometrySettings: IGeometrySettings = {
  innerWidth: 50,
  innerLength: 50,
  height: 5,
  amplitude: 1,
  inset: -1,
  horizontalDivisions: 500,
  verticalDivisions: 500,
  basePosition: { x: -25, y: 0, z: -25 },
  color: '#9A4C0D',
};

export const createMesh = (
  scene: Scene,
  geometrySettings: IGeometrySettings = defaultGeometrySettings,
  sdfSettings: IDistanceData,
  cleanScene: boolean = true
) => {
  if (cleanScene) scene.meshes.forEach((m) => m.dispose());

  // set the geometry settings
  const { innerWidth, innerLength, height, inset, amplitude } = geometrySettings;
  const baseVector: IVector = geometrySettings.basePosition ?? { x: 0, y: 0, z: 0 };
  const horizontalDivisions = geometrySettings.horizontalDivisions ?? innerWidth;
  const verticalDivisions = geometrySettings.verticalDivisions ?? innerLength;

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

  const baseGrid = grid.map((v, i) => v.subtract(directionGrid[i]));
  const movedGrid = grid.map((v, i) => v.add(directionGrid[i].scale((sdf(v) * amplitude) / height)));

  // create the faces
  // top and bottom faces
  const faces: number[] = [];
  for (let i = 0; i < horizontalDivisions; i++) {
    for (let j = 0; j < verticalDivisions; j++) {
      const index = i * (verticalDivisions + 1) + j;
      const nextIndex = (i + 1) * (verticalDivisions + 1) + j;
      // splitting quad into two triangles
      if ((i + j) % 2 === 0) {
        faces.push(...[index, nextIndex, index + 1]);
        faces.push(...[index + 1, nextIndex, nextIndex + 1]);

        faces.push(...[baseGrid.length + index, baseGrid.length + index + 1, baseGrid.length + nextIndex]);
        faces.push(...[baseGrid.length + index + 1, baseGrid.length + nextIndex + 1, baseGrid.length + nextIndex]);
      } else {
        faces.push(...[index, nextIndex + 1, index + 1]);
        faces.push(...[index, nextIndex, nextIndex + 1]);

        faces.push(...[baseGrid.length + index, baseGrid.length + index + 1, baseGrid.length + nextIndex + 1]);
        faces.push(...[baseGrid.length + index, baseGrid.length + nextIndex + 1, baseGrid.length + nextIndex]);
      }
    }
  }

  // add side faces
  for (let i = 0; i < verticalDivisions; i++) {
    const bottomIndex = i;
    const topIndex = i + baseGrid.length;

    if (i % 2 === 0) {
      faces.push(...[bottomIndex, bottomIndex + 1, topIndex]);
      faces.push(...[bottomIndex + 1, topIndex + 1, topIndex]);
    } else {
      faces.push(...[bottomIndex, bottomIndex + 1, topIndex + 1]);
      faces.push(...[bottomIndex, topIndex + 1, topIndex]);
    }

    const endBottomIndex = topIndex - horizontalDivisions - 1;
    const endTopIndex = endBottomIndex + baseGrid.length;

    if ((i + horizontalDivisions) % 2 === 0) {
      faces.push(...[endBottomIndex, endTopIndex, endBottomIndex + 1]);
      faces.push(...[endBottomIndex + 1, endTopIndex, endTopIndex + 1]);
    } else {
      faces.push(...[endBottomIndex, endTopIndex + 1, endBottomIndex + 1]);
      faces.push(...[endBottomIndex, endTopIndex, endTopIndex + 1]);
    }
  }

  for (let i = 0; i < horizontalDivisions; i++) {
    const bottomIndex = i * (verticalDivisions + 1);
    const topIndex = bottomIndex + baseGrid.length;

    if (i % 2 === 0) {
      faces.push(...[bottomIndex, topIndex, bottomIndex + verticalDivisions + 1]);
      faces.push(...[bottomIndex + verticalDivisions + 1, topIndex, topIndex + verticalDivisions + 1]);
    } else {
      faces.push(...[bottomIndex, topIndex + verticalDivisions + 1, bottomIndex + verticalDivisions + 1]);
      faces.push(...[bottomIndex, topIndex, topIndex + verticalDivisions + 1]);
    }

    const endBottomIndex = bottomIndex + verticalDivisions;
    const endTopIndex = endBottomIndex + baseGrid.length;

    if ((i + verticalDivisions) % 2 === 0) {
      faces.push(...[endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex]);
      faces.push(...[endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1, endTopIndex]);
    } else {
      faces.push(...[endBottomIndex, endBottomIndex + verticalDivisions + 1, endTopIndex + verticalDivisions + 1]);
      faces.push(...[endBottomIndex, endTopIndex + verticalDivisions + 1, endTopIndex]);
    }
  }

  // create a new mesh
  const mesh = new Mesh('custom', scene);
  const positions: FloatArray = [];
  movedGrid.forEach((v, i) => v.toArray(positions, i * 3));
  baseGrid.forEach((v, i) => v.toArray(positions, (movedGrid.length + i) * 3));

  mesh.setVerticesData(VertexBuffer.PositionKind, positions);
  mesh.setIndices(faces);

  const normals: FloatArray = [];
  VertexData.ComputeNormals(positions, faces, normals);
  mesh.setVerticesData(VertexBuffer.NormalKind, normals);

  const material = new StandardMaterial('texture1', scene);

  mesh.getBoundingInfo();
  material.wireframe = !!geometrySettings.displayWireframe;
  material.diffuseColor = Color3.FromHexString(geometrySettings.color ?? '#9A4C0D');

  mesh.material = material;
};
