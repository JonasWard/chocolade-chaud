// the outline of a drawn shape as closed polylines, traced from the antialiased coverage of its pixels

/** a closed polyline, x0, y0, x1, y1, ..., without repeating its first point */
export type Contour = Float64Array;

/**
 * The outline where the coverage (0 outside, 1 inside) crosses a half, between the pixel centres (pixel (i, j) has its centre
 * at (i + 0.5, j + 0.5)), linear along the edges between them (marching squares). Beyond the pixels there is nothing, so every
 * outline is closed. They run with the inside on their left (x to the right, y down: turning from x to y is to the left),
 * an outer one and a hole the other way around
 */
export const traceCoverage = (coverage: ArrayLike<number>, width: number, height: number): Contour[] => {
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < width && j < height ? coverage[j * width + i] : 0);
  // an edge between two pixel centres: horizontal from (i, j) to (i + 1, j), vertical from (i, j) to (i, j + 1); from -1 on
  const stride = width + 2;
  const edgeKey = (i: number, j: number, vertical: boolean) => (((j + 1) * stride + (i + 1)) << 1) | (vertical ? 1 : 0);
  const next = new Map<number, number>();
  const points = new Map<number, [number, number]>();

  const crossing = (key: number, i: number, j: number, vertical: boolean) => {
    if (!points.has(key)) {
      const [fu, fv] = [at(i, j), vertical ? at(i, j + 1) : at(i + 1, j)];
      const t = (0.5 - fu) / (fv - fu);
      points.set(key, vertical ? [i + 0.5, j + 0.5 + t] : [i + 0.5 + t, j + 0.5]);
    }
    return key;
  };

  for (let j = -1; j < height; j++) {
    for (let i = -1; i < width; i++) {
      // the corners clockwise: top left, top right, bottom right, bottom left
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const count = +(a >= 0.5) + +(b >= 0.5) + +(c >= 0.5) + +(d >= 0.5);
      // most cells are all inside or all outside
      if (count === 0 || count === 4) continue;
      const values = [a, b, c, d];
      const inside = values.map((v) => v >= 0.5);
      // the edge after corner k clockwise: top, right, bottom, left
      const edge = (k: number) => {
        switch (k & 3) {
          case 0:
            return crossing(edgeKey(i, j, false), i, j, false);
          case 1:
            return crossing(edgeKey(i + 1, j, true), i + 1, j, true);
          case 2:
            return crossing(edgeKey(i, j + 1, false), i, j + 1, false);
          default:
            return crossing(edgeKey(i, j, true), i, j, true);
        }
      };
      const link = (from: number, to: number) => next.set(from, to);

      const saddle = count === 2 && inside[0] === inside[2];
      if (saddle) {
        const centre = values.reduce((a, b) => a + b, 0) / 4 >= 0.5;
        for (let k = 0; k < 4; k++) {
          // around every corner on its own: an inside one from the edge after it to the one before it, an outside one the other way
          if (centre ? inside[k] : !inside[k]) continue;
          if (inside[k]) link(edge(k), edge(k + 3));
          else link(edge(k + 3), edge(k));
        }
        continue;
      }
      // the run of inside corners, from the edge after its last corner to the edge before its first
      const first = [0, 1, 2, 3].find((k) => inside[k] && !inside[(k + 3) & 3])!;
      let last = first;
      while (inside[(last + 1) & 3]) last = (last + 1) & 3;
      link(edge(last), edge(first + 3));
    }
  }

  const contours: Contour[] = [];
  const visited = new Set<number>();
  for (const start of next.keys()) {
    if (visited.has(start)) continue;
    const loop: number[] = [];
    for (let key: number | undefined = start; key !== undefined && !visited.has(key); key = next.get(key)) {
      visited.add(key);
      loop.push(...points.get(key)!);
    }
    if (loop.length >= 6) contours.push(Float64Array.from(loop));
  }
  return contours;
};

/** twice the area inside the contour, positive when it runs with the inside on its left */
export const signedArea = (c: Contour): number => {
  let sum = 0;
  const n = c.length / 2;
  for (let k = 0; k < n; k++) {
    const l = (k + 1) % n;
    sum += c[2 * k] * c[2 * l + 1] - c[2 * l] * c[2 * k + 1];
  }
  return sum;
};

/** one pass of [1, 2, 1] / 4 over the points, against the steps of the pixels */
export const smoothContour = (c: Contour): Contour => {
  const n = c.length / 2;
  const out = new Float64Array(c.length);
  for (let k = 0; k < n; k++) {
    const [p, q] = [(k + n - 1) % n, (k + 1) % n];
    out[2 * k] = (c[2 * p] + 2 * c[2 * k] + c[2 * q]) / 4;
    out[2 * k + 1] = (c[2 * p + 1] + 2 * c[2 * k + 1] + c[2 * q + 1]) / 4;
  }
  return out;
};

const segmentDistance = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const [dx, dy] = [bx - ax, by - ay];
  const length = dx * dx + dy * dy;
  const t = length > 0 ? Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / length, 0), 1) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** the fewest points within tolerance of the contour (Douglas-Peucker), at least 3 */
export const simplifyContour = (c: Contour, tolerance: number): Contour => {
  const n = c.length / 2;
  if (n <= 3) return c;
  const keep = new Uint8Array(n + 1);
  // closed: from the first point round to itself, split at the point furthest from it
  let far = 0;
  let best = -1;
  for (let k = 1; k < n; k++) {
    const d = Math.hypot(c[2 * k] - c[0], c[2 * k + 1] - c[1]);
    if (d > best) [best, far] = [d, k];
  }
  const x = (k: number) => c[2 * (k % n)];
  const y = (k: number) => c[2 * (k % n) + 1];
  keep[0] = keep[far] = keep[n] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, n],
  ];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let index = -1;
    let max = tolerance;
    for (let k = from + 1; k < to; k++) {
      const d = segmentDistance(x(k), y(k), x(from), y(from), x(to), y(to));
      if (d > max) [max, index] = [d, k];
    }
    if (index < 0) continue;
    keep[index] = 1;
    stack.push([from, index], [index, to]);
  }
  const kept: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) kept.push(c[2 * k], c[2 * k + 1]);
  return kept.length >= 6 ? Float64Array.from(kept) : c;
};

/** the contour moved: scaled, turned by angle (radians) and moved by (dx, dy), so pixels become mm */
export const placeContour = (c: Contour, scale: number, angle: number, dx: number, dy: number): Contour => {
  const [cos, sin] = [Math.cos(angle) * scale, Math.sin(angle) * scale];
  const out = new Float64Array(c.length);
  for (let k = 0; k < c.length; k += 2) {
    out[k] = cos * c[k] - sin * c[k + 1] + dx;
    out[k + 1] = sin * c[k] + cos * c[k + 1] + dy;
  }
  return out;
};
