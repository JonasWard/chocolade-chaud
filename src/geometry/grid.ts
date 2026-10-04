import { DEFAULT_COLOR, IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IPattern, SvgFields, defaultPattern } from './sdf/tree';
import { IBox } from './field';
import { placePattern } from './sdf/placement';

export enum GridType {
  Single = 'Single',
  Simple = 'Simple',
  IndividuallyCustomizable = 'IndividuallyCustomizable',
  Groupable = 'Groupable',
}

export type BaseGrid = {
  uCount: number;
  vCount: number;
  divPerMM: number;
  height: number;
  inset: number;
  spacing: number;
  amplitude: number;
  displayWireframe: boolean;
};

export type ISingleGrid = BaseGrid & {
  type: GridType.Single;
  cellLength: number;
  cellWidth: number;
  sdfSetting: IPattern;
  color: string;
};

export type ISimpleGrid = BaseGrid & {
  type: GridType.Simple;
  cellLength: number;
  cellWidth: number;
  sdfSetting: IPattern;
  colors: string[];
};

export type IIndividuallyCustomizableGrid = BaseGrid & {
  type: GridType.IndividuallyCustomizable;
  cellLength: number;
  cellWidth: number;
  sdfSettings: IPattern[];
  sdfMap: number[];
  colors: string[];
};

export type IGroupableGrid = BaseGrid & {
  type: GridType.Groupable;
  totalLength: number;
  totalWidth: number;
  uDivisions: number[];
  vDivisions: number[];
  sdfSettings: IPattern[];
  groups: number[][];
  sdfMap: number[];
  colors: string[];
};

export type IGridSettings = ISingleGrid | ISimpleGrid | IIndividuallyCustomizableGrid | IGroupableGrid;
/** the grids that are implemented, IndividuallyCustomizable and Groupable parse to no meshes yet */
export type IEditableGrid = ISingleGrid | ISimpleGrid;
export type CellData = {
  geometrySettings: IGeometrySettings;
  sdfSettings: IPattern;
  withSupports: boolean;
  /** the distance fields of the svg shapes of the pattern */
  fields?: SvgFields;
};

const applyGridData = (cellData: CellData): ITriangularMesh => createIMesh(cellData.geometrySettings, cellData.sdfSettings, cellData.withSupports, cellData.fields);

export const MAX_UV_COUNT = 10;
export const MAX_DIV_PER_MM = 32;
// the size of the baked top surface of a bar, see three/shaders/bake.ts: a gpu that can't hold it shows the mesh of the worker
export const MAX_DIVS_ONE_SIDE = 8192;
// top vertices of all the bars together, what the memory of a phone or a small laptop holds (the mesh, its baked surface, the stl)
export const MAX_VERTICES = 2 * 2048 * 2048;

/**
 * The divisions per mm a grid gets, the same along both sides: as asked, unless a side would have more than MAX_DIVS_ONE_SIDE
 * or all its bars together more than MAX_VERTICES
 */
export const effectiveDivPerMM = (grid: IGridSettings): number => {
  const divPerMM = Math.min(grid.divPerMM, MAX_DIV_PER_MM);
  if (!('cellWidth' in grid)) return divPerMM;
  const count = (n: number) => Math.max(Math.min(Math.round(n), MAX_UV_COUNT), 1);
  const bars = grid.type === GridType.Simple ? count(grid.uCount) * count(grid.vCount) : 1;
  return Math.min(divPerMM, MAX_DIVS_ONE_SIDE / Math.max(grid.cellWidth, grid.cellLength), Math.sqrt(MAX_VERTICES / (bars * grid.cellWidth * grid.cellLength)));
};

// rounding some key parameters
const parsingBasicGridData = <T extends BaseGrid>(grid: T): T => ({
  ...grid,
  uCount: Math.max(Math.min(Math.round(grid.uCount), MAX_UV_COUNT), 1),
  vCount: Math.max(Math.min(Math.round(grid.vCount), MAX_UV_COUNT), 1),
});

const singleGridCells = (grid: ISingleGrid, withSupports: boolean, fields?: SvgFields): CellData[] => [
  {
    geometrySettings: {
      ...grid,
      color: grid.color,
      innerWidth: grid.cellWidth,
      innerLength: grid.cellLength,
      // centred on the origin, like a grid, so the origin of the pattern is the middle of the bar
      basePosition: { x: -grid.cellWidth / 2, y: 0, z: -grid.cellLength / 2 },
      horizontalDivisions: Math.min(Math.round(grid.cellWidth * effectiveDivPerMM(grid)), MAX_DIVS_ONE_SIDE),
      verticalDivisions: Math.min(Math.round(grid.cellLength * effectiveDivPerMM(grid)), MAX_DIVS_ONE_SIDE),
      displayWireframe: grid.displayWireframe,
    },
    sdfSettings: grid.sdfSetting,
    withSupports,
    fields,
  },
];

const simpleGridCells = (grid: ISimpleGrid, withSupports: boolean, fields?: SvgFields): CellData[] => {
  // loading in variables
  const { uCount, vCount, height, inset, spacing, amplitude, cellLength, cellWidth, sdfSetting } = parsingBasicGridData(grid);
  const divPerMM = effectiveDivPerMM(grid);

  const uLength = (uCount - 1) * (spacing - 2 * inset) + uCount * cellWidth;
  const vLength = (vCount - 1) * (spacing - 2 * inset) + vCount * cellLength;

  const uDivisions = Math.min(Math.round(cellWidth * divPerMM), MAX_DIVS_ONE_SIDE);
  const vDivisions = Math.min(Math.round(cellLength * divPerMM), MAX_DIVS_ONE_SIDE);

  const x0 = -uLength / 2;
  const z0 = -vLength / 2;

  const cellData: CellData[] = [];
  for (let i = 0; i < uCount; i++) {
    for (let j = 0; j < vCount; j++) {
      const geometrySettings: IGeometrySettings = {
        innerWidth: cellWidth,
        innerLength: cellLength,
        height,
        inset,
        amplitude,
        basePosition: { x: x0 + i * (cellWidth + spacing - 2 * inset), y: 0, z: z0 + j * (cellLength + spacing - 2 * inset) },
        horizontalDivisions: uDivisions,
        verticalDivisions: vDivisions,
        color: grid.colors[(i + j * uCount) % grid.colors.length],
        displayWireframe: grid.displayWireframe,
      };

      cellData.push({
        geometrySettings,
        sdfSettings: sdfSetting,
        withSupports,
        fields,
      });
    }
  }
  return cellData;
};

/** the box around the tops of the bars, in mm */
export const cellsBox = (cells: CellData[]): IBox => {
  const xs = cells.flatMap(({ geometrySettings: g }) => [g.basePosition.x, g.basePosition.x + g.innerWidth]);
  const zs = cells.flatMap(({ geometrySettings: g }) => [g.basePosition.z, g.basePosition.z + g.innerLength]);
  return xs.length ? { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs) } : { minX: 0, minZ: 0, maxX: 0, maxZ: 0 };
};

/** the box around the tops of the bars of a grid */
export const gridBox = (grid: IGridSettings): IBox => cellsBox(layoutCells(grid, false));

/**
 * the settings of every bar of a grid, fields are the distance fields of the svg and text nodes of its pattern. The svg shapes and
 * texts of the pattern are placed on the bars (see placePattern)
 */
export const gridCells = (grid: IGridSettings, withSupports = false, fields?: SvgFields): CellData[] => {
  const cells = layoutCells(grid, withSupports, fields);
  const box = cellsBox(cells);
  const placed = new Map<IPattern, IPattern>();
  const place = (pattern: IPattern) => placed.get(pattern) ?? placed.set(pattern, placePattern(pattern, box, fields)).get(pattern)!;
  return cells.map((cell) => ({ ...cell, sdfSettings: place(cell.sdfSettings) }));
};

const layoutCells = (grid: IGridSettings, withSupports: boolean, fields?: SvgFields): CellData[] => {
  switch (grid.type) {
    case GridType.Single:
      return singleGridCells(grid, withSupports, fields);
    case GridType.Simple:
      return simpleGridCells(grid, withSupports, fields);
    // not implemented yet
    case GridType.IndividuallyCustomizable:
    case GridType.Groupable:
      return [];
  }
};

export const DefaultGridSettings = (gridType: GridType): IGridSettings => {
  const grid: BaseGrid = {
    uCount: 2,
    vCount: 2,
    divPerMM: 4,
    height: 10,
    inset: -3,
    spacing: 1,
    amplitude: 0.2,
    displayWireframe: false,
  };
  switch (gridType) {
    case GridType.Single:
      return {
        ...grid,
        type: GridType.Single,
        uCount: 1,
        vCount: 1,
        cellLength: 40,
        cellWidth: 160,
        sdfSetting: defaultPattern(),
        color: DEFAULT_COLOR,
      };
    case GridType.Simple:
      return {
        ...grid,
        type: GridType.Simple,
        cellLength: 50,
        cellWidth: 50,
        sdfSetting: defaultPattern(),
        colors: [DEFAULT_COLOR],
      };

    case GridType.IndividuallyCustomizable:
      return {
        ...grid,
        type: GridType.IndividuallyCustomizable,
        cellLength: 50,
        cellWidth: 50,
        sdfSettings: [defaultPattern()],
        colors: [DEFAULT_COLOR],
        sdfMap: [0, 0, 0, 0],
      };
    case GridType.Groupable:
      return {
        ...grid,
        type: GridType.Groupable,
        totalLength: 100,
        totalWidth: 100,
        uDivisions: [1, 2],
        vDivisions: [2, 1],
        groups: [
          [0, 1],
          [2, 3],
        ],
        sdfSettings: [defaultPattern()],
        colors: [DEFAULT_COLOR],
        sdfMap: [0, 0],
      };
  }
};

export const GridParser = (grid: IGridSettings, cellData: CellData[] = [], withSupports = false, fields?: SvgFields): ITriangularMesh[] => {
  cellData.push(...gridCells(grid, withSupports, fields));
  return cellData.map(applyGridData);
};
