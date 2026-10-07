import type { IBox } from './field';

// the sizes of the tablets: a whole tablet is 6 by 2 units of 150 by 70 mm, measured at its base. A combined tablet is that whole
// filled with smaller tablets, every way it can be filled is a layout. u runs along the width (x), v along the length (z, 0 on top)

export type TabletSize = '1x2' | '2x1' | '4x1' | '6x2';
/** the tablets a combined tablet is made of */
export type PieceSize = Exclude<TabletSize, '6x2'>;

export const TABLET_SIZES: TabletSize[] = ['1x2', '2x1', '4x1', '6x2'];
export const PIECE_SIZES: PieceSize[] = ['1x2', '2x1', '4x1'];

export const COLUMNS = 6;
export const ROWS = 2;
/** a unit of a tablet in mm, at its base */
export const UNIT = { width: 150 / COLUMNS, length: 70 / ROWS };
/** between the bases of two tablets of a combined tablet, in mm */
export const MOULD_GAP = 1;

/** a tablet of a combined tablet, u and v are the unit of its top left corner */
export interface IPiece {
  size: PieceSize;
  u: number;
  v: number;
}

/** the size of a tablet in units */
export const units = (size: TabletSize): { u: number; v: number } => {
  const [u, v] = size.split('x').map(Number);
  return { u, v };
};

/** the base of a tablet in mm */
export const tabletSize = (size: TabletSize): { width: number; length: number } => {
  const { u, v } = units(size);
  return { width: u * UNIT.width, length: v * UNIT.length };
};

/** whether the pieces fill the whole tablet, each unit once */
export const isLayout = (pieces: IPiece[]): boolean => {
  const taken = new Set<number>();
  for (const { size, u, v } of pieces) {
    if (!PIECE_SIZES.includes(size)) return false;
    const n = units(size);
    for (let i = u; i < u + n.u; i++) {
      for (let j = v; j < v + n.v; j++) {
        if (i < 0 || j < 0 || i >= COLUMNS || j >= ROWS || taken.has(i + j * COLUMNS)) return false;
        taken.add(i + j * COLUMNS);
      }
    }
  }
  return taken.size === COLUMNS * ROWS;
};

/** every way to fill the whole tablet with pieces, the ones with the fewest pieces first */
const enumerateLayouts = (): IPiece[][] => {
  const layouts: IPiece[][] = [];
  const taken = new Set<number>();
  const fits = (size: PieceSize, u: number, v: number) => {
    const n = units(size);
    for (let i = u; i < u + n.u; i++) for (let j = v; j < v + n.v; j++) if (i >= COLUMNS || j >= ROWS || taken.has(i + j * COLUMNS)) return false;
    return true;
  };
  const mark = (size: PieceSize, u: number, v: number, on: boolean) => {
    const n = units(size);
    for (let i = u; i < u + n.u; i++) {
      for (let j = v; j < v + n.v; j++) {
        if (on) taken.add(i + j * COLUMNS);
        else taken.delete(i + j * COLUMNS);
      }
    }
  };
  const fill = (pieces: IPiece[]) => {
    // the first free unit, column by column, is the top left corner of the next piece
    let free = -1;
    for (let i = 0; i < COLUMNS && free < 0; i++) for (let j = 0; j < ROWS && free < 0; j++) if (!taken.has(i + j * COLUMNS)) free = i + j * COLUMNS;
    if (free < 0) {
      layouts.push(pieces);
      return;
    }
    const [u, v] = [free % COLUMNS, Math.floor(free / COLUMNS)];
    for (const size of PIECE_SIZES) {
      if (!fits(size, u, v)) continue;
      mark(size, u, v, true);
      fill([...pieces, { size, u, v }]);
      mark(size, u, v, false);
    }
  };
  fill([]);
  return layouts.map((l, i) => [l, i] as const).sort(([a, i], [b, j]) => a.length - b.length || i - j).map(([l]) => l);
};

export const TABLET_LAYOUTS: IPiece[][] = enumerateLayouts();

/** a 4x1 and a 2x1 above a 2x1 and a 4x1 */
export const DEFAULT_PIECES: IPiece[] = [
  { size: '4x1', u: 0, v: 0 },
  { size: '2x1', u: 4, v: 0 },
  { size: '2x1', u: 0, v: 1 },
  { size: '4x1', u: 2, v: 1 },
];

export const sameLayout = (a: IPiece[], b: IPiece[]): boolean => {
  const key = (pieces: IPiece[]) => pieces.map(({ size, u, v }) => `${size}@${u},${v}`).sort().join(' ');
  return key(a) === key(b);
};

/** a box of the size, centred on the origin */
export const centredBox = (width: number, length: number): IBox => ({ minX: -width / 2, minZ: -length / 2, maxX: width / 2, maxZ: length / 2 });

/** the bases of the pieces of a combined tablet in mm, centred on the origin, a gap between two pieces that touch */
export const pieceBoxes = (pieces: IPiece[]): IBox[] => {
  const [x0, z0] = [(-COLUMNS * UNIT.width) / 2, (-ROWS * UNIT.length) / 2];
  const half = MOULD_GAP / 2;
  return pieces.map(({ size, u, v }) => {
    const n = units(size);
    return {
      minX: x0 + u * UNIT.width + (u > 0 ? half : 0),
      maxX: x0 + (u + n.u) * UNIT.width - (u + n.u < COLUMNS ? half : 0),
      minZ: z0 + v * UNIT.length + (v > 0 ? half : 0),
      maxZ: z0 + (v + n.v) * UNIT.length - (v + n.v < ROWS ? half : 0),
    };
  });
};
