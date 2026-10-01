import React from 'react';
import { GridType, IGridSettings } from '../geometry/grid';
import { ITextField, ITextRelief } from '../geometry/text/textField';
import { fieldPixelSize, loadFont, rasterizeText } from '../geometry/text/rasterizeText';

const DEBOUNCE = 150;

/**
 * The text of the grid as a relief for its bars. The distance field is only drawn again when the outline of the text changes,
 * a little after the last edit, so it lags behind the settings while typing
 */
export const useTextRelief = (grid: IGridSettings): ITextRelief | undefined => {
  const [field, setField] = React.useState<ITextField>();

  const text = grid.type === GridType.Single ? grid.text : undefined;
  const [width, length] = grid.type === GridType.Single ? [grid.cellWidth, grid.cellLength] : [0, 0];
  const { text: content = '', fontFamily = '', size = 0, offsetX = 0, offsetZ = 0 } = text ?? {};
  const divPerMM = grid.divPerMM;

  React.useEffect(() => {
    if (!content.trim() || !(size > 0)) {
      setField(undefined);
      return;
    }
    let cancelled = false;
    const settings = { text: content, fontFamily, size, offsetX, offsetZ, depth: 0, bevelWidth: 0, patternFade: 0 };
    const pixelSize = fieldPixelSize(width, length, divPerMM);
    const timeout = setTimeout(async () => {
      await loadFont(settings, pixelSize);
      if (!cancelled) setField(rasterizeText(settings, width, length, pixelSize));
    }, DEBOUNCE);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [content, fontFamily, size, offsetX, offsetZ, width, length, divPerMM]);

  const { depth = 0, bevelWidth = 0, patternFade = 0 } = text ?? {};
  return React.useMemo(() => (field ? { field, depth, bevelWidth, patternFade } : undefined), [field, depth, bevelWidth, patternFade]);
};
