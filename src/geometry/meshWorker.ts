import { CellData, GridParser, IGridSettings } from './grid';
import { ITriangularMesh } from './createMesh';
import { IDistanceField } from './field';

/**
 * The distance fields of the svg shapes are sent once and kept here (undefined forgets one), so a request only carries their keys.
 * Messages arrive in order, so a request always finds the fields that were sent before it
 */
export type FieldMessage = { type: 'field'; asset: string; field?: IDistanceField };
export type MeshRequest = { type: 'mesh'; id: number; grid: IGridSettings; withSupports: boolean; assets: string[] };
export type MeshResponse = { id: number; meshes: ITriangularMesh[]; cellData: CellData[] } | { id: number; error: string };

const ctx = self as unknown as Worker;
const fields = new Map<string, IDistanceField>();

ctx.onmessage = ({ data }: MessageEvent<FieldMessage | MeshRequest>) => {
  if (data.type === 'field') {
    if (data.field) fields.set(data.asset, data.field);
    else fields.delete(data.asset);
    return;
  }

  const { id, grid, withSupports, assets } = data;
  try {
    const cellData: CellData[] = [];
    const requestFields = new Map(assets.flatMap((asset) => (fields.has(asset) ? [[asset, fields.get(asset) as IDistanceField]] : [])));
    const meshes = GridParser(grid, cellData, withSupports, requestFields);
    // hand over the buffers instead of copying them
    const transfer = meshes.flatMap((m) => [m.vertices.buffer, m.faces.buffer, m.normals.buffer]);
    // the distance fields came from the main thread, no need to send them back
    const cells = cellData.map((c) => ({ ...c, fields: undefined }));
    ctx.postMessage({ id, meshes, cellData: cells } as MeshResponse, transfer);
  } catch (e) {
    ctx.postMessage({ id, error: String(e) } as MeshResponse);
  }
};
