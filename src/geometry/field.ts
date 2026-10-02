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

/** bilinear sample of the field at a location relative to its corner, see fieldDistance in three/shaders/bake.ts */
export const sampleField = ({ width, height, pixelSize, distances }: IDistanceField, x: number, z: number): number => {
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
