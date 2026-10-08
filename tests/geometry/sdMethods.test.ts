import {
  sdCircle,
  sdCurtailedLine,
  sdCurtailedPolyLine,
  sdCylinder,
  sdGyroid,
  sdLine,
  sdLineParametric,
  sdTorus,
  vectorInPolygon,
} from '../../src/geometry/sdMethods';
import { Vec2 as Vector2 } from '../../src/geometry/vec2';

test('line and pyline distance', () => {
  expect(sdLine(new Vector2(0, 0), new Vector2(0, 0), new Vector2(1, 0))).toBe(0);
  expect(sdLine(new Vector2(1, 0), new Vector2(0, 0), new Vector2(1, 0))).toBe(0);
  expect(sdLine(new Vector2(2, 0), new Vector2(0, 0), new Vector2(1, 0))).toBe(0);
  expect(sdLine(new Vector2(0, 1), new Vector2(0, 0), new Vector2(1, 0))).toBe(1);
  expect(sdLine(new Vector2(0, 2), new Vector2(0, 0), new Vector2(1, 0))).toBe(2);
  expect(sdLine(new Vector2(0, -2), new Vector2(0, 0), new Vector2(1, 0))).toBe(-2);
  expect(sdLine(new Vector2(0, -2), new Vector2(0, 0), new Vector2(2, 0))).toBe(-2);
  expect(sdLine(new Vector2(0, -2), new Vector2(1, 1), new Vector2(2, 1))).toBe(-3);
  expect(sdLine(new Vector2(0, 2), new Vector2(1, 1), new Vector2(2, 1))).toBe(1);

  expect(sdLineParametric(new Vector2(1, 0), new Vector2(0, 0), new Vector2(1, 1))).toEqual({
    t: 0.5,
    sign: -1,
    distance: 0.7071067811865476,
  });
  expect(sdLine(new Vector2(1, 0), new Vector2(0, 0), new Vector2(1, 1))).toBe(-0.7071067811865476);
  expect(sdLineParametric(new Vector2(1, 1), new Vector2(0, 0), new Vector2(1, 1))).toEqual({
    t: 1,
    sign: 1,
    distance: 0,
  });
  expect(sdLine(new Vector2(1, 1), new Vector2(0, 0), new Vector2(1, 1))).toBe(0);

  expect(sdCurtailedLine(new Vector2(0, -2), new Vector2(0, 0), new Vector2(1, 0))).toBe(2);
  expect(sdLine(new Vector2(-2, -2), new Vector2(0, 0), new Vector2(1, 0))).toBe(-2);
  expect(sdCurtailedLine(new Vector2(-2, -2), new Vector2(0, 0), new Vector2(2, 0))).toBe(2.8284271247461903);
  expect(sdCurtailedLine(new Vector2(1, 0.5), new Vector2(0, 0), new Vector2(2, 0))).toBe(0.5);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(0, 0), new Vector2(2, 0))).toBe(1.0);

  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(0, 2), new Vector2(2, 2))).toBe(1);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(2, 2), new Vector2(2, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(2, 0), new Vector2(0, 0))).toBe(1);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(0, 0), new Vector2(0, 2))).toBe(0.5);

  expect(sdCurtailedLine(new Vector2(0.5, 0.5), new Vector2(0, 2), new Vector2(2, 2))).toBe(1.5);
  expect(sdCurtailedLine(new Vector2(0.5, 0.5), new Vector2(2, 2), new Vector2(2, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector2(0.5, 0.5), new Vector2(2, 0), new Vector2(0, 0))).toBe(0.5);
  expect(sdCurtailedLine(new Vector2(0.5, 0.5), new Vector2(0, 0), new Vector2(0, 2))).toBe(0.5);

  expect(sdLine(new Vector2(1, 1), new Vector2(0, 2), new Vector2(2, 2))).toBe(-1);
  expect(sdLine(new Vector2(1, 1), new Vector2(2, 2), new Vector2(2, 0))).toBe(-1);
  expect(sdLine(new Vector2(1, 1), new Vector2(2, 0), new Vector2(0, 0))).toBe(-1);
  expect(sdLine(new Vector2(1, 1), new Vector2(0, 0), new Vector2(0, 2))).toBe(-1);

  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(0, 2), new Vector2(2, 2))).toBe(1);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(2, 2), new Vector2(2, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(2, 0), new Vector2(0, 0))).toBe(1);
  expect(sdCurtailedLine(new Vector2(0.5, 1), new Vector2(0, 0), new Vector2(0, 2))).toBe(0.5);

  expect(sdCurtailedPolyLine(new Vector2(3, 0), [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 2), new Vector2(0, 2)], true)).toBe(1);
  expect(sdCurtailedPolyLine(new Vector2(1, 1), [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 2), new Vector2(0, 2)], true)).toBe(-1);
  expect(sdCurtailedPolyLine(new Vector2(0.5, 1), [new Vector2(0, 2), new Vector2(2, 2), new Vector2(2, 0), new Vector2(0, 0)], true)).toBe(-0.5);
});

test('circle distance', () => {
  expect(sdCircle(new Vector2(0, 0), new Vector2(0, 0), 1)).toBe(-1);
  expect(sdCircle(new Vector2(1, 0), new Vector2(0, 0), 1)).toBe(0);
  expect(sdCircle(new Vector2(2, 0), new Vector2(0, 0), 1)).toBe(1);
});

test('vector in polygon', () => {
  expect(vectorInPolygon(new Vector2(0, 0), [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)])).toBe(true);
  expect(vectorInPolygon(new Vector2(-1, 1), [new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)])).toBe(false);
  expect(vectorInPolygon(new Vector2(-1, -1), [new Vector2(1, -1), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1)])).toBe(false);
  expect(vectorInPolygon(new Vector2(-1, -1), [new Vector2(-1, 0), new Vector2(1, 1), new Vector2(1, 2), new Vector2(0, 2)])).toBe(false);
  expect(vectorInPolygon(new Vector2(0.99, 1.01), [new Vector2(-1, 0), new Vector2(1, 1), new Vector2(1, 2), new Vector2(0, 2)])).toBe(true);
  expect(vectorInPolygon(new Vector2(3, 0), [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 2), new Vector2(0, 2)])).toBe(false);
  expect(vectorInPolygon(new Vector2(1, 1), [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 2), new Vector2(0, 2)])).toBe(true);
  expect(vectorInPolygon(new Vector2(0.5, 1), [new Vector2(0, 2), new Vector2(2, 2), new Vector2(2, 0), new Vector2(0, 0)])).toBe(true); // inside the square, orientation does not matter
});

test('vector in polygon for points far from the polygon', () => {
  const square = [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 2), new Vector2(0, 2)];
  expect(vectorInPolygon(new Vector2(100, 1), square)).toBe(false);
  expect(vectorInPolygon(new Vector2(1, 1.5), square)).toBe(true);
  // concave polygon, the point is in the notch
  const u = [new Vector2(0, 0), new Vector2(3, 0), new Vector2(3, 3), new Vector2(2, 3), new Vector2(2, 1), new Vector2(1, 1), new Vector2(1, 3), new Vector2(0, 3)];
  expect(vectorInPolygon(new Vector2(1.5, 2), u)).toBe(false);
  expect(vectorInPolygon(new Vector2(0.5, 2), u)).toBe(true);
});

test('3d distance methods', () => {
  expect(sdGyroid(0, 0, 0, 1)).toBe(0);
  expect(sdTorus(1, 0, 0, 1)).toBe(-0.25);
  expect(sdTorus(2, 0, 0, 0.5)).toBe(-0.25);
  expect(sdCylinder(0, 1, 0, 1)).toBe(1);
});
