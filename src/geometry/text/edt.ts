const INF = 1e20;

// one dimensional squared distance transform (Felzenszwalb & Huttenlocher), in place on f[offset + q * stride]
const transform1D = (f: Float64Array, offset: number, stride: number, n: number, d: Float64Array, v: Int32Array, z: Float64Array) => {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    const fq = f[offset + q * stride] + q * q;
    let s: number;
    do {
      const p = v[k];
      s = (fq - (f[offset + p * stride] + p * p)) / (2 * q - 2 * p);
    } while (s <= z[k] && --k >= 0);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[offset + p * stride];
  }
  for (let q = 0; q < n; q++) f[offset + q * stride] = d[q];
};

// squared distance (in pixels) of every pixel to the nearest pixel for which the mask equals target
const squaredDistances = (mask: ArrayLike<number>, width: number, height: number, target: boolean): Float64Array => {
  const f = new Float64Array(width * height);
  for (let p = 0; p < f.length; p++) f[p] = !!mask[p] === target ? 0 : INF;

  const n = Math.max(width, height);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < width; x++) transform1D(f, x, width, height, d, v, z);
  for (let y = 0; y < height; y++) transform1D(f, y * width, 1, width, d, v, z);
  return f;
};

/**
 * Exact euclidean signed distance (in pixels) to the outline of a mask: negative inside (mask set), positive outside.
 * The outline lies half a pixel from the centres of the pixels along it. A mask that is all set or all clear has no outline,
 * its distances are -Infinity or Infinity.
 */
export const signedDistanceTransform = (mask: ArrayLike<number>, width: number, height: number): Float32Array => {
  const toInside = squaredDistances(mask, width, height, true);
  const toOutside = squaredDistances(mask, width, height, false);

  const result = new Float32Array(width * height);
  for (let p = 0; p < result.length; p++) {
    const squared = mask[p] ? toOutside[p] : toInside[p];
    const distance = squared >= INF ? Infinity : Math.sqrt(squared) - 0.5;
    result[p] = mask[p] ? -distance : distance;
  }
  return result;
};
