import { BarPart, REF_SIZE, createBarLayout, createSupportRaise } from '../../src/geometry/barLayout';
import { SPACING_LENGTH, START_LENGTH, fanOffset, sideNormals, supportColumns } from '../../src/geometry/barMath';
import { GridParser } from '../../src/geometry/grid';
import { singleGrid } from './testUtils';

test('layout sizes', () => {
  const { vertexCount, refs, faces } = createBarLayout(10, 5);
  // top and bottom grid, plus two rows for each of the four side walls
  expect(vertexCount).toBe(2 * 11 * 6 + 2 * 2 * (11 + 6));
  expect(refs.length).toBe(vertexCount * REF_SIZE);
  expect(faces.length / 3).toBe(2 * 2 * 10 * 5 + 2 * 2 * (10 + 5));
  expect(faces.every((f) => f < vertexCount)).toBe(true);
});

test('every triangle stays within one part, so the parts do not share normals', () => {
  const { refs, faces } = createBarLayout(7, 4);
  const counts = new Map<number, number>();
  for (let f = 0; f < faces.length; f += 3) {
    const parts = [0, 1, 2].map((k) => refs[faces[f + k] * REF_SIZE + 2]);
    expect(new Set(parts).size).toBe(1);
    counts.set(parts[0], (counts.get(parts[0]) ?? 0) + 1);
  }
  expect(counts.get(BarPart.Top)).toBe(2 * 7 * 4);
  expect(counts.get(BarPart.Bottom)).toBe(2 * 7 * 4);
  expect(counts.get(BarPart.WallIStart)).toBe(2 * 4);
  expect(counts.get(BarPart.WallIEnd)).toBe(2 * 4);
  expect(counts.get(BarPart.WallJStart)).toBe(2 * 7);
  expect(counts.get(BarPart.WallJEnd)).toBe(2 * 7);
});

test('the parts close up: welded on the grid vertex they refer to, it is the mesh that is exported', () => {
  const [hd, vd] = [12, 7];
  const { refs, faces } = createBarLayout(hd, vd);
  const [mesh] = GridParser(singleGrid(hd, vd, 1));
  const welded = faces.map((v) => refs[v * REF_SIZE] * (vd + 1) + refs[v * REF_SIZE + 1] + refs[v * REF_SIZE + 3] * (hd + 1) * (vd + 1));
  expect(welded).toEqual(mesh.faces);
});

test('top and bottom refer to their own grid vertex, at their own level', () => {
  const [hd, vd] = [3, 2];
  const { refs } = createBarLayout(hd, vd);
  const count = (hd + 1) * (vd + 1);
  for (let i = 0; i <= hd; i++) {
    for (let j = 0; j <= vd; j++) {
      const k = i * (vd + 1) + j;
      expect([...refs.subarray(k * REF_SIZE, (k + 1) * REF_SIZE)]).toEqual([i, j, BarPart.Top, 0]);
      expect([...refs.subarray((count + k) * REF_SIZE, (count + k + 1) * REF_SIZE)]).toEqual([i, j, BarPart.Bottom, 1]);
    }
  }
});

// the loops createIMesh used before the columns were shared with the gpu preview
const raisedByTheOriginalLoops = (hd: number, vd: number, gridWidth: number): number[] => {
  const raised = new Array<number>((hd + 1) * (vd + 1)).fill(0);
  const horizontalDivisionsResolution = Math.floor(SPACING_LENGTH / gridWidth);
  const supportStart = Math.ceil(START_LENGTH / gridWidth);
  const openingWidth = Math.ceil(1.5 / gridWidth);

  if (gridWidth < SPACING_LENGTH / 4) {
    if (gridWidth < SPACING_LENGTH / 10) {
      for (let i = supportStart; i < hd - supportStart; i += 1) {
        if (i % horizontalDivisionsResolution === 0) {
          i += openingWidth;
          continue;
        }
        for (let j = 1; j < vd; j++) {
          raised[i * (vd + 1) + j]++;
          raised[(i + 1) * (vd + 1) + j]++;
        }
      }
    } else {
      for (let i = 0; i < hd; i++) {
        for (let j = 0; j < vd; j++) raised[i * (vd + 1) + j]++;
      }
    }
  }
  return raised;
};

test.each([
  [160, 10, 0.25],
  [97, 13, 0.4],
  [40, 8, 0.79],
  [30, 6, 1],
  [20, 5, 1.99],
  [10, 4, 2],
  [5, 3, 4],
])('support columns match the original loops (%i x %i, grid width %f)', (hd, vd, gridWidth) => {
  const layout = createBarLayout(hd, vd);
  const count = (hd + 1) * (vd + 1);
  const raise = createSupportRaise(layout, supportColumns(hd, vd, gridWidth, true));
  // the bottom grid
  expect([...raise.subarray(count, 2 * count)]).toEqual(raisedByTheOriginalLoops(hd, vd, gridWidth));
  // nothing on the top surface, the base row of the walls follows the bottom grid
  for (let v = 0; v < layout.vertexCount; v++) {
    const [i, j, , level] = layout.refs.subarray(v * REF_SIZE, (v + 1) * REF_SIZE);
    expect(raise[v]).toBe(level === 0 ? 0 : raise[count + i * (vd + 1) + j]);
  }
  expect([...createSupportRaise(layout, supportColumns(hd, vd, gridWidth, false))].every((r) => r === 0)).toBe(true);
});

test('the side walls are planes with the shared side normal', () => {
  for (const withSupports of [false, true]) {
    for (const inset of [-3, 0, 2]) {
      const [hd, vd] = [9, 6];
      const cellData: Parameters<typeof GridParser>[1] = [];
      const [{ vertices, faces }] = GridParser(singleGrid(hd, vd, 1, inset), cellData, withSupports);
      const normals = sideNormals(cellData[0].geometrySettings);
      normals.forEach((n) => expect(Math.hypot(...n)).toBeCloseTo(1));

      // the side strips come last: walls i = 0 and i = last alternate per segment, then j = 0 and j = last
      const firstSide = 3 * 4 * hd * vd;
      for (let f = firstSide; f < faces.length; f += 3) {
        const segment = (f - firstSide) / 6;
        const wall = segment < 2 * vd ? Math.floor(segment) % 2 : 2 + (Math.floor(segment - 2 * vd) % 2);
        const [a, b, c] = [0, 1, 2].map((k) => [0, 1, 2].map((axis) => vertices[faces[f + k] * 3 + axis]));
        const [u, v] = [b, c].map((p) => p.map((value, axis) => value - a[axis]));
        const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const length = Math.hypot(...cross);
        // skip the degenerate triangles of a wall that has no height left
        if (length < 1e-6) continue;
        cross.forEach((value, axis) => expect(value / length).toBeCloseTo(normals[wall][axis], 4));
      }
    }
  }
});

test('the fan is the direction between the base and the top of a wall', () => {
  expect(fanOffset(0, 10, -3)).toBe(3);
  expect(fanOffset(10, 10, -3)).toBeCloseTo(3 - 60 / 11);
});
