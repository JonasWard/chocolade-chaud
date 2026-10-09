import React from 'react';
import { IPieceOverride } from '../geometry/pieces';

/** what an edit of the pattern of a unique tablet changes: the pattern all its pieces share, or the picked piece alone */
export type Scope = 'all' | 'piece';

/** the piece of a combined tablet that is picked, shared by the panels and the scene */
export interface IPieces {
  piece: number;
  setPiece: (piece: number) => void;
  scope: Scope;
  setScope: (scope: Scope) => void;
  /** what differs on the piece while it is edited alone, for the marks on what differs (see Marks.tsx) */
  override?: IPieceOverride;
  setOverride: (override: IPieceOverride) => void;
}

export const PiecesContext = React.createContext<IPieces>({ piece: 0, setPiece: () => {}, scope: 'all', setScope: () => {}, setOverride: () => {} });

export const usePieces = (): IPieces => React.useContext(PiecesContext);
