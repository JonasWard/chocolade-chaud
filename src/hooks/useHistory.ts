import React from 'react';
import { HistoryAction, IHistory, createHistory, historyReducer } from '../state/history';

// the native undo of a text field stays with the text field
const isTextInput = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search'));

/** a state with undo and redo, also on ctrl / cmd + z and ctrl / cmd + shift + z or ctrl + y */
export const useHistory = <T>(initial: () => T) => {
  const [history, dispatch] = React.useReducer(historyReducer as (h: IHistory<T>, a: HistoryAction<T>) => IHistory<T>, undefined, () => createHistory(initial()));

  const set = React.useCallback((state: T) => dispatch({ type: 'set', state, now: performance.now() }), []);
  const undo = React.useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = React.useCallback(() => dispatch({ type: 'redo' }), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTextInput(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return { state: history.present, set, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
};
