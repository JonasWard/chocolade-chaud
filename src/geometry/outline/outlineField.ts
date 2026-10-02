import { IDistanceField, IFieldLevel, LEVEL_REACH } from '../field';
import { Contour, simplifyContour } from './trace';

// the signed distance field of a shape given by its outline: exact, to the closed polylines, at every pixel centre

const segmentDistanceSquared = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / length, 0), 1) : 0;
  const ex = px - ax - t * dx;
  const ey = py - ay - t * dy;
  return ex * ex + ey * ey;
};

/**
 * The signed distance (in the unit of the contours, negative inside) at the pixel centres of a grid of width x height pixels of
 * pixelSize with its corner at (x0, y0). Inside is where the contours wind around (nonzero), so overlapping shapes add up
 */
export const levelField = (contours: Contour[], x0: number, y0: number, width: number, height: number, pixelSize: number): Float32Array => {
  // the segments in pixels, the centre of pixel (i, j) at (i, j)
  const count = contours.reduce((n, c) => n + c.length / 2, 0);
  const segments = new Float64Array(count * 4);
  // the segments before and after every segment along its contour
  const [before, after] = [new Int32Array(count), new Int32Array(count)];
  let s = 0;
  for (const c of contours) {
    const n = c.length / 2;
    const first = s / 4;
    for (let k = 0; k < n; k++) {
      const l = (k + 1) % n;
      before[first + k] = first + ((k + n - 1) % n);
      after[first + k] = first + l;
      segments[s++] = (c[2 * k] - x0) / pixelSize - 0.5;
      segments[s++] = (c[2 * k + 1] - y0) / pixelSize - 0.5;
      segments[s++] = (c[2 * l] - x0) / pixelSize - 0.5;
      segments[s++] = (c[2 * l + 1] - y0) / pixelSize - 0.5;
    }
  }

  // inside: along every row, the winding of the segments crossing it left of every pixel centre
  const crossings: number[][] = Array.from({ length: height }, () => []);
  for (let k = 0; k < count; k++) {
    const [ax, ay, bx, by] = segments.subarray(4 * k, 4 * k + 4);
    if (ay === by) continue;
    const up = by > ay;
    const [from, to] = up ? [ay, by] : [by, ay];
    // half open, so a row through a point between two segments counts once
    for (let j = Math.max(Math.ceil(from), 0); j < Math.min(to, height); j++) {
      if (j === to) continue;
      const x = ax + ((j - ay) * (bx - ax)) / (by - ay);
      crossings[j].push(x, up ? 1 : -1);
    }
  }
  const inside = new Uint8Array(width * height);
  crossings.forEach((row, j) => {
    const order = Array.from({ length: row.length / 2 }, (_, k) => k).sort((a, b) => row[2 * a] - row[2 * b]);
    let winding = 0;
    let i = 0;
    for (const k of order) {
      for (; i < width && i < row[2 * k]; i++) inside[j * width + i] = winding !== 0 ? 1 : 0;
      winding += row[2 * k + 1];
    }
    for (; i < width; i++) inside[j * width + i] = winding !== 0 ? 1 : 0;
  });

  // every pixel a segment passes through starts with the nearest of those segments
  const best = new Int32Array(width * height).fill(-1);
  const squared = new Float64Array(width * height).fill(Infinity);
  const offer = (p: number, k: number) => {
    const x = p % width;
    const d = segmentDistanceSquared(x, (p - x) / width, segments[4 * k], segments[4 * k + 1], segments[4 * k + 2], segments[4 * k + 3]);
    if (d < squared[p]) {
      squared[p] = d;
      best[p] = k;
    }
  };
  const cell = (u: number, size: number) => Math.min(Math.max(Math.round(u), 0), size - 1);
  for (let k = 0; k < count; k++) {
    const [ax, ay, bx, by] = segments.subarray(4 * k, 4 * k + 4);
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5) + 1;
    for (let t = 0; t <= steps; t++) {
      const [x, y] = [cell(ax + ((bx - ax) * t) / steps, width), cell(ay + ((by - ay) * t) / steps, height)];
      // and the pixels around it, so the start is exact near the outline
      for (let j = Math.max(y - 1, 0); j <= Math.min(y + 1, height - 1); j++) for (let i = Math.max(x - 1, 0); i <= Math.min(x + 1, width - 1); i++) offer(j * width + i, k);
    }
  }

  // then every pixel takes the segment of a neighbour when that is nearer to it, in a sweep down and one up (as 8SSEDT does with points)
  const take = (p: number, n: number) => {
    if (best[n] >= 0 && best[n] !== best[p]) offer(p, best[n]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (y > 0) {
        if (x > 0) take(p, p - width - 1);
        take(p, p - width);
        if (x < width - 1) take(p, p - width + 1);
      }
      if (x > 0) take(p, p - 1);
    }
    for (let x = width - 2; x >= 0; x--) take(y * width + x, y * width + x + 1);
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (y < height - 1) {
        if (x < width - 1) take(p, p + width + 1);
        take(p, p + width);
        if (x > 0) take(p, p + width - 1);
      }
      if (x < width - 1) take(p, p + 1);
    }
    for (let x = 1; x < width; x++) take(y * width + x, y * width + x - 1);
  }

  // where the regions nearest to the segments are narrower than a pixel (inside a curve, far away), a neighbour's segment is not
  // quite the nearest, that one is a little further along the contour: follow it as long as the distance goes down
  for (let p = 0; p < best.length; p++) {
    if (best[p] < 0) continue;
    for (let k = best[p], previous = -1; k !== previous; ) {
      previous = k;
      offer(p, before[k]);
      offer(p, after[k]);
      k = best[p];
    }
  }

  const result = new Float32Array(width * height);
  for (let p = 0; p < result.length; p++) result[p] = (inside[p] ? -1 : 1) * Math.sqrt(squared[p]) * pixelSize;
  return result;
};

/** pixels along the long side of the coarser levels of a field */
const LEVEL_SIZE = 512;
/** how many coarser levels a field has, the last reaches LEVEL_REACH ** LEVEL_COUNT as far */
export const LEVEL_COUNT = 3;
/** how far from the outline the contours of a level may be simplified, in its pixels */
const LEVEL_TOLERANCE = 0.05;

export interface IFieldBox {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * The distance field of the outline over the box, with pixels of pixelSize (larger when the box would have more than maxSize along
 * a side), and coarser levels around it that reach further. Centred on the box, the caller sets its centre where needed
 */
export const buildOutlineField = (contours: Contour[], box: IFieldBox, pixelSize: number, maxSize = 2048): IDistanceField => {
  const [extentX, extentZ] = [box.maxX - box.minX, box.maxZ - box.minZ];
  const [cx, cz] = [(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2];
  const p0 = Math.max(pixelSize, Math.max(extentX, extentZ) / maxSize);
  const [w0, h0] = [Math.max(1, Math.ceil(extentX / p0)), Math.max(1, Math.ceil(extentZ / p0))];

  const level = (width: number, height: number, p: number, outline: Contour[]): IFieldLevel => ({
    width,
    height,
    pixelSize: p,
    distances: levelField(outline, cx - (width * p) / 2, cz - (height * p) / 2, width, height, p),
  });

  // every coarser level as many pixels, so they fit side by side in a texture (see createFieldTexture in three/shaders/bake.ts)
  const shrink = Math.max(1, Math.max(w0, h0) / LEVEL_SIZE);
  const [w1, h1] = [Math.max(1, Math.ceil(w0 / shrink)), Math.max(1, Math.ceil(h0 / shrink))];
  const levels = Array.from({ length: LEVEL_COUNT }, (_, k) => {
    // the same reach as the finest level times LEVEL_REACH ** (k + 1)
    const p = (Math.max(w0 * p0, h0 * p0) * LEVEL_REACH ** (k + 1)) / Math.max(w1, h1);
    return level(w1, h1, p, contours.map((c) => simplifyContour(c, LEVEL_TOLERANCE * p)));
  });
  return { ...level(w0, h0, p0, contours), levels };
};
