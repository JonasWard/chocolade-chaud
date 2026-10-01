// the parts of a bar shared by the cpu mesh (export) and the gpu preview

export const SPACING_LENGTH = 8.0;
export const START_LENGTH = 2.5;
export const GRADIENT = 0.5;
export const INSET = 2.9;

/** horizontal part of the direction in which the pattern moves the surface, fanning out with the inset */
export const fanOffset = (index: number, divisions: number, inset: number): number => (index * inset * 2) / (divisions + 1) - inset;

/** the maximum height of the back support at a given position along the length */
export const supportMaxHeight = (l: number, innerLength: number): number =>
  Math.max(0, (innerLength / 2 - Math.abs(l - innerLength / 2) - START_LENGTH) * GRADIENT);

export interface ISupportColumns {
  /** per column (horizontal index), how many times its base vertices are raised towards the top surface */
  counts: Uint8Array;
  /** range of rows (vertical index) that is raised, jEnd is exclusive */
  jStart: number;
  jEnd: number;
}

/**
 * Which base vertices are raised for improved back support:
 * ribs when the grid is fine enough, the whole back when it is coarser, nothing when it is too coarse
 */
export const supportColumns = (horizontalDivisions: number, verticalDivisions: number, gridWidth: number, withSupports: boolean): ISupportColumns => {
  const counts = new Uint8Array(horizontalDivisions + 1);

  // only add backsupport if the back resolution is higher than 1/4 of the spacing
  if (!withSupports || !(gridWidth < SPACING_LENGTH / 4)) return { counts, jStart: 0, jEnd: 0 };

  if (gridWidth < SPACING_LENGTH / 10) {
    const horizontalDivisionsResolution = Math.floor(SPACING_LENGTH / gridWidth);
    const supportStart = Math.ceil(START_LENGTH / gridWidth);
    const openingWidth = Math.ceil(1.5 / gridWidth);

    for (let i = supportStart; i < horizontalDivisions - supportStart; i += 1) {
      if (i % horizontalDivisionsResolution === 0) {
        i += openingWidth;
        continue;
      }
      // both sides of the quad, a column between two raised quads is raised twice
      counts[i]++;
      counts[i + 1]++;
    }
    return { counts, jStart: 1, jEnd: verticalDivisions };
  }

  counts.fill(1, 0, horizontalDivisions);
  return { counts, jStart: 0, jEnd: verticalDivisions };
};

export type Normal = [number, number, number];

/**
 * The outward normals of the four side walls, in the order i = 0, i = last, j = 0, j = last.
 * The pattern moves the top edge along the fan direction, which lies in the wall, so every wall is a plane
 */
export const sideNormals = ({
  height,
  inset,
  horizontalDivisions,
  verticalDivisions,
}: {
  height: number;
  inset: number;
  horizontalDivisions: number;
  verticalDivisions: number;
}): [Normal, Normal, Normal, Normal] => {
  const unit = (x: number, y: number, z: number): Normal => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  return [
    unit(-height, fanOffset(0, horizontalDivisions, inset), 0),
    unit(height, -fanOffset(horizontalDivisions, horizontalDivisions, inset), 0),
    unit(0, fanOffset(0, verticalDivisions, inset), -height),
    unit(0, -fanOffset(verticalDivisions, verticalDivisions, inset), height),
  ];
};
