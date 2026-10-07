import { IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IPattern, SvgFields, defaultPattern } from './sdf/tree';
import { IBox } from './field';
import { placePattern } from './sdf/placement';
import { ChocolateType, DEFAULT_CHOCOLATE } from './chocolates';
import { DEFAULT_PIECES, IPiece, TabletSize, centredBox, pieceBoxes, tabletSize } from './tablets';

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
  sdfSetting: IPattern;
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

/**
 * the settings of every bar, fields are the distance fields of the svg and text nodes of its pattern. The svg shapes and texts of the
 * pattern are placed on the bars (see placePattern)
 */
export const gridCells = (bar: IBar, withSupports = false, fields?: SvgFields): CellData[] => {
  const cells = layoutCells(bar, withSupports, fields);
  const placed = placePattern(bar.sdfSetting, cellsBox(cells), fields);
  return cells.map((cell) => ({ ...cell, sdfSettings: placed }));
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
});

export const GridParser = (bar: IBar, cellData: CellData[] = [], withSupports = false, fields?: SvgFields): ITriangularMesh[] => {
  cellData.push(...gridCells(bar, withSupports, fields));
  return cellData.map(applyGridData);
};
