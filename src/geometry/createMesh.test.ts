import * as fs from 'fs';
import * as path from 'path';
import { computeNormals, makeMeshTiltOnSide } from './createMesh';
import { GridParser } from './grid';
import { meshToSTL } from './exportGeometry';
import { readSTL, singleGrid } from './testUtils';
// normals babylon's VertexData.ComputeNormals computed for singleGrid(3, 2, 1) with supports, before babylon was replaced
import babylonNormals from './fixtures/babylonNormals.json';

// sum of the signed tetrahedron volumes, positive when the triangles are counter clockwise seen from outside
const signedVolume = ({ vertices: v, faces }: { vertices: Float32Array; faces: Uint32Array }) => {
  let volume = 0;
  for (let f = 0; f < faces.length; f += 3) {
    const [a, b, c] = [faces[f] * 3, faces[f + 1] * 3, faces[f + 2] * 3];
    volume +=
      v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]);
  }
  return volume / 6;
};

test('grid mesh sizes', () => {
  const [mesh] = GridParser(singleGrid(10, 5));
  // top and bottom grid of (10 + 1) * (5 + 1) vertices
  expect(mesh.vertices.length).toBe(2 * 11 * 6 * 3);
  // 2 triangles per quad for top and bottom, plus the 4 side strips
  expect(mesh.faces.length / 3).toBe(2 * 2 * 10 * 5 + 2 * 2 * (10 + 5));
  expect(mesh.faces.every((f) => f < mesh.vertices.length / 3)).toBe(true);
});

test('the mesh is closed: every edge is shared by exactly two faces', () => {
  const [mesh] = GridParser(singleGrid(12, 7, 1.5), [], true);
  const edges = new Map<string, number>();
  for (let f = 0; f < mesh.faces.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const a = mesh.faces[f + e];
      const b = mesh.faces[f + ((e + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((c) => c === 2)).toBe(true);
});

test('normals match the ones babylon computed', () => {
  const [mesh] = GridParser(singleGrid(3, 2, 1), [], true);
  const normals = computeNormals(mesh.vertices, mesh.faces);
  expect(normals.length).toBe(babylonNormals.length);
  normals.forEach((n, i) => expect(n).toBeCloseTo(babylonNormals[i], 5));
});

test('triangles face outward (right handed, counter clockwise)', () => {
  for (const withSupports of [false, true]) {
    const [mesh] = GridParser(singleGrid(20, 10, 2), [], withSupports);
    expect(signedVolume(mesh)).toBeGreaterThan(0);
  }
});

test('stl facet normals agree with the vertex normals', () => {
  const [mesh] = GridParser(singleGrid(6, 4, 1), [], true);
  const facetNormals = readSTL(meshToSTL(mesh)).triangles.map((t) => t.normal);
  expect(facetNormals.length).toBe(mesh.faces.length / 3);
  facetNormals.forEach((n, f) => {
    // compare with the summed normals of the facet's vertices, a single one can be averaged over a sharp edge
    let dot = 0;
    for (let k = 0; k < 3; k++) {
      const v = mesh.faces[f * 3 + k] * 3;
      dot += n[0] * mesh.normals[v] + n[1] * mesh.normals[v + 1] + n[2] * mesh.normals[v + 2];
    }
    expect(dot).toBeGreaterThan(0);
  });
});

test('tilting rotates normals together with vertices', () => {
  const cellData: Parameters<typeof GridParser>[1] = [];
  const [mesh] = GridParser(singleGrid(10, 10), cellData);
  const tilted = makeMeshTiltOnSide(mesh, cellData[0].geometrySettings);

  expect(tilted.normals.length).toBe(mesh.normals.length);
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const before = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
    const after = Math.hypot(tilted.normals[i], tilted.normals[i + 1], tilted.normals[i + 2]);
    expect(after).toBeCloseTo(before);
    expect(tilted.normals[i]).toBeCloseTo(mesh.normals[i]);
  }
  expect(tilted.normals).not.toEqual(mesh.normals);
});

test('the geometry core does not depend on the render engine', () => {
  // it runs in a web worker, pulling the render engine in would bloat the worker bundle
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const sources = walk(__dirname).filter((f) => /\.ts$/.test(f) && !/test/i.test(path.basename(f)));
  expect(sources.length).toBeGreaterThan(0);
  sources.forEach((f) => expect([f, /from '(three|@react-three\/[^']+|@babylonjs\/[^']+)'/.test(fs.readFileSync(f, 'utf8'))]).toEqual([f, false]));
});
