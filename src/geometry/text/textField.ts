// text as a relief in the top surface: a signed distance field that is merged into the height of the pattern

export interface ITextSettings {
  text: string;
  fontFamily: string;
  /** font size in mm */
  size: number;
  /** offset of the centre of the text from the centre of the bar, in mm */
  offsetX: number;
  offsetZ: number;
  /** height of the text in mm, positive is embossed, negative is debossed */
  depth: number;
  /** width in mm over which the edge of the text blends into its surroundings */
  bevelWidth: number;
  /** how much of the pattern is removed on the text: 0 keeps it, 1 leaves the text flat */
  patternFade: number;
}

export const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace', 'cursive'];

export const defaultTextSettings: ITextSettings = {
  text: '',
  fontFamily: FONT_FAMILIES[0],
  size: 16,
  offsetX: 0,
  offsetZ: 0,
  depth: 0.6,
  bevelWidth: 0.5,
  patternFade: 1,
};

/** signed distances to the outline of the text, negative inside, on a pixel grid that starts at the base position of the bar */
export interface ITextField {
  width: number;
  height: number;
  /** size of a pixel in mm, pixel (px, pz) has its centre at ((px + 0.5) * pixelSize, (pz + 0.5) * pixelSize) */
  pixelSize: number;
  /** in mm, row by row along the length of the bar */
  distances: Float32Array;
}

export interface ITextRelief {
  field: ITextField;
  depth: number;
  bevelWidth: number;
  patternFade: number;
}

export const MAX_FIELD_SIZE = 2048;
export const MIN_BEVEL_WIDTH = 1e-3;

/** bilinear sample of the field at a location in mm relative to the base position of the bar, see textDistance in three/shaders/bake.ts */
export const sampleTextField = ({ width, height, pixelSize, distances }: ITextField, x: number, z: number): number => {
  const fx = x / pixelSize - 0.5;
  const fz = z / pixelSize - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = fx - x0;
  const tz = fz - z0;

  const at = (px: number, pz: number) => distances[Math.min(Math.max(pz, 0), height - 1) * width + Math.min(Math.max(px, 0), width - 1)];
  const near = at(x0, z0) * (1 - tx) + at(x0 + 1, z0) * tx;
  const far = at(x0, z0 + 1) * (1 - tx) + at(x0 + 1, z0 + 1) * tx;
  return near * (1 - tz) + far * tz;
};

/** 1 on the text, 0 away from it, blending over the bevel width around its outline */
export const textMask = (distance: number, bevelWidth: number): number => {
  const bevel = Math.max(bevelWidth, MIN_BEVEL_WIDTH);
  const t = Math.min(Math.max(0.5 - distance / bevel, 0), 1);
  return t * t * (3 - 2 * t);
};

/** the height (in mm) the top surface is moved by: the pattern, faded out on the text, plus the text itself */
export const reliefHeight = (pattern: number, amplitude: number, x: number, z: number, text?: ITextRelief): number => {
  if (!text) return pattern * amplitude;
  const mask = textMask(sampleTextField(text.field, x, z), text.bevelWidth);
  return pattern * amplitude * (1 - text.patternFade * mask) + text.depth * mask;
};
