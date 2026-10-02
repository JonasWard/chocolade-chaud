import { IDistanceField } from '../field';
import { IOutlineRequest, buildPiecesField } from './pieces';

// traces drawn shapes and builds their distance fields, away from the main thread

export type OutlineMessage = { id: number; request: IOutlineRequest };
export type OutlineResponse = { id: number; field?: IDistanceField; error?: string };

const ctx = self as unknown as Worker;

ctx.onmessage = ({ data: { id, request } }: MessageEvent<OutlineMessage>) => {
  try {
    const field = buildPiecesField(request);
    const transfer = field ? [field, ...(field.levels ?? [])].map((l) => l.distances.buffer) : [];
    ctx.postMessage({ id, field } as OutlineResponse, transfer);
  } catch (e) {
    ctx.postMessage({ id, error: String(e) } as OutlineResponse);
  }
};
