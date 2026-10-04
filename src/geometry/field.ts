// a signed distance field on a pixel grid, shared by the text and the svg shapes

export interface IFieldLevel {
  width: number;
  height: number;
  /** size of a pixel, pixel (px, pz) has its centre at ((px + 0.5) * pixelSize, (pz + 0.5) * pixelSize) */
  pixelSize: number;
  /** row by row, in the unit of pixelSize */
  distances: Float32Array;
}

/** how much further every coarser level of a field reaches than the one before it */
export const LEVEL_REACH = 4;
/** how close (in its pixels) to its edge a level is used, the bicubic sample needs two pixels around it */
export const LEVEL_MARGIN = 2;
/** over how many of its pixels a level blends into the next one, before that margin */
export const LEVEL_BLEND = 8;

export interface IDistanceField extends IFieldLevel {
  /**
   * Coarser fields around this one with the same centre, each LEVEL_REACH times as far and all of the same size in pixels,
   * so the distance stays exact far from the shape
   */
  levels?: IFieldLevel[];
  /** where the centre of the field is, for one that is not centred on the origin (text) */
  center?: { x: number; z: number };
  /** the box around what is drawn, in the unit and around the origin of the field */
  bounds?: IBox;
}

export interface IBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** the weights of the four samples around t (0 to 1 between the middle two) of a catmull-rom spline */
const catmullRom = (t: number): [number, number, number, number] => {
  const [t2, t3] = [t * t, t * t * t];
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
};

/**
 * Bicubic (catmull-rom) sample of the field at a location relative to its corner: the distances at the pixel centres, with a
 * gradient that is continuous across them, so the surface doesn't show the pixels. Beyond its edge pixels the field continues
 * along its slope there. See levelDistance in three/shaders/sdfCodegen.ts
 */
export const sampleField = ({ width, height, pixelSize, distances }: IFieldLevel, x: number, z: number): number => {
  const fx = x / pixelSize - 0.5;
  const fz = z / pixelSize - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const wx = catmullRom(fx - x0);
  const wz = catmullRom(fz - z0);

  const texel = (px: number, pz: number) => distances[Math.min(Math.max(pz, 0), height - 1) * width + Math.min(Math.max(px, 0), width - 1)];
  const at = (px: number, pz: number) => {
    const cx = Math.min(Math.max(px, 0), width - 1);
    const cz = Math.min(Math.max(pz, 0), height - 1);
    const [ex, ez] = [px - cx, pz - cz];
    const d = texel(cx, cz);
    if (!ex && !ez) return d;
    return d + Math.abs(ex) * (d - texel(cx - Math.sign(ex), cz)) + Math.abs(ez) * (d - texel(cx, cz - Math.sign(ez)));
  };
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const row = at(x0 - 1, z0 + j - 1) * wx[0] + at(x0, z0 + j - 1) * wx[1] + at(x0 + 1, z0 + j - 1) * wx[2] + at(x0 + 2, z0 + j - 1) * wx[3];
    sum += row * wz[j];
  }
  return sum;
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Sample of a field centred on the origin, from its finest level the location is well inside of, blending into the next one towards
 * its edge. Beyond the last level it continues as the distance at its edge plus the distance to the edge.
 * See centredFieldDistance in three/shaders/sdfCodegen.ts
 */
export const sampleCentredField = (field: IDistanceField, x: number, z: number): number => {
  const levels: IFieldLevel[] = [field, ...(field.levels ?? [])];
  const at = (level: IFieldLevel) => sampleField(level, x + (level.width * level.pixelSize) / 2, z + (level.height * level.pixelSize) / 2);
  for (let k = 0; k < levels.length - 1; k++) {
    const { width, height, pixelSize } = levels[k];
    // how far inside of the part of the level that is used, in its pixels
    const inside = Math.min(width / 2 - LEVEL_MARGIN - Math.abs(x) / pixelSize, height / 2 - LEVEL_MARGIN - Math.abs(z) / pixelSize);
    if (inside < 0) continue;
    const d = at(levels[k]);
    if (inside >= LEVEL_BLEND) return d;
    const t = smoothstep(1 - inside / LEVEL_BLEND);
    return d + (at(levels[k + 1]) - d) * t;
  }
  const last = levels[levels.length - 1];
  const w = last.width * last.pixelSize;
  const h = last.height * last.pixelSize;
  const lx = x + w / 2;
  const lz = z + h / 2;
  const cx = Math.min(Math.max(lx, 0), w);
  const cz = Math.min(Math.max(lz, 0), h);
  return sampleField(last, cx, cz) + Math.hypot(lx - cx, lz - cz);
};

/**
 * How many times finer than usual to draw the field of a node with the given frame (the static part of its scale, see nodeFrame in
 * sdf/treeOps.ts): a frame below 1 makes it larger on the bars, and so its pixels. A power of two, so scaling only draws it again now and then
 */
export const fieldDetail = (frame: number): number => (frame > 0 ? 2 ** Math.min(Math.max(Math.ceil(Math.log2(1 / frame) - 0.25), 0), 3) : 1);
