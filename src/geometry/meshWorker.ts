import { CellData, GridParser, IGridSettings } from './grid';
import { ITriangularMesh } from './createMesh';
import { ITextRelief } from './text/textField';

export type MeshRequest = { id: number; grid: IGridSettings; withSupports: boolean; text?: ITextRelief };
export type MeshResponse = { id: number; meshes: ITriangularMesh[]; cellData: CellData[] } | { id: number; error: string };

const ctx = self as unknown as Worker;

ctx.onmessage = ({ data: { id, grid, withSupports, text } }: MessageEvent<MeshRequest>) => {
  try {
    const cellData: CellData[] = [];
    const meshes = GridParser(grid, cellData, withSupports, text);
    // hand over the buffers instead of copying them
    const transfer = meshes.flatMap((m) => [m.vertices.buffer, m.faces.buffer, m.normals.buffer]);
    // the distance field of the text came from the main thread, no need to send it back
    const cells = cellData.map((c) => ({ ...c, text: undefined }));
    ctx.postMessage({ id, meshes, cellData: cells } as MeshResponse, transfer);
  } catch (e) {
    ctx.postMessage({ id, error: String(e) } as MeshResponse);
  }
};
