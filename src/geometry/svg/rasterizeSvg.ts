import { IDistanceField } from '../field';
import { buildField } from '../outline/buildField';
import { MAX_FIELD_SIZE } from '../text/rasterizeText';

// an svg shape as a distance field: drawn on a canvas, the filled (or stroked) part is inside

/** pixels of the field along the long side of the shape, it holds exact distances so it only needs to be fine enough to interpolate */
export const SVG_FIELD_SIZE = 512;
/** pixels of the drawing along its long side, that the outline is traced from */
const TRACE_SIZE = 3072;
/** around the shape, as part of its long side, the field is finest; coarser levels reach further */
const PADDING = 0.1;
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
 * (see fieldDetail). x to the right and z down, so it reads from above like the text. Its outline is traced from a large drawing
 * of it. Needs a browser
 */
export const rasterizeSvg = async (source: string, detail = 1): Promise<IDistanceField> => {
  const { markup, width, height } = prepare(source, TRACE_SIZE);
  const image = await loadImage(markup);

  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('no canvas to draw the svg on');
  context.drawImage(image, 0, 0, width, height);

  let data: Uint8ClampedArray;
  try {
    data = context.getImageData(0, 0, width, height).data;
  } catch {
    // some browsers don't let the canvas be read after drawing an svg with a foreignObject
    throw new Error('the svg can not be read, remove its foreignObject');
  }

  // the antialiased coverage of every pixel, the outline is traced through it with sub-pixel accuracy
  const coverage = new Float32Array(width * height);
  let filled = 0;
  for (let p = 0; p < coverage.length; p++) {
    coverage[p] = data[p * 4 + 3] / 255;
    if (data[p * 4 + 3] > 127) filled++;
  }
  if (filled === 0) throw new Error('the svg is empty');

  // its middle on the origin, the long side 1
  const scale = 1 / Math.max(width, height);
  const [halfX, halfZ] = [(width * scale) / 2 + PADDING, (height * scale) / 2 + PADDING];
  const field = await buildField({
    pieces: [{ coverage, width, height, anchorX: width / 2, anchorY: height / 2, scale, angle: 0, x: 0, z: 0 }],
    box: { minX: -halfX, minZ: -halfZ, maxX: halfX, maxZ: halfZ },
    pixelSize: 1 / (SVG_FIELD_SIZE * detail),
    maxSize: MAX_FIELD_SIZE,
  });
  if (!field) throw new Error('the svg is empty');
  return field;
};
