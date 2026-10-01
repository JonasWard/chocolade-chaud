import { signedDistanceTransform } from './edt';
import { ITextField, ITextSettings, MAX_FIELD_SIZE } from './textField';

export const fieldPixelSize = (width: number, length: number, divPerMM: number): number =>
  // twice the density of the grid, so the outline is sharper than the mesh can show
  Math.max(1 / (2 * divPerMM), Math.max(width, length) / MAX_FIELD_SIZE);

const fontOf = ({ fontFamily, size }: ITextSettings, pixelSize: number) => `bold ${size / pixelSize}px ${fontFamily}`;

/**
 * Draws the text on a canvas that covers the top of the bar (x to the right, z down, so it reads from above)
 * and turns it into a distance field. Needs a browser, the result is plain data that can go to the worker
 */
export const rasterizeText = (settings: ITextSettings, width: number, length: number, pixelSize: number): ITextField | undefined => {
  const w = Math.ceil(width / pixelSize);
  const h = Math.ceil(length / pixelSize);

  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const context = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!context) return undefined;

  context.font = fontOf(settings, pixelSize);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#000';
  context.fillText(settings.text, (width / 2 + settings.offsetX) / pixelSize, (length / 2 + settings.offsetZ) / pixelSize);

  const { data } = context.getImageData(0, 0, w, h);
  const mask = new Uint8Array(w * h);
  let filled = 0;
  for (let p = 0; p < mask.length; p++) {
    if (data[p * 4 + 3] >= 128) {
      mask[p] = 1;
      filled++;
    }
  }
  // nothing of the text is on the bar
  if (filled === 0 || filled === mask.length) return undefined;

  const distances = signedDistanceTransform(mask, w, h);
  for (let p = 0; p < distances.length; p++) distances[p] *= pixelSize;
  return { width: w, height: h, pixelSize, distances };
};

/** resolves once the font is available to draw with */
export const loadFont = async (settings: ITextSettings, pixelSize: number): Promise<void> => {
  try {
    await document.fonts.load(fontOf(settings, pixelSize), settings.text);
  } catch {
    // draw with the fallback font
  }
};
