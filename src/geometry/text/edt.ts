const INF = 1e20;

// one dimensional squared distance transform (Felzenszwalb & Huttenlocher), in place on f[offset + q * stride],
// nearest gets the index of the sample every distance is to
const transform1D = (
  f: Float64Array,
  nearest: Int32Array,
  offset: number,
  stride: number,
  n: number,
  d: Float64Array,
  from: Int32Array,
  v: Int32Array,
  z: Float64Array
) => {
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
    from[q] = p;
  }
  for (let q = 0; q < n; q++) {
    f[offset + q * stride] = d[q];
    nearest[offset + q * stride] = from[q];
  }
};

// exact squared distance (in pixels) of every pixel to the nearest pixel for which mask equals target
const squaredDistances = (mask: ArrayLike<number>, width: number, height: number, target: boolean): Float64Array => {
  const f = new Float64Array(width * height);
  for (let p = 0; p < f.length; p++) f[p] = !!mask[p] === target ? 0 : INF;
  const n = Math.max(width, height);
  const [d, from, v, z] = [new Float64Array(n), new Int32Array(n), new Int32Array(n), new Float64Array(n + 1)];
  const unused = new Int32Array(width * height);
  for (let x = 0; x < width; x++) transform1D(f, unused, x, width, height, d, from, v, z);
  for (let y = 0; y < height; y++) transform1D(f, unused, y * width, 1, width, d, from, v, z);
  return f;
};

/** a hard mask: the exact distance to the nearest pixel on the other side, the outline half a pixel from it */
const hardDistanceTransform = (mask: ArrayLike<number>, width: number, height: number): Float32Array => {
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

/** for every pixel the nearest seed pixel (by their centres), as its index, -1 when there are no seeds */
const nearestSeeds = (seeds: Uint8Array, width: number, height: number): Int32Array => {
  const f = new Float64Array(width * height);
  for (let p = 0; p < f.length; p++) f[p] = seeds[p] ? 0 : INF;
  const n = Math.max(width, height);
  const [d, from, v, z] = [new Float64Array(n), new Int32Array(n), new Int32Array(n), new Float64Array(n + 1)];
  // down the columns: the row of the nearest seed in the column, then along the rows: the column whose nearest seed is nearest
  const rows = new Int32Array(width * height);
  const columns = new Int32Array(width * height);
  for (let x = 0; x < width; x++) transform1D(f, rows, x, width, height, d, from, v, z);
  for (let y = 0; y < height; y++) transform1D(f, columns, y * width, 1, width, d, from, v, z);

  const nearest = new Int32Array(width * height);
  for (let p = 0; p < nearest.length; p++) {
    if (f[p] >= INF) nearest[p] = -1;
    else {
      const x = columns[p];
      nearest[p] = rows[Math.floor(p / width) * width + x] * width + x;
    }
  }
  return nearest;
};

const SQRT2 = Math.SQRT2;

/**
 * How far the outline is from the centre of a pixel with coverage a, along the unit gradient (nx, ny) of the coverage,
 * for a straight outline: a corner of the pixel is cut off for a small or a big coverage, else it crosses the whole pixel
 * (Gustavson's edgedf)
 */
const edgeOffset = (nx: number, ny: number, a: number): number => {
  let [gx, gy] = [Math.abs(nx), Math.abs(ny)];
  if (gx < gy) [gx, gy] = [gy, gx];
  if (gy < 1e-9) return 0.5 - a;
  const a1 = (0.5 * gy) / gx;
  if (a < a1) return 0.5 * (gx + gy) - Math.sqrt(2 * gx * gy * a);
  if (a < 1 - a1) return (0.5 - a) * gx;
  return -0.5 * (gx + gy) + Math.sqrt(2 * gx * gy * (1 - a));
};

/**
 * Euclidean signed distance (in pixels) to the outline of a shape given by its coverage of every pixel, 0 outside, 1 inside:
 * negative inside, positive outside. Pixel centres are a pixel apart.
 *
 * Every pixel along the outline (antialiased, or a hard one next to the other side) gets the point where the outline crosses it:
 * from its centre along the gradient of the coverage, as far as its coverage says (Gustavson's antialiased transform).
 * The distance of a pixel is to that point of its nearest outline pixel, so it is sub-pixel accurate for an antialiased shape.
 * A hard mask (no antialiased pixel) gets the exact distance to its pixels, the outline half a pixel from the centres along it.
 * A shape without an outline gives -Infinity or Infinity.
 */
export const signedDistanceTransform = (coverage: ArrayLike<number>, width: number, height: number): Float32Array => {
  if (Array.prototype.every.call(coverage, (a: number) => a <= 0 || a >= 1)) return hardDistanceTransform(Array.from(coverage, (a) => (a >= 1 ? 1 : 0)), width, height);
  const at = (x: number, y: number) => Math.min(Math.max(coverage[Math.min(Math.max(y, 0), height - 1) * width + Math.min(Math.max(x, 0), width - 1)], 0), 1);
  const inside = (x: number, y: number) => at(x, y) >= 0.5;

  // the outline pixels: antialiased ones, and hard ones next to a hard pixel of the other side (a hard mask)
  const seeds = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x, y);
      const opposite = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < width && ny < height && at(nx, ny) === 1 - a;
      seeds[y * width + x] = Number((a > 0 && a < 1) || ((a === 0 || a === 1) && (opposite(x - 1, y) || opposite(x + 1, y) || opposite(x, y - 1) || opposite(x, y + 1))));
    }
  }

  // where the outline crosses every outline pixel: along the outward normal, against the gradient of the coverage (sobel).
  // Without a gradient (a single pixel) it is somewhere half a pixel from the centre
  // per outline pixel: the crossing and the unit normal of the outline there, up the gradient. Only the outline pixels have one,
  // slot is where theirs is
  const slot = new Int32Array(width * height).fill(-1);
  let count = 0;
  for (let q = 0; q < seeds.length; q++) if (seeds[q]) slot[q] = count++;
  const crossings = new Float64Array(count * 4).fill(NaN);
  for (let q = 0; q < seeds.length; q++) {
    if (!seeds[q]) continue;
    const [x, y] = [q % width, Math.floor(q / width)];
    const gx = at(x + 1, y - 1) + SQRT2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - SQRT2 * at(x - 1, y) - at(x - 1, y + 1);
    const gy = at(x - 1, y + 1) + SQRT2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - SQRT2 * at(x, y - 1) - at(x + 1, y - 1);
    const length = Math.hypot(gx, gy);
    if (length < 1e-9) continue;
    // towards the inside, up the gradient
    const [nx, ny] = [gx / length, gy / length];
    // a hard pixel is a step of a staircase, its outline half a pixel away
    const a = at(x, y);
    const offset = a > 0 && a < 1 ? edgeOffset(nx, ny, a) : 0.5 - a;
    crossings.set([x + nx * offset, y + ny * offset, nx, ny], 4 * slot[q]);
  }
  // to the crossing of an outline pixel. For an antialiased one, close to the outline the distance to its tangent there, as the
  // nearest point of the outline lies between the crossings; further away the distance to the crossing, which keeps corners right
  const distanceTo = (px: number, py: number, q: number) => {
    const [cx, cy, nx, ny] = crossings.subarray(4 * slot[q], 4 * slot[q] + 4);
    if (Number.isNaN(cx)) return Math.abs(Math.hypot(px - (q % width), py - Math.floor(q / width)) - 0.5) || 0.5;
    const point = Math.hypot(px - cx, py - cy);
    // a hard pixel only knows its outline to half a pixel, no better than its crossing
    const a = coverage[q];
    if (a <= 0 || a >= 1) return point;
    const tangent = Math.abs((px - cx) * nx + (py - cy) * ny);
    const t = Math.min(Math.max(point - 1, 0), 1);
    return tangent + (point - tangent) * t;
  };

  const nearest = nearestSeeds(seeds, width, height);
  const result = new Float32Array(width * height);
  for (let p = 0; p < result.length; p++) {
    const [px, py] = [p % width, Math.floor(p / width)];
    const sign = inside(px, py) ? -1 : 1;
    const q = nearest[p];
    if (q < 0) {
      result[p] = sign * Infinity;
      continue;
    }
    // the nearest outline pixel by its centre, or one next to it, has the nearest crossing
    const [qx, qy] = [q % width, Math.floor(q / width)];
    let distance = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [nx, ny] = [qx + dx, qy + dy];
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && seeds[ny * width + nx]) distance = Math.min(distance, distanceTo(px, py, ny * width + nx));
      }
    }
    result[p] = sign * distance;
  }
  return result;
};
