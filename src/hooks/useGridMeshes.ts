import React from 'react';
import { CellData, IGridSettings } from '../geometry/grid';
import { ITriangularMesh } from '../geometry/createMesh';
import type { FieldMessage, MeshRequest, MeshResponse } from '../geometry/meshWorker';
import { IDistanceField } from '../geometry/field';
import { SvgFields } from '../geometry/sdf/tree';

// id is unique per generated result
export type GridMeshes = { id: number; grid: IGridSettings; fields: SvgFields; meshes: ITriangularMesh[]; cellData: CellData[] };

type Request = MeshRequest & { fields: SvgFields };

/**
 * Generates the meshes for a grid in a web worker, so editing the settings never blocks the ui.
 * While the worker is busy only the latest request is kept, intermediate settings are skipped.
 */
export const useGridMeshes = (
  grid: IGridSettings,
  fields: SvgFields,
  withSupports = true
): { result?: GridMeshes; pending: boolean; error?: string } => {
  const [result, setResult] = React.useState<GridMeshes>();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(true);

  const worker = React.useRef<Worker | undefined>(undefined);
  const busy = React.useRef(false);
  const queued = React.useRef<Request | undefined>(undefined);
  const requests = React.useRef(new Map<number, Request>());
  const lastId = React.useRef(0);
  // the fields the worker has, by asset
  const sent = React.useRef(new Map<string, IDistanceField>());

  const post = React.useCallback(({ fields, ...request }: Request) => {
    busy.current = true;
    const known = sent.current;
    const send = (message: FieldMessage) => {
      if (message.field) known.set(message.asset, message.field);
      else known.delete(message.asset);
      worker.current?.postMessage(message);
    };
    for (const asset of known.keys()) if (!fields.has(asset)) send({ type: 'field', asset });
    for (const [asset, field] of fields) if (known.get(asset) !== field) send({ type: 'field', asset, field });
    worker.current?.postMessage(request);
  }, []);

  React.useEffect(() => {
    const w = new Worker(new URL('../geometry/meshWorker.ts', import.meta.url), { type: 'module' });
    const pendingRequests = requests.current;
    worker.current = w;
    sent.current.clear();

    w.onmessage = ({ data }: MessageEvent<MeshResponse>) => {
      busy.current = false;
      const request = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);

      if (queued.current) {
        post(queued.current);
        queued.current = undefined;
      } else setPending(false);

      if ('error' in data) setError(data.error);
      else if (request) {
        setError(undefined);
        setResult({ id: data.id, grid: request.grid, fields: request.fields, meshes: data.meshes, cellData: data.cellData });
      }
    };

    return () => {
      w.terminate();
      worker.current = undefined;
      busy.current = false;
      queued.current = undefined;
      pendingRequests.clear();
    };
  }, [post]);

  React.useEffect(() => {
    const request: Request = { type: 'mesh', id: ++lastId.current, grid, withSupports, fields, assets: [...fields.keys()] };
    requests.current.set(request.id, request);
    setPending(true);

    if (busy.current) {
      // replace an older queued request, it is outdated now
      if (queued.current) requests.current.delete(queued.current.id);
      queued.current = request;
    } else post(request);
  }, [grid, fields, withSupports, post]);

  return { result, pending, error };
};
