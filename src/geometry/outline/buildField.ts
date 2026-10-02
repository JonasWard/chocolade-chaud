import { IDistanceField } from '../field';
import type { OutlineMessage, OutlineResponse } from './outlineWorker';
import { IOutlineRequest, buildPiecesField } from './pieces';

// builds the distance field of drawn pieces in a worker, one for the whole page, or here where there are no workers

let worker: Worker | undefined;
let lastId = 0;
const waiting = new Map<number, { resolve: (field?: IDistanceField) => void; reject: (e: Error) => void }>();

const outlineWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('./outlineWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data: { id, field, error } }: MessageEvent<OutlineResponse>) => {
      const job = waiting.get(id);
      waiting.delete(id);
      if (error) job?.reject(new Error(error));
      else job?.resolve(field);
    };
  }
  return worker;
};

/** the distance field of the pieces, undefined when nothing is drawn. The coverages are handed over, not copied */
export const buildField = (request: IOutlineRequest): Promise<IDistanceField | undefined> => {
  if (typeof Worker === 'undefined') return Promise.resolve(buildPiecesField(request));
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    const transfer = request.pieces.map((p) => p.coverage.buffer);
    outlineWorker().postMessage({ id, request } as OutlineMessage, transfer);
  });
};
