import { DEFAULT_COLOR, IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IDistanceData, defaultDistanceData } from './sdMethods';
import { ITextRelief, ITextSettings } from './text/textField';

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
  sdfSetting: IDistanceData;
  color: string;
  text?: ITextSettings;
};

export type ISimpleGrid = BaseGrid & {
  type: GridType.Simple;
  cellLength: number;
  cellWidth: number;
  sdfSetting: IDistanceData;
  colors: string[];
};

export type IIndividuallyCustomizableGrid = BaseGrid & {
  type: GridType.IndividuallyCustomizable;
  cellLength: number;
  cellWidth: number;
  sdfSettings: IDistanceData[];
  sdfMap: number[];
  colors: string[];
};

export type IGroupableGrid = BaseGrid & {
  type: GridType.Groupable;
  totalLength: number;
  totalWidth: number;
  uDivisions: number[];
  vDivisions: number[];
  sdfSettings: IDistanceData[];
  groups: number[][];
  sdfMap: number[];
  colors: string[];
};

export type IGridSettings = ISingleGrid | ISimpleGrid | IIndividuallyCustomizableGrid | IGroupableGrid;
export type CellData = {
  geometrySettings: IGeometrySettings;
  sdfSettings: IDistanceData;
  withSupports: boolean;
  text?: ITextRelief;
};

const applyGridData = (cellData: CellData): ITriangularMesh => createIMesh(cellData.geometrySettings, cellData.sdfSettings, cellData.withSupports, cellData.text);

export const MAX_UV_COUNT = 10;
export const MAX_DIV_PER_MM = 8;
export const MAX_DIVS_ONE_SIDE = 2048;

// rounding some key parameters
const parsingBasicGridData = <T extends BaseGrid>(grid: T): T => ({
  ...grid,
  uCount: Math.max(Math.min(Math.round(grid.uCount), MAX_UV_COUNT), 1),
  vCount: Math.max(Math.min(Math.round(grid.vCount), MAX_UV_COUNT), 1),
  divPerMM: Math.min(grid.divPerMM, MAX_DIV_PER_MM),
});

const singleGridCells = (grid: ISingleGrid, withSupports: boolean, text?: ITextRelief): CellData[] => [
  {
    geometrySettings: {
      ...grid,
      color: grid.color,
      innerWidth: grid.cellWidth,
      innerLength: grid.cellLength,
      basePosition: { x: 0, y: 0, z: 0 },
      horizontalDivisions: Math.min(Math.round(grid.cellWidth * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      verticalDivisions: Math.min(Math.round(grid.cellLength * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      displayWireframe: grid.displayWireframe,
    },
    sdfSettings: grid.sdfSetting,
    withSupports,
    text,
  },
];

const simpleGridCells = (grid: ISimpleGrid, withSupports: boolean): CellData[] => {
  // loading in variables
  const { uCount, vCount, divPerMM, height, inset, spacing, amplitude, cellLength, cellWidth, sdfSetting } = parsingBasicGridData(grid);

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
      });
    }
  }
  return cellData;
};

/** the settings of every bar of a grid, text is the relief of the text of the grid (only a single bar has one) */
export const gridCells = (grid: IGridSettings, withSupports = false, text?: ITextRelief): CellData[] => {
  switch (grid.type) {
    case GridType.Single:
      return singleGridCells(grid, withSupports, text);
    case GridType.Simple:
      return simpleGridCells(grid, withSupports);
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
        sdfSetting: defaultDistanceData,
        color: DEFAULT_COLOR,
      };
    case GridType.Simple:
      return {
        ...grid,
        type: GridType.Simple,
        cellLength: 50,
        cellWidth: 50,
        sdfSetting: defaultDistanceData,
        colors: [DEFAULT_COLOR],
      };

    case GridType.IndividuallyCustomizable:
      return {
        ...grid,
        type: GridType.IndividuallyCustomizable,
        cellLength: 50,
        cellWidth: 50,
        sdfSettings: [defaultDistanceData],
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
        sdfSettings: [defaultDistanceData],
        colors: [DEFAULT_COLOR],
        sdfMap: [0, 0],
      };
  }
};

export const GridParser = (grid: IGridSettings, cellData: CellData[] = [], withSupports = false, text?: ITextRelief): ITriangularMesh[] => {
  cellData.push(...gridCells(grid, withSupports, text));
  return cellData.map(applyGridData);
};
