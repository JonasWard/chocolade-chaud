import React from 'react';
import { IBar } from '../geometry/grid';
import { saveState } from '../state/persist';

const SAVE_DELAY = 300;

/** the bars in the url and local storage, a little after the last edit or when the page is left before that */
export const useAutoSave = (bar: IBar) => {
  React.useEffect(() => {
    const timeout = setTimeout(() => saveState(bar), SAVE_DELAY);
    const save = () => saveState(bar, true);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pagehide', save);
    };
  }, [bar]);
};
