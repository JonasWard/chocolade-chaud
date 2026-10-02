import { signedDistanceTransform } from '../text/edt';
import { IDistanceField } from '../field';

// an svg shape as a distance field: drawn on a canvas, the filled (or stroked) part is inside

/** pixels along the long side of the shape */
export const SVG_FIELD_SIZE = 512;
/** around the shape, as part of its long side, so the distances outside of it are exact for a while */
const PADDING = 0.1;
// the field with its padding fits in the smallest texture webgl2 has to support, 2048
const MAX_SVG_FIELD_SIZE = Math.floor(2048 / (1 + 2 * PADDING));
export const MAX_SVG_BYTES = 1_000_000;

const viewBoxOf = (svg: Element): [number, number, number, number] | undefined => {
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0) return box as [number, number, number, number];
  const [w, h] = ['width', 'height'].map((a) => parseFloat(svg.getAttribute(a) ?? ''));
  return w > 0 && h > 0 ? [0, 0, w, h] : undefined;
};

/** the svg with a view box and its size in pixels set, firefox can't draw an svg without a size */
const prepare = (source: string, longSide: number) => {
  if (source.length > MAX_SVG_BYTES) throw new Error('the svg is too large');
  // parsing doesn't run any scripts, and the svg is only drawn as an image, which doesn't either
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('not a valid svg');
  const box = viewBoxOf(svg);
  if (!box) throw new Error('the svg has no size, give it a viewBox');

  const scale = longSide / Math.max(box[2], box[3]);
  const [width, height] = [Math.max(1, Math.round(box[2] * scale)), Math.max(1, Math.round(box[3] * scale))];
  svg.setAttribute('viewBox', box.join(' '));
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('preserveAspectRatio', 'none');
  return { markup: new XMLSerializer().serializeToString(svg), width, height };
};

const loadImage = async (markup: string): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * The distance field of an svg, centred on the origin, in units of its long side (which is 1), detail times finer than usual
 * (see fieldDetail). x to the right and z down, so it reads from above like the text. Needs a browser
 */
export const rasterizeSvg = async (source: string, detail = 1): Promise<IDistanceField> => {
  const longSide = Math.min(SVG_FIELD_SIZE * detail, MAX_SVG_FIELD_SIZE);
  const { markup, width, height } = prepare(source, longSide);
  const image = await loadImage(markup);

  const pad = Math.round(longSide * PADDING);
  const [w, h] = [width + 2 * pad, height + 2 * pad];
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('no canvas to draw the svg on');
  context.drawImage(image, pad, pad, width, height);

  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, w, h).data;
  } catch {
    // some browsers don't let the canvas be read after drawing an svg with a foreignObject
    throw new Error('the svg can not be read, remove its foreignObject');
  }

  // the antialiased coverage of every pixel, its edges make the distances sub-pixel accurate
  const coverage = new Float32Array(w * h);
  let filled = 0;
  for (let p = 0; p < coverage.length; p++) {
    coverage[p] = data[p * 4 + 3] / 255;
    if (data[p * 4 + 3] > 127) filled++;
  }
  if (filled === 0) throw new Error('the svg is empty');

  const pixelSize = 1 / Math.max(width, height);
  const distances = signedDistanceTransform(coverage, w, h);
  for (let p = 0; p < distances.length; p++) distances[p] *= pixelSize;
  return { width: w, height: h, pixelSize, distances };
};
