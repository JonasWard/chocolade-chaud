// an undo / redo stack of states, edits in quick succession (dragging a slider, typing a number) are one step

export const COALESCE_MS = 500;
export const MAX_STEPS = 100;

export interface IHistory<T> {
  past: T[];
  present: T;
  future: T[];
  /** time of the last edit, an edit within COALESCE_MS of it replaces the present instead of adding a step */
  editedAt: number;
}

export type HistoryAction<T> = { type: 'set'; state: T; now: number } | { type: 'undo' } | { type: 'redo' };

export const createHistory = <T>(present: T): IHistory<T> => ({ past: [], present, future: [], editedAt: -Infinity });

export const historyReducer = <T>(history: IHistory<T>, action: HistoryAction<T>): IHistory<T> => {
  const { past, present, future } = history;
  switch (action.type) {
    case 'set': {
      if (action.state === present) return history;
      const coalesce = action.now - history.editedAt < COALESCE_MS;
      return { past: coalesce ? past : [...past, present].slice(-MAX_STEPS), present: action.state, future: [], editedAt: action.now };
    }
    case 'undo':
      if (!past.length) return history;
      return { past: past.slice(0, -1), present: past[past.length - 1], future: [present, ...future], editedAt: -Infinity };
    case 'redo':
      if (!future.length) return history;
      return { past: [...past, present], present: future[0], future: future.slice(1), editedAt: -Infinity };
  }
};
