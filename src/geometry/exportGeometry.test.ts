import { Vector3 } from '@babylonjs/core';
import { ITriangularMesh, makeMeshTiltOnSide } from './createMesh';
import { meshToOBJ, meshToSTL } from './exportGeometry';
import { DefaultGridSettings, GridParser, GridType, ISingleGrid } from './grid';
import { DistanceMethodParser, DistanceMethodType, sdGyroid, sdSchwarzD } from './sdMethods';

const singleGrid = (cellWidth: number, cellLength: number): ISingleGrid => ({
  ...(DefaultGridSettings(GridType.Single) as ISingleGrid),
  cellWidth,
  cellLength,
  divPerMM: 1,
});

// single triangle in the xz-plane, facing down (-y)
const triangle: ITriangularMesh = {
  vertices: [0, 0, 0, 1, 0, 0, 0, 0, 1],
  faces: [0, 1, 2],
  normals: [0, -1, 0, 0, -1, 0, 0, -1, 0],
  color: '#000000',
};

test('obj faces reference vertex and normal, not texture coordinates', () => {
  const faces = meshToOBJ(triangle)
    .split('\n')
    .filter((l) => l.startsWith('f '));
  expect(faces).toEqual(['f 1//1 2//2 3//3']);
});

test('stl keeps negative normal components', () => {
  expect(meshToSTL(triangle)).toContain('facet normal 0.000 -1.00000 0.000');
});

test('tilting rotates normals together with vertices', () => {
  const [mesh] = GridParser(singleGrid(10, 10));
  const tilted = makeMeshTiltOnSide(mesh, {
    ...singleGrid(10, 10),
    innerWidth: 10,
    innerLength: 10,
    basePosition: { x: 0, y: 0, z: 0 },
    horizontalDivisions: 10,
    verticalDivisions: 10,
  });

  expect(tilted.normals.length).toBe(mesh.normals.length);
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const before = Vector3.FromArray(mesh.normals, i);
    const after = Vector3.FromArray(tilted.normals, i);
    expect(after.length()).toBeCloseTo(before.length());
    expect(after.x).toBeCloseTo(before.x);
  }
  expect(tilted.normals).not.toEqual(mesh.normals);
});

test('distance method chain uses the inner method as the scale of the outer one', () => {
  const sdf = DistanceMethodParser({
    methods: [
      { method: DistanceMethodType.SDGyroid, number: 0.5 },
      { method: DistanceMethodType.SDSchwarzD, number: 2 },
    ],
    center: { x: 1, y: 2, z: 3 },
    rotation: 0,
    scale: 1,
  });
  const p = new Vector3(4, 5, 6);
  const local = new Vector3(3, 3, 3);
  expect(sdf(p)).toBe(sdGyroid(local, sdSchwarzD(local, 1 * 0.5 * 2)));
});

test('grid mesh sizes', () => {
  const [mesh] = GridParser(singleGrid(10, 5));
  // top and bottom grid of (10 + 1) * (5 + 1) vertices
  expect(mesh.vertices.length).toBe(2 * 11 * 6 * 3);
  // 2 triangles per quad for top and bottom, plus the 4 side strips
  expect(mesh.faces.length / 3).toBe(2 * 2 * 10 * 5 + 2 * 2 * (10 + 5));
  expect(mesh.faces.every((f) => f >= 0 && f < mesh.vertices.length / 3)).toBe(true);
});
