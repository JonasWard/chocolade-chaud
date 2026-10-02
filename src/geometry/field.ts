// a signed distance field on a pixel grid, shared by the text and the svg shapes

export interface IDistanceField {
  width: number;
  height: number;
  /** size of a pixel, pixel (px, pz) has its centre at ((px + 0.5) * pixelSize, (pz + 0.5) * pixelSize) */
  pixelSize: number;
  /** row by row, in the unit of pixelSize */
  distances: Float32Array;
  /** where the centre of the field is, for one that is not centred on the origin (text) */
  center?: { x: number; z: number };
}

/** the weights of the four samples around t (0 to 1 between the middle two) of a catmull-rom spline */
const catmullRom = (t: number): [number, number, number, number] => {
  const [t2, t3] = [t * t, t * t * t];
  return [-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1, -1.5 * t3 + 2 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2];
};

/**
 * Bicubic (catmull-rom) sample of the field at a location relative to its corner: the distances at the pixel centres, with a
 * gradient that is continuous across them, so the surface doesn't show the pixels. Beyond its edge pixels the field continues
 * along its slope there. See fieldDistance in three/shaders/sdfCodegen.ts
 */
export const sampleField = ({ width, height, pixelSize, distances }: IDistanceField, x: number, z: number): number => {
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

/**
 * Sample of a field centred on the origin. Outside of the field it continues as the distance at its edge plus the distance to the edge,
 * see centredFieldDistance in three/shaders/sdfCodegen.ts
 */
export const sampleCentredField = (field: IDistanceField, x: number, z: number): number => {
  const w = field.width * field.pixelSize;
  const h = field.height * field.pixelSize;
  const lx = x + w / 2;
  const lz = z + h / 2;
  const cx = Math.min(Math.max(lx, 0), w);
  const cz = Math.min(Math.max(lz, 0), h);
  return sampleField(field, cx, cz) + Math.hypot(lx - cx, lz - cz);
};

/**
 * How many times finer than usual to draw the field of a node with the given frame (the static part of its scale, see nodeFrame in
 * sdf/treeOps.ts): a frame below 1 makes it larger on the bars, and so its pixels. A power of two, so scaling only draws it again now and then
 */
export const fieldDetail = (frame: number): number => (frame > 0 ? 2 ** Math.min(Math.max(Math.ceil(Math.log2(1 / frame) - 0.25), 0), 3) : 1);
