import { DEFAULT_COLOR, IGeometrySettings, ITriangularMesh, createIMesh } from './createMesh';
import { IPattern, SvgFields, defaultPattern } from './sdf/tree';
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
  sdfSetting: IPattern;
  color: string;
  text?: ITextSettings;
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
  text?: ITextRelief;
  /** the distance fields of the svg shapes of the pattern */
  fields?: SvgFields;
};

const applyGridData = (cellData: CellData): ITriangularMesh => createIMesh(cellData.geometrySettings, cellData.sdfSettings, cellData.withSupports, cellData.text, cellData.fields);

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

const singleGridCells = (grid: ISingleGrid, withSupports: boolean, text?: ITextRelief, fields?: SvgFields): CellData[] => [
  {
    geometrySettings: {
      ...grid,
      color: grid.color,
      innerWidth: grid.cellWidth,
      innerLength: grid.cellLength,
      // centred on the origin, like a grid, so the origin of the pattern is the middle of the bar
      basePosition: { x: -grid.cellWidth / 2, y: 0, z: -grid.cellLength / 2 },
      horizontalDivisions: Math.min(Math.round(grid.cellWidth * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      verticalDivisions: Math.min(Math.round(grid.cellLength * grid.divPerMM), MAX_DIVS_ONE_SIDE),
      displayWireframe: grid.displayWireframe,
    },
    sdfSettings: grid.sdfSetting,
    withSupports,
    text,
    fields,
  },
];

const simpleGridCells = (grid: ISimpleGrid, withSupports: boolean, fields?: SvgFields): CellData[] => {
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
        fields,
      });
    }
  }
  return cellData;
};

/**
 * the settings of every bar of a grid, text is the relief of the text of the grid (only a single bar has one),
 * fields the distance fields of the svg shapes of its pattern
 */
export const gridCells = (grid: IGridSettings, withSupports = false, text?: ITextRelief, fields?: SvgFields): CellData[] => {
  switch (grid.type) {
    case GridType.Single:
      return singleGridCells(grid, withSupports, text, fields);
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

export const GridParser = (grid: IGridSettings, cellData: CellData[] = [], withSupports = false, text?: ITextRelief, fields?: SvgFields): ITriangularMesh[] => {
  cellData.push(...gridCells(grid, withSupports, text, fields));
  return cellData.map(applyGridData);
};
