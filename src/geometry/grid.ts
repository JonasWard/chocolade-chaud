import { IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IPattern, SvgFields, defaultPattern } from './sdf/tree';
import { IBox } from './field';
import { placePattern } from './sdf/placement';
import { ChocolateType, DEFAULT_CHOCOLATE } from './chocolates';
import { DEFAULT_PIECES, IPiece, TabletSize, centredBox, pieceBoxes, tabletSize } from './tablets';
import { DEFAULT_REPEAT, IFrame, IPieceOverride, IRepeat, NO_OVERRIDE, PieceMode, diffPattern, pieceFrame, referenceSize, resolvePattern, settleOverride } from './pieces';

/** what the bars are: one tablet, a whole tablet of smaller ones, or one bar of any size */
export enum BarKind {
  Tablet = 'Tablet',
  Combined = 'Combined',
  Custom = 'Custom',
}

/**
 * The bars and their pattern. Every kind keeps its own size, so switching back and forth keeps it. Sizes are of the base of a bar,
 * the top is smaller (or larger) by the inset on every side
 */
export interface IBar {
  kind: BarKind;
  /** of a single tablet */
  tablet: TabletSize;
  /** of a combined tablet */
  pieces: IPiece[];
  /** of a custom bar, in mm */
  width: number;
  length: number;
  /** of every piece, the first is for all of them when they are the same */
  chocolates: ChocolateType[];
  sameChocolate: boolean;
  height: number;
  inset: number;
  divPerMM: number;
  displayWireframe: boolean;
  /** the pattern, of a combined tablet that is unique the one its pieces share */
  sdfSetting: IPattern;
  /** of a combined tablet: how its pieces see the pattern, see pieces.ts */
  pieceMode: PieceMode;
  /** the frame of every piece when they repeat the pattern or are unique */
  repeat: IRepeat;
  /** what differs on every piece when they are unique, by the index of the piece, undefined for one that follows the shared pattern */
  overrides: (IPieceOverride | undefined)[];
}

export type CellData = {
  geometrySettings: IGeometrySettings;
  sdfSettings: IPattern;
  withSupports: boolean;
  /** the distance fields of the svg shapes of the pattern */
  fields?: SvgFields;
};

const applyGridData = (cellData: CellData): ITriangularMesh => createIMesh(cellData.geometrySettings, cellData.sdfSettings, cellData.withSupports, cellData.fields);

export const MAX_DIV_PER_MM = 32;
export const MAX_CUSTOM_SIZE = 400;
// the size of the baked top surface of a bar, see three/shaders/bake.ts: a gpu that can't hold it shows the mesh of the worker
export const MAX_DIVS_ONE_SIDE = 8192;
// top vertices of all the bars together, what the memory of a phone or a small laptop holds (the mesh, its baked surface, the stl)
export const MAX_VERTICES = 2 * 2048 * 2048;

/** the bases of the bars in mm, centred on the origin */
export const barBases = (bar: IBar): IBox[] => {
  switch (bar.kind) {
    case BarKind.Tablet: {
      const { width, length } = tabletSize(bar.tablet);
      return [centredBox(width, length)];
    }
    case BarKind.Combined:
      return pieceBoxes(bar.pieces);
    case BarKind.Custom:
      return [centredBox(bar.width, bar.length)];
  }
};

/** the tops of the bars: the base moved in by the inset (a negative inset makes the top smaller), at least 1 mm */
const barTops = (bar: IBar): IBox[] =>
  barBases(bar).map(({ minX, minZ, maxX, maxZ }) => {
    const [width, length] = [Math.max(maxX - minX + 2 * bar.inset, 1), Math.max(maxZ - minZ + 2 * bar.inset, 1)];
    const [x, z] = [(minX + maxX) / 2, (minZ + maxZ) / 2];
    return { minX: x - width / 2, minZ: z - length / 2, maxX: x + width / 2, maxZ: z + length / 2 };
  });

/**
 * The divisions per mm the bars get, the same along both sides: as asked, unless a side would have more than MAX_DIVS_ONE_SIDE
 * or all the bars together more than MAX_VERTICES
 */
export const effectiveDivPerMM = (bar: IBar): number => {
  const tops = barTops(bar);
  const longest = Math.max(...tops.map((b) => Math.max(b.maxX - b.minX, b.maxZ - b.minZ)));
  const area = tops.reduce((a, b) => a + (b.maxX - b.minX) * (b.maxZ - b.minZ), 0);
  return Math.min(bar.divPerMM, MAX_DIV_PER_MM, MAX_DIVS_ONE_SIDE / longest, Math.sqrt(MAX_VERTICES / area));
};

/** the chocolate of the piece with the index */
export const chocolateOf = (bar: IBar, index: number): ChocolateType =>
  (bar.sameChocolate ? undefined : bar.chocolates[index]) ?? bar.chocolates[0] ?? DEFAULT_CHOCOLATE;

const layoutCells = (bar: IBar, withSupports: boolean, fields?: SvgFields): CellData[] => {
  const divPerMM = effectiveDivPerMM(bar);
  return barTops(bar).map((top, i) => {
    const [width, length] = [top.maxX - top.minX, top.maxZ - top.minZ];
    return {
      geometrySettings: {
        innerWidth: width,
        innerLength: length,
        height: bar.height,
        inset: bar.inset,
        basePosition: { x: top.minX, y: 0, z: top.minZ },
        horizontalDivisions: Math.max(Math.min(Math.round(width * divPerMM), MAX_DIVS_ONE_SIDE), 1),
        verticalDivisions: Math.max(Math.min(Math.round(length * divPerMM), MAX_DIVS_ONE_SIDE), 1),
        chocolate: chocolateOf(bar, i),
        displayWireframe: bar.displayWireframe,
      },
      sdfSettings: bar.sdfSetting,
      withSupports,
      fields,
    };
  });
};

/** the box around the tops of the bars, in mm */
export const cellsBox = (cells: CellData[]): IBox => {
  const xs = cells.flatMap(({ geometrySettings: g }) => [g.basePosition.x, g.basePosition.x + g.innerWidth]);
  const zs = cells.flatMap(({ geometrySettings: g }) => [g.basePosition.z, g.basePosition.z + g.innerLength]);
  return xs.length ? { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs) } : { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
};

/** the box around the tops of the bars */
export const gridBox = (bar: IBar): IBox => cellsBox(layoutCells(bar, false));

/** whether every piece sees the pattern in a frame of its own: a combined tablet that repeats it or is unique */
export const isPieced = (bar: IBar): boolean => bar.kind === BarKind.Combined && bar.pieceMode !== 'one';
/** whether the pieces can differ from the shared pattern */
export const isUnique = (bar: IBar): boolean => bar.kind === BarKind.Combined && bar.pieceMode === 'unique';

export const overrideOf = (bar: IBar, piece: number): IPieceOverride => bar.overrides[piece] ?? NO_OVERRIDE;

/** the pattern of a piece of a unique tablet, before its frame: what the editors show of it */
export const piecePattern = (bar: IBar, piece: number): IPattern => resolvePattern(bar.sdfSetting, overrideOf(bar, piece));

/**
 * The frame the pattern (the shared one, or the one of the piece) is in on the bar with the index: all the bars together, or the
 * piece itself when every piece has its own
 */
export const frameOf = (bar: IBar, pattern: IPattern, piece: number): IFrame => {
  if (!isPieced(bar)) return { pattern, box: gridBox(bar) };
  const tops = barTops(bar);
  return pieceFrame(pattern, tops[Math.min(piece, tops.length - 1)], referenceSize(tops, bar.repeat), bar.repeat);
};

/** the frame of every bar with the pattern it has in it */
export const barFrames = (bar: IBar): IFrame[] => {
  const tops = barTops(bar);
  if (!isPieced(bar)) {
    const frame = frameOf(bar, bar.sdfSetting, 0);
    return tops.map(() => frame);
  }
  const reference = referenceSize(tops, bar.repeat);
  return tops.map((top, i) => pieceFrame(isUnique(bar) ? piecePattern(bar, i) : bar.sdfSetting, top, reference, bar.repeat));
};

/** the bar with another shared pattern, what differs on its pieces as far as it still holds on it */
export const withSharedPattern = (bar: IBar, sdfSetting: IPattern): IBar => {
  const overrides = bar.overrides.map((o) => o && settleOverride(sdfSetting, o));
  return { ...bar, sdfSetting, overrides: overrides.every((o, i) => o === bar.overrides[i]) ? bar.overrides : overrides };
};

/** the bar with another override of a piece */
export const withOverride = (bar: IBar, piece: number, override: IPieceOverride): IBar => {
  const settled = settleOverride(bar.sdfSetting, override);
  // without holes
  const overrides = Array.from({ length: Math.max(bar.overrides.length, piece + 1) }, (_, i) => (i === piece ? settled : bar.overrides[i]));
  return { ...bar, overrides };
};

/** the bar with another pattern on one of its pieces: what differs from the shared one is its override. The svg shapes are shared */
export const withPiecePattern = (bar: IBar, piece: number, pattern: IPattern): IBar => {
  const sdfSetting = pattern.svgs === bar.sdfSetting.svgs ? bar.sdfSetting : { ...bar.sdfSetting, svgs: pattern.svgs };
  return withOverride({ ...bar, sdfSetting }, piece, diffPattern(sdfSetting, pattern));
};

/** the bar in another mode: leaving unique, the pattern of the piece becomes the shared one and what differed on the others is gone */
export const withPieceMode = (bar: IBar, pieceMode: PieceMode, piece: number): IBar =>
  bar.pieceMode === 'unique' && pieceMode !== 'unique' ? { ...bar, pieceMode, sdfSetting: piecePattern(bar, piece), overrides: [] } : { ...bar, pieceMode };

/** the bar with another layout: a piece of the same size at the same place keeps what differs on it */
export const withPieces = (bar: IBar, pieces: IPiece[]): IBar => {
  const was = (piece: IPiece) => bar.pieces.findIndex((p) => p.size === piece.size && p.u === piece.u && p.v === piece.v);
  const overrides = pieces.map((p) => bar.overrides[was(p)]);
  return { ...bar, pieces, overrides: overrides.some((o) => o) ? overrides : [] };
};

/**
 * the settings of every bar, fields are the distance fields of the svg and text nodes of its pattern. The svg shapes and texts of the
 * pattern are placed on the bars, or on every piece when it has its own frame (see placePattern)
 */
export const gridCells = (bar: IBar, withSupports = false, fields?: SvgFields): CellData[] => {
  const cells = layoutCells(bar, withSupports, fields);
  if (!isPieced(bar)) {
    const placed = placePattern(bar.sdfSetting, cellsBox(cells), fields);
    return cells.map((cell) => ({ ...cell, sdfSettings: placed }));
  }
  const frames = barFrames(bar);
  return cells.map((cell, i) => ({ ...cell, sdfSettings: placePattern(frames[i].pattern, frames[i].box, fields, frames[i].centre) }));
};

export const defaultBar = (): IBar => ({
  kind: BarKind.Tablet,
  tablet: '6x2',
  pieces: DEFAULT_PIECES,
  width: 160,
  length: 40,
  chocolates: [DEFAULT_CHOCOLATE],
  sameChocolate: true,
  height: 10,
  inset: -3,
  divPerMM: 4,
  displayWireframe: false,
  sdfSetting: defaultPattern(),
  pieceMode: 'one',
  repeat: DEFAULT_REPEAT,
  overrides: [],
});

export const GridParser = (bar: IBar, cellData: CellData[] = [], withSupports = false, fields?: SvgFields): ITriangularMesh[] => {
  cellData.push(...gridCells(bar, withSupports, fields));
  return cellData.map(applyGridData);
};
