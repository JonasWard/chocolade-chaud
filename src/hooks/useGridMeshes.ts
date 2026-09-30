import React from 'react';
import { CellData, IGridSettings } from '../geometry/grid';
import { ITriangularMesh } from '../geometry/createMesh';
import type { MeshRequest, MeshResponse } from '../geometry/meshWorker';

export type GridMeshes = { grid: IGridSettings; meshes: ITriangularMesh[]; cellData: CellData[] };

/**
 * Generates the meshes for a grid in a web worker, so editing the settings never blocks the ui.
 * While the worker is busy only the latest request is kept, intermediate settings are skipped.
 */
export const useGridMeshes = (grid: IGridSettings, withSupports = true): { result?: GridMeshes; pending: boolean; error?: string } => {
  const [result, setResult] = React.useState<GridMeshes>();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(true);

  const worker = React.useRef<Worker>();
  const busy = React.useRef(false);
  const queued = React.useRef<MeshRequest>();
  const grids = React.useRef(new Map<number, IGridSettings>());
  const lastId = React.useRef(0);

  const post = React.useCallback((request: MeshRequest) => {
    busy.current = true;
    worker.current?.postMessage(request);
  }, []);

  React.useEffect(() => {
    const w = new Worker(new URL('../geometry/meshWorker.ts', import.meta.url));
    const requestGrids = grids.current;
    worker.current = w;

    w.onmessage = ({ data }: MessageEvent<MeshResponse>) => {
      busy.current = false;
      const requestGrid = requestGrids.get(data.id);
      requestGrids.delete(data.id);

      if (queued.current) {
        post(queued.current);
        queued.current = undefined;
      } else setPending(false);

      if ('error' in data) setError(data.error);
      else if (requestGrid) {
        setError(undefined);
        setResult({ grid: requestGrid, meshes: data.meshes, cellData: data.cellData });
      }
    };

    return () => {
      w.terminate();
      worker.current = undefined;
      busy.current = false;
      queued.current = undefined;
      requestGrids.clear();
    };
  }, [post]);

  React.useEffect(() => {
    const request: MeshRequest = { id: ++lastId.current, grid, withSupports };
    grids.current.set(request.id, grid);
    setPending(true);

    if (busy.current) {
      // replace an older queued request, it is outdated now
      if (queued.current) grids.current.delete(queued.current.id);
      queued.current = request;
    } else post(request);
  }, [grid, withSupports, post]);

  return { result, pending, error };
};
