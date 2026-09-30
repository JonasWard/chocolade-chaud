import * as fs from 'fs';
import * as path from 'path';
import { VertexData } from '@babylonjs/core';
import { computeNormals, makeMeshTiltOnSide } from './createMesh';
import { GridParser } from './grid';
import { singleGrid } from './testUtils';

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

test('normals match babylon VertexData.ComputeNormals', () => {
  const [mesh] = GridParser(singleGrid(20, 10, 2), [], true);
  const babylonNormals: number[] = [];
  VertexData.ComputeNormals(mesh.vertices, mesh.faces, babylonNormals);

  const normals = computeNormals(mesh.vertices, mesh.faces);
  expect(normals.length).toBe(babylonNormals.length);
  normals.forEach((n, i) => expect(n).toBeCloseTo(babylonNormals[i], 5));
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
  // it runs in a web worker, pulling babylon in would bloat the worker bundle
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const sources = walk(__dirname).filter((f) => /\.ts$/.test(f) && !/test/i.test(path.basename(f)));
  expect(sources.length).toBeGreaterThan(0);
  sources.forEach((f) => expect([f, fs.readFileSync(f, 'utf8').includes('@babylonjs')]).toEqual([f, false]));
});
