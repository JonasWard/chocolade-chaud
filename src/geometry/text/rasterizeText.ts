import { signedDistanceTransform } from './edt';
import { IDistanceField } from '../field';
import type { ITextNode } from '../sdf/tree';
import { cssFont } from './fonts';
import { layoutGlyphs } from './layout';

export const MAX_FIELD_SIZE = 2048;
// pixels per font size, so the outline is sharper than the mesh can show
const PIXELS_PER_SIZE = 64;
// the size the advances are measured at
const MEASURE_PX = 100;

const createCanvas = (width: number, height: number) =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });

const context2d = (canvas: ReturnType<typeof createCanvas>) =>
  canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

/**
 * The distance field (in mm) of a text node, centred on the box around its glyphs: along its base curve one character
 * at a time, else in one go so it keeps its kerning. Needs a browser and the font loaded (see loadFont)
 */
export const rasterizeTextNode = (node: ITextNode): IDistanceField | undefined => {
  const { text, font, bold, size, curve } = node;
  const chars = Array.from(text);
  if (!chars.length || !(size > 0)) return undefined;

  const measure = context2d(createCanvas(1, 1));
  if (!measure) return undefined;
  measure.font = cssFont(font, bold, MEASURE_PX);
  const mm = size / MEASURE_PX;
  const advances = chars.map((c) => measure.measureText(c).width * mm);
  const placements = curve
    ? layoutGlyphs(advances, curve)
    : layoutGlyphs([measure.measureText(text).width * mm], { x: node.offsetX, z: node.offsetZ, angle: node.angle });

  // the box around the glyphs, a font size around every one of them is plenty
  const xs = placements.flatMap((p) => [p.x - size * 2, p.x + size * 2]);
  const zs = placements.flatMap((p) => [p.z - size * 2, p.z + size * 2]);
  const [minX, minZ] = [Math.min(...xs), Math.min(...zs)];
  const [extentX, extentZ] = [Math.max(...xs) - minX, Math.max(...zs) - minZ];
  const pixelSize = Math.max(size / PIXELS_PER_SIZE, Math.max(extentX, extentZ) / MAX_FIELD_SIZE);
  const [w, h] = [Math.ceil(extentX / pixelSize), Math.ceil(extentZ / pixelSize)];

  const context = context2d(createCanvas(w, h));
  if (!context) return undefined;
  context.font = cssFont(font, bold, size / pixelSize);
  context.textAlign = 'center';
  context.textBaseline = curve ? 'alphabetic' : 'middle';
  context.fillStyle = '#000';
  const drawn = curve ? chars : [text];
  placements.forEach(({ x, z, angle }, i) => {
    context.setTransform(1, 0, 0, 1, (x - minX) / pixelSize, (z - minZ) / pixelSize);
    context.rotate(angle);
    context.fillText(drawn[i], 0, 0);
  });

  const { data } = context.getImageData(0, 0, w, h);
  // the antialiased coverage of every pixel, its edges make the distances sub-pixel accurate
  const coverage = new Float32Array(w * h);
  let filled = 0;
  for (let p = 0; p < coverage.length; p++) {
    coverage[p] = data[p * 4 + 3] / 255;
    if (data[p * 4 + 3] > 127) filled++;
  }
  if (filled === 0) return undefined;

  const distances = signedDistanceTransform(coverage, w, h);
  for (let p = 0; p < distances.length; p++) distances[p] *= pixelSize;
  return { width: w, height: h, pixelSize, distances, center: { x: minX + (w * pixelSize) / 2, z: minZ + (h * pixelSize) / 2 } };
};
