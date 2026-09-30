import { ITriangularMesh } from './createMesh';
import { meshToOBJ, meshToSTL } from './exportGeometry';

// single triangle in the xz-plane, facing down (-y)
const triangle: ITriangularMesh = {
  vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
  faces: new Uint32Array([0, 1, 2]),
  normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
  color: '#000000',
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

test('stl keeps negative normal components', () => {
  expect(meshToSTL(triangle)).toContain('facet normal 0.000 -1.00000 0.000');
});
