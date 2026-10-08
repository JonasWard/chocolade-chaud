// the waves and layouts of a sine modifier, see the sine case in evaluate.ts. three/shaders/sdfCodegen.ts has the same in glsl.
// A wave is a function of a phase in turns, between -1 and 1. A layout is where that phase comes from: r is the distance of the
// children in periods, an their angle in turns times the count, so both repeat every 1

export const WAVES = ['sine', 'triangle', 'sawtooth'] as const;
export type Wave = (typeof WAVES)[number];

export const LAYOUTS = ['rings', 'spiral', 'petals', 'weave'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** where the angle is taken: around the centre of the pattern, or along the normal of the distance of the children */
export const AROUNDS = ['centre', 'outline'] as const;
export type Around = (typeof AROUNDS)[number];

/** in mm, how far from a point the distance of the children is sampled for its gradient and its curvature */
export const GRADIENT_STEP = 0.05;
/** in periods, how far the rings of the petals sway in and out */
export const PETAL_SWAY = 0.35;
/** below it a length or a slope is 0, its angle and curvature are not known */
export const TINY = 1e-6;

const TURN = 2 * Math.PI;
const fract = (t: number) => t - Math.floor(t);

/** all of them are 0 and rising at a whole phase, so their crests stay where they are from one wave to another */
export const waves: Record<Wave, (t: number) => number> = {
  sine: (t) => Math.sin(TURN * t),
  triangle: (t) => 4 * Math.abs(fract(t - 0.25) - 0.5) - 1,
  // steps down half way
  sawtooth: (t) => 2 * fract(t + 0.5) - 1,
};

export const layouts: Record<Layout, (wave: (t: number) => number, r: number, an: number) => number> = {
  rings: (wave, r) => wave(r),
  spiral: (wave, r, an) => wave(r + an),
  petals: (wave, r, an) => wave(r + PETAL_SWAY * Math.sin(TURN * an)),
  weave: (wave, r, an) => wave(r) * wave(an),
};

/** the angle of a direction, 0 where there is none (atan2 is undefined there in glsl) */
export const angleOf = (x: number, z: number): number => (x === 0 && z === 0 ? 0 : Math.atan2(z, x));

/**
 * How much is left of a wave that repeats radial times per mm along the distance and angular times per mm around the angle:
 * all of it where its wavelength is twice the detail (in mm, 0 is no fade), nothing where it is the detail or less
 */
export const fade = (radial: number, angular: number, detail: number): number => {
  if (!(detail > 0)) return 1;
  const t = Math.min(Math.max(1 / Math.max(Math.hypot(radial, angular), TINY) / detail - 1, 0), 1);
  return t * t * (3 - 2 * t);
};
