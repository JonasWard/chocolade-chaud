import { ICurve, arcLengths, canDelete, convert, cubicPoint, deleteAt, flatten, insertAt, moveAt, pointAt, segmentCount, segmentMidpoints, straightCurve } from './curve';

const spline: ICurve = {
  mode: 'spline',
  points: [
    { x: 0, z: 0 },
    { x: 10, z: 20 },
    { x: 30, z: -20 },
    { x: 40, z: 0 },
    { x: 50, z: 20 },
    { x: 60, z: 10 },
    { x: 70, z: 0 },
  ],
};

test('splitting a cubic keeps its shape', () => {
  const { curve, index } = insertAt(spline, 0);
  expect(curve.points.length).toBe(10);
  expect(index).toBe(3);
  const [p0, c1, c2, p3] = spline.points;
  // the first half of the old segment is the new first segment, at twice the parameter
  [0.1, 0.25, 0.4].forEach((t) => {
    const before = cubicPoint(p0, c1, c2, p3, t);
    const after = cubicPoint(curve.points[0], curve.points[1], curve.points[2], curve.points[3], 2 * t);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.z).toBeCloseTo(before.z, 10);
  });
  // the new anchor is on the old curve
  expect(curve.points[3]).toEqual(segmentMidpoints(spline)[0]);
  // the second segment is unchanged
  expect(curve.points.slice(6)).toEqual(spline.points.slice(3));
});

test('deleting an anchor merges its segments, controls and the last segment stay', () => {
  expect(canDelete(spline, 1)).toBe(false);
  expect(deleteAt(spline, 1)).toBe(spline);
  const merged = deleteAt(spline, 3);
  expect(merged.points).toEqual([spline.points[0], spline.points[1], spline.points[5], spline.points[6]]);
  expect(deleteAt(spline, 0).points).toEqual(spline.points.slice(3));
  expect(deleteAt(spline, 6).points).toEqual(spline.points.slice(0, 4));
  expect(deleteAt(merged, 0)).toBe(merged);
  // insert then delete gives the anchors back
  const { curve, index } = insertAt(spline, 1);
  expect(deleteAt(curve, index).points.filter((_, i) => i % 3 === 0)).toEqual(spline.points.filter((_, i) => i % 3 === 0));
});

test('polyline edits', () => {
  const line = straightCurve('polyline', 20);
  const { curve, index } = insertAt(line, 0);
  expect(curve.points).toEqual([{ x: -10, z: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }]);
  expect(index).toBe(1);
  expect(segmentCount(curve)).toBe(2);
  expect(deleteAt(curve, 1)).toEqual(line);
  expect(deleteAt(line, 0)).toBe(line);
  expect(moveAt(curve, 1, { x: 0, z: 5 }).points[1]).toEqual({ x: 0, z: 5 });
});

test('moving a spline anchor carries its controls', () => {
  const moved = moveAt(spline, 3, { x: 41, z: 2 });
  expect(moved.points.slice(2, 5)).toEqual([
    { x: 31, z: -18 },
    { x: 41, z: 2 },
    { x: 51, z: 22 },
  ]);
  expect(moveAt(spline, 1, { x: 0, z: 0 }).points[0]).toEqual(spline.points[0]);
});

test('converting between polyline and spline', () => {
  const line: ICurve = { mode: 'polyline', points: [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 30 }] };
  const asSpline = convert(line, 'spline');
  expect(asSpline.points.length).toBe(7);
  expect(asSpline.points[1]).toEqual({ x: 10, z: 0 });
  expect(convert(asSpline, 'polyline')).toEqual(line);
  // a spline from a polyline runs along it
  expect(flatten(asSpline)[16]).toEqual({ x: 15, z: 0 });
});

test('arc length and extrapolation', () => {
  const corner = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  const lengths = arcLengths(corner);
  expect(lengths).toEqual([0, 10, 20]);
  expect(pointAt(corner, lengths, 5)).toEqual({ point: { x: 5, z: 0 }, tangent: { x: 1, z: 0 } });
  expect(pointAt(corner, lengths, 15)).toEqual({ point: { x: 10, z: 5 }, tangent: { x: 0, z: 1 } });
  expect(pointAt(corner, lengths, -3).point).toEqual({ x: -3, z: 0 });
  expect(pointAt(corner, lengths, 24).point).toEqual({ x: 10, z: 14 });
  expect(arcLengths(flatten(straightCurve('spline', 40))).at(-1)).toBeCloseTo(40, 10);
});
