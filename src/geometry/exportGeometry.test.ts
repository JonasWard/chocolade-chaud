import { ITriangularMesh } from './createMesh';
import { ChocolateType } from './chocolates';
import { meshToOBJ, meshToSTL } from './exportGeometry';
import { readSTL } from './testUtils';

// single triangle in the xz-plane, facing down (-y)
const triangle: ITriangularMesh = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
  faces: new Uint32Array([0, 1, 2]),
  normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
  chocolate: ChocolateType.Dark85,
};

test('obj faces reference vertex and normal, not texture coordinates', () => {
  const faces = meshToOBJ(triangle)
    .split('\n')
    .filter((l) => l.startsWith('f '));
  expect(faces).toEqual(['f 1//1 2//2 3//3']);
});

test('obj numbers are not padded with float32 noise', () => {
  const obj = meshToOBJ({ ...triangle, vertices: new Float32Array([0.1, 0, 0, 1, 0, 0, 0, 0, 1]) });
  expect(obj.split('\n')[0]).toBe('v 0.1 0 0');
});

test('binary stl layout', () => {
  const buffer = meshToSTL(triangle);
  expect(buffer.byteLength).toBe(84 + 50);
  const stl = readSTL(buffer);
  expect(stl.header.startsWith('solid')).toBe(false); // would make readers treat it as ascii
  expect(stl.count).toBe(1);
  expect(stl.triangles[0].vertices).toEqual([
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
  ]);
  expect(stl.triangles[0].attribute).toBe(0);
});

test('stl keeps negative normal components', () => {
  // (1, 0, 0) x (0, 0, 1) = (0, -1, 0)
  expect(readSTL(meshToSTL(triangle)).triangles[0].normal).toEqual([0, -1, 0]);
});
