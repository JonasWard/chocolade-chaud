import { DefaultGridSettings, GridType, ISingleGrid } from './grid';

export const singleGrid = (cellWidth: number, cellLength: number, divPerMM = 1): ISingleGrid => ({
  ...(DefaultGridSettings(GridType.Single) as ISingleGrid),
  cellWidth,
  cellLength,
  divPerMM,
});
