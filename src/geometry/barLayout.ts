import { ISupportColumns } from './barMath';

// the topology of a bar, it only depends on the amount of divisions

export enum BarPart {
  Top = 0,
  Bottom = 1,
  // side walls
  WallIStart = 2,
  WallIEnd = 3,
  WallJStart = 4,
  WallJEnd = 5,
}

export type Wall = 0 | 1 | 2 | 3;
/** 0: on the top surface, 1: on the base */
export type Level = 0 | 1;

/** the index of a vertex of a side wall */
export type WallVertex = (wall: Wall, i: number, j: number, level: Level) => number;

/**
 * Triangles of a bar: top and bottom grid and the four side strips, counter clockwise seen from outside.
 * Top vertices are i * (verticalDivisions + 1) + j, the bottom ones follow after all the top ones,
 * the vertices used by the side walls are given by wallVertex.
 */
export const createBarFaces = (horizontalDivisions: number, verticalDivisions: number, wallVertex: WallVertex): Uint32Array => {
  const vertexCount = (horizontalDivisions + 1) * (verticalDivisions + 1);

  // 4 triangles per quad (top and bottom) and 4 per side segment
  const faces = new Uint32Array(3 * (4 * horizontalDivisions * verticalDivisions + 4 * (horizontalDivisions + verticalDivisions)));
  let f = 0;
  // the indices below are listed clockwise (seen from outside), they are stored counter clockwise
  const tri = (a: number, b: number, c: number) => {
    faces[f++] = a;
    faces[f++] = c;
    faces[f++] = b;
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

  // a segment of a side wall, t on the top surface and b on the base, 0 and 1 along the wall
  const segment = (t0: number, t1: number, b0: number, b1: number, even: boolean, flipped: boolean) => {
    if (flipped) {
      if (even) {
        tri(t0, b0, t1);
        tri(t1, b0, b1);
      } else {
        tri(t0, b1, t1);
        tri(t0, b0, b1);
      }
    } else if (even) {
      tri(t0, t1, b0);
      tri(t1, b1, b0);
    } else {
      tri(t0, t1, b1);
      tri(t0, b1, b0);
    }
  };

  // add side faces
  for (let j = 0; j < verticalDivisions; j++) {
    segment(wallVertex(0, 0, j, 0), wallVertex(0, 0, j + 1, 0), wallVertex(0, 0, j, 1), wallVertex(0, 0, j + 1, 1), j % 2 === 0, false);

    const i = horizontalDivisions;
    segment(wallVertex(1, i, j, 0), wallVertex(1, i, j + 1, 0), wallVertex(1, i, j, 1), wallVertex(1, i, j + 1, 1), (j + i) % 2 === 0, true);
  }

  for (let i = 0; i < horizontalDivisions; i++) {
    segment(wallVertex(2, i, 0, 0), wallVertex(2, i + 1, 0, 0), wallVertex(2, i, 0, 1), wallVertex(2, i + 1, 0, 1), i % 2 === 0, true);

    const j = verticalDivisions;
    segment(wallVertex(3, i, j, 0), wallVertex(3, i + 1, j, 0), wallVertex(3, i, j, 1), wallVertex(3, i + 1, j, 1), (i + j) % 2 === 0, false);
  }

  return faces;
};

/** side walls that use the vertices of the top and the bottom grid, for a closed mesh */
export const weldedWallVertex = (horizontalDivisions: number, verticalDivisions: number): WallVertex => {
  const vertexCount = (horizontalDivisions + 1) * (verticalDivisions + 1);
  return (_wall, i, j, level) => i * (verticalDivisions + 1) + j + level * vertexCount;
};

export const REF_SIZE = 4;

export interface IBarLayout {
  horizontalDivisions: number;
  verticalDivisions: number;
  vertexCount: number;
  /** per vertex: i, j (the grid vertex it refers to), the BarPart it belongs to and its Level */
  refs: Uint16Array;
  faces: Uint32Array;
}

/**
 * A bar split up in parts (top, bottom and the four side walls) that don't share vertices, so each part can have its own normals.
 * The vertices don't have a location, they refer to a vertex of the top grid: the top grid, then the bottom grid, then two rows per side wall
 */
export const createBarLayout = (horizontalDivisions: number, verticalDivisions: number): IBarLayout => {
  const gridCount = (horizontalDivisions + 1) * (verticalDivisions + 1);
  const wallOffsets = [0, verticalDivisions + 1, 2 * (verticalDivisions + 1), 2 * (verticalDivisions + 1) + horizontalDivisions + 1].map(
    (o) => 2 * gridCount + 2 * o
  );
  const vertexCount = 2 * gridCount + 4 * (horizontalDivisions + verticalDivisions + 2);

  const wallVertex: WallVertex = (wall, i, j, level) => wallOffsets[wall] + 2 * (wall < 2 ? j : i) + level;

  const refs = new Uint16Array(vertexCount * REF_SIZE);
  const setRef = (index: number, i: number, j: number, part: BarPart, level: Level) => refs.set([i, j, part, level], index * REF_SIZE);

  for (let i = 0; i <= horizontalDivisions; i++) {
    for (let j = 0; j <= verticalDivisions; j++) {
      const index = i * (verticalDivisions + 1) + j;
      setRef(index, i, j, BarPart.Top, 0);
      setRef(gridCount + index, i, j, BarPart.Bottom, 1);
    }
  }

  for (const level of [0, 1] as const) {
    for (let j = 0; j <= verticalDivisions; j++) {
      setRef(wallVertex(0, 0, j, level), 0, j, BarPart.WallIStart, level);
      setRef(wallVertex(1, horizontalDivisions, j, level), horizontalDivisions, j, BarPart.WallIEnd, level);
    }
    for (let i = 0; i <= horizontalDivisions; i++) {
      setRef(wallVertex(2, i, 0, level), i, 0, BarPart.WallJStart, level);
      setRef(wallVertex(3, i, verticalDivisions, level), i, verticalDivisions, BarPart.WallJEnd, level);
    }
  }

  return { horizontalDivisions, verticalDivisions, vertexCount, refs, faces: createBarFaces(horizontalDivisions, verticalDivisions, wallVertex) };
};

/** per vertex of the layout, how many times it is raised towards the top surface for the back support */
export const createSupportRaise = ({ vertexCount, refs }: IBarLayout, { counts, jStart, jEnd }: ISupportColumns): Uint8Array => {
  const raise = new Uint8Array(vertexCount);
  for (let v = 0; v < vertexCount; v++) {
    const i = refs[v * REF_SIZE];
    const j = refs[v * REF_SIZE + 1];
    const level = refs[v * REF_SIZE + 3];
    if (level === 1 && j >= jStart && j < jEnd) raise[v] = counts[i];
  }
  return raise;
};
