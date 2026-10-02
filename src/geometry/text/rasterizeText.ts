import { IDistanceField } from '../field';
import type { ITextNode } from '../sdf/tree';
import { cssFont } from './fonts';
import { layoutGlyphs } from './layout';
import { buildField } from '../outline/buildField';
import { IOutlinePiece } from '../outline/pieces';

export const MAX_FIELD_SIZE = 2048;
// pixels of the field per font size, it holds exact distances so it only needs to be fine enough to interpolate between them
const PIXELS_PER_SIZE = 64;
// pixels of the drawing per font size that the outline is traced from, the letters are drawn one by one
const TRACE_PX_PER_SIZE = 256;
// around the letters, in font sizes, the field is finest; coarser levels reach further
const PADDING = 1.5;
// the size the advances are measured at
const MEASURE_PX = 100;

const createCanvas = (width: number, height: number) =>
  typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });

const context2d = (canvas: ReturnType<typeof createCanvas>) =>
  canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

/** one character drawn on its own canvas, with the point it is placed by: its middle, on the base line */
const drawCharacter = (char: string, font: string, baseline: CanvasTextBaseline): Omit<IOutlinePiece, 'scale' | 'angle' | 'x' | 'z'> | undefined => {
  const measure = context2d(createCanvas(1, 1));
  if (!measure) return undefined;
  measure.font = font;
  measure.textAlign = 'center';
  measure.textBaseline = baseline;
  const box = measure.measureText(char);
  const pad = 2;
  const [left, top] = [Math.ceil(box.actualBoundingBoxLeft) + pad, Math.ceil(box.actualBoundingBoxAscent) + pad];
  const [width, height] = [left + Math.ceil(box.actualBoundingBoxRight) + pad, top + Math.ceil(box.actualBoundingBoxDescent) + pad];
  if (width <= 2 * pad || height <= 2 * pad) return undefined;

  const context = context2d(createCanvas(width, height));
  if (!context) return undefined;
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = baseline;
  context.fillStyle = '#000';
  context.fillText(char, left, top);
  const { data } = context.getImageData(0, 0, width, height);
  const coverage = new Float32Array(width * height);
  for (let p = 0; p < coverage.length; p++) coverage[p] = data[p * 4 + 3] / 255;
  return { coverage, width, height, anchorX: left, anchorY: top };
};

/**
 * The distance field (in mm) of a text node, centred on the box around its glyphs: every character along its base curve, or its
 * straight line, where it goes with the kerning of the text. The field is detail times finer than usual (see fieldDetail).
 * Needs a browser and the font loaded (see loadFont), undefined when nothing is drawn
 */
export const rasterizeTextNode = async (node: ITextNode, detail = 1): Promise<IDistanceField | undefined> => {
  const { text, font, bold, size, curve } = node;
  const chars = Array.from(text);
  if (!chars.length || !(size > 0)) return undefined;

  const measure = context2d(createCanvas(1, 1));
  if (!measure) return undefined;
  measure.font = cssFont(font, bold, MEASURE_PX);
  const mm = size / MEASURE_PX;
  // what every character adds to the width of the text up to it, so it keeps its kerning
  const widths = chars.map((_, i) => measure.measureText(chars.slice(0, i + 1).join('')).width);
  const advances = widths.map((w, i) => (w - (i ? widths[i - 1] : 0)) * mm);
  const placements = layoutGlyphs(advances, curve ?? { x: node.offsetX, z: node.offsetZ, angle: node.angle });

  const tracePx = TRACE_PX_PER_SIZE * Math.min(detail, 4);
  const traceFont = cssFont(font, bold, tracePx);
  const baseline = curve ? 'alphabetic' : 'middle';
  const pieces: IOutlinePiece[] = [];
  const drawn = new Map<string, ReturnType<typeof drawCharacter>>();
  chars.forEach((char, i) => {
    if (!drawn.has(char)) drawn.set(char, drawCharacter(char, traceFont, baseline));
    const piece = drawn.get(char);
    // the same character twice shares its drawing, the worker gets a copy of it for every place
    if (piece) pieces.push({ ...piece, coverage: piece.coverage.slice(), scale: size / tracePx, ...placements[i] });
  });
  if (!pieces.length) return undefined;

  const xs = placements.flatMap((p) => [p.x - size * PADDING, p.x + size * PADDING]);
  const zs = placements.flatMap((p) => [p.z - size * PADDING, p.z + size * PADDING]);
  const box = { minX: Math.min(...xs), minZ: Math.min(...zs), maxX: Math.max(...xs), maxZ: Math.max(...zs) };
  const field = await buildField({ pieces, box, pixelSize: size / (PIXELS_PER_SIZE * detail), maxSize: MAX_FIELD_SIZE });
  return field && { ...field, center: { x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 } };
};
