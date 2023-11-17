import { DEFAULT_COLOR, IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IDistanceData, defaultDistanceData } from './sdMethods';

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
type CellData = {
  geometrySettings: IGeometrySettings;
  sdfSettings: IDistanceData;
  withSupports: boolean;
};

const applyGridData = (cellData: CellData): ITriangularMesh => createIMesh(cellData.geometrySettings, cellData.sdfSettings, cellData.withSupports);

export const MAX_UV_COUNT = 10;
export const MAX_DIV_PER_MM = 4;
export const MAX_DIVS_ONE_SIDE = 2048;

// rounding some key parameters
const parsingBasicGridData = <T extends BaseGrid>(grid: T): T => ({
  ...grid,
  uCount: Math.max(Math.min(Math.round(grid.uCount), MAX_UV_COUNT), 1),
  vCount: Math.max(Math.min(Math.round(grid.vCount), MAX_UV_COUNT), 1),
  divPerMM: Math.min(grid.divPerMM, MAX_DIV_PER_MM),
});

const SingleGridParser = (grid: ISingleGrid): ITriangularMesh[] => {
  const cellData: CellData = {
    geometrySettings: {
      ...grid,
      innerWidth: grid.cellWidth,
      innerLength: grid.cellLength,
      basePosition: { x: 0, y: 0, z: 0 },
      horizontalDivisions: Math.min(Math.round(grid.cellWidth * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      verticalDivisions: Math.min(Math.round(grid.cellLength * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      displayWireframe: grid.displayWireframe,
    },
    sdfSettings: grid.sdfSetting,
    withSupports: false,
  };

  return [applyGridData(cellData)];
};

const SimpleGridParser = (grid: ISimpleGrid): ITriangularMesh[] => {
  const cellData: CellData[] = [];

  // loading in variables
  const { uCount, vCount, divPerMM, height, inset, spacing, amplitude, cellLength, cellWidth, sdfSetting } = parsingBasicGridData(grid);

  const uLength = (uCount - 1) * (spacing - 2 * inset) + uCount * cellWidth;
  const vLength = (vCount - 1) * (spacing - 2 * inset) + vCount * cellLength;

  const uDivisions = Math.min(Math.round(cellWidth * divPerMM), MAX_DIVS_ONE_SIDE);
  const vDivisions = Math.min(Math.round(cellLength * divPerMM), MAX_DIVS_ONE_SIDE);

  let x0 = -uLength / 2;
  let z0 = -vLength / 2;

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
        color: grid.colors[0],
        displayWireframe: grid.displayWireframe,
      };

      cellData.push({
        geometrySettings,
        sdfSettings: sdfSetting,
        withSupports: false,
      });
    }
  }

  return cellData.map(applyGridData);
};

const IndividuallyCustomizableGridParser = (grid: IIndividuallyCustomizableGrid): ITriangularMesh[] => {
  const cellData: CellData[] = [];

  return cellData.map(applyGridData);
};

const GroupableGridParser = (grid: IGroupableGrid): ITriangularMesh[] => {
  const cellData: CellData[] = [];

  return cellData.map(applyGridData);
};

export const DefaultGridSettings = (gridType: GridType): IGridSettings => {
  const grid: BaseGrid = {
    uCount: 2,
    vCount: 2,
    divPerMM: 4,
    height: 10,
    inset: -3,
    spacing: 1,
    amplitude: 1,
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

export const GridParser = (grid: IGridSettings): ITriangularMesh[] => {
  switch (grid.type) {
    case GridType.Single:
      return SingleGridParser(grid);
    case GridType.Simple:
      return SimpleGridParser(grid);
    case GridType.IndividuallyCustomizable:
      return IndividuallyCustomizableGridParser(grid);
    case GridType.Groupable:
      return GroupableGridParser(grid);
  }
};
