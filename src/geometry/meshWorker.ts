import { CellData, GridParser, IGridSettings } from './grid';
import { ITriangularMesh } from './createMesh';

export type MeshRequest = { id: number; grid: IGridSettings; withSupports: boolean };
export type MeshResponse = { id: number; meshes: ITriangularMesh[]; cellData: CellData[] } | { id: number; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = ({ data: { id, grid, withSupports } }: MessageEvent<MeshRequest>) => {
  try {
    const cellData: CellData[] = [];
    const meshes = GridParser(grid, cellData, withSupports);
    // hand over the buffers instead of copying them
    const transfer = meshes.flatMap((m) => [m.vertices.buffer, m.faces.buffer, m.normals.buffer]);
    ctx.postMessage({ id, meshes, cellData } as MeshResponse, transfer);
  } catch (e) {
    ctx.postMessage({ id, error: String(e) } as MeshResponse);
  }
};
