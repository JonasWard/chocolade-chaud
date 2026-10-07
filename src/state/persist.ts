import { IBar, defaultBar } from '../geometry/grid';
import { ISvgAsset, defaultPattern } from '../geometry/sdf/tree';
import { decodeState, encodeState } from './schema';

// the state lives in the url (?s=...) and in local storage, the svg sources only in local storage

const STATE_KEY = 'chocolade-chaud:state';
const LIBRARY_KEY = 'chocolade-chaud:svgs';
// what this browser last put in the url, a url with it is ours and local storage is at least as new
const URL_STATE_KEY = 'chocolade-chaud:url-state';
const MAX_LIBRARY = 50;
export const URL_PARAM = 's';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // full or not allowed, the url still has the state
  }
};

/** every svg that was used, by key, the built-in ones included */
export const readLibrary = (): Record<string, ISvgAsset> => {
  let stored: Record<string, ISvgAsset> = {};
  try {
    stored = JSON.parse(read(LIBRARY_KEY) ?? '{}');
  } catch {
    // start over
  }
  return { ...defaultPattern().svgs, ...stored };
};

/** adds svgs to the library, the oldest are dropped beyond MAX_LIBRARY */
const addToLibrary = (svgs: Record<string, ISvgAsset>) => {
  const library = readLibrary();
  const missing = Object.entries(svgs).filter(([key, svg]) => library[key]?.source !== svg.source || library[key]?.name !== svg.name);
  if (!missing.length) return;
  const entries = Object.entries({ ...library, ...Object.fromEntries(missing) });
  write(LIBRARY_KEY, JSON.stringify(Object.fromEntries(entries.slice(-MAX_LIBRARY))));
};

/** the state of a link, else the last one of this browser, else the default */
export const loadState = (): IBar => {
  const library = readLibrary();
  const fromUrl = new URLSearchParams(window.location.search).get(URL_PARAM);
  const stored = read(STATE_KEY);
  const order = fromUrl && fromUrl !== read(URL_STATE_KEY) ? [fromUrl, stored] : [stored, fromUrl];
  for (const encoded of order) {
    const grid = encoded && decodeState(encoded, library);
    if (grid) return grid;
  }
  return defaultBar();
};

/**
 * Puts the state in local storage and, unless the page is being left (a reload would keep the url it had), in the url,
 * without a new entry in the browser history
 */
export const saveState = (grid: IBar, leaving = false) => {
  const encoded = encodeState(grid);
  write(STATE_KEY, encoded);
  addToLibrary(grid.sdfSetting.svgs);
  if (leaving) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(URL_PARAM, encoded);
    window.history.replaceState(window.history.state, '', url);
    write(URL_STATE_KEY, encoded);
  } catch {
    // safari limits how often the url can be replaced, the next save puts it there
  }
};
