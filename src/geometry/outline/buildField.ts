import { IDistanceField } from '../field';
import type { OutlineMessage, OutlineResponse } from './outlineWorker';
import { IOutlineRequest, buildPiecesField, piecesBounds } from './pieces';

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

/** the distance field of the pieces with the box around them, undefined when nothing is drawn. The coverages are handed over, not copied */
export const buildField = (request: IOutlineRequest): Promise<IDistanceField | undefined> => {
  // before the coverages are handed over
  const bounds = piecesBounds(request.pieces);
  const withBounds = (field?: IDistanceField) => field && { ...field, bounds };
  if (typeof Worker === 'undefined') return Promise.resolve(withBounds(buildPiecesField(request)));
  const id = ++lastId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve: (field) => resolve(withBounds(field)), reject });
    const transfer = request.pieces.map((p) => p.coverage.buffer);
    outlineWorker().postMessage({ id, request } as OutlineMessage, transfer);
  });
};
