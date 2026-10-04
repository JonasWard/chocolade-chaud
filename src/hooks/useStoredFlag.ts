import React from 'react';

// a preference of this browser, in local storage: the app works the same without it

const read = (key: string, initial: boolean): boolean => {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? initial : stored === 'true';
  } catch {
    return initial;
  }
};

export const useStoredFlag = (key: string, initial = false): [boolean, (value: boolean) => void] => {
  const [value, setValue] = React.useState(() => read(key, initial));
  const set = React.useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // not allowed, it lasts until the page is left
      }
    },
    [key]
  );
  return [value, set];
};
