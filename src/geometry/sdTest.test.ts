import { Vector3 } from '@babylonjs/core';
import { sdCircle, sdCurtailedLine, sdCurtailedPolyLine, sdLine, sdLineParametric, vectorInPolygon } from './sdMethods';

test('line and pyline distance', () => {
  expect(sdLine(new Vector3(0, 0, 0), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(0);
  expect(sdLine(new Vector3(1, 0, 0), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(0);
  expect(sdLine(new Vector3(2, 0, 0), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(0);
  expect(sdLine(new Vector3(0, 0, 1), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(1);
  expect(sdLine(new Vector3(0, 0, 2), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(2);
  expect(sdLine(new Vector3(0, 0, -2), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(-2);
  expect(sdLine(new Vector3(0, 0, -2), new Vector3(0, 0, 0), new Vector3(2, 0, 0))).toBe(-2);
  expect(sdLine(new Vector3(0, 0, -2), new Vector3(1, 0, 1), new Vector3(2, 0, 1))).toBe(-3);
  expect(sdLine(new Vector3(0, 0, 2), new Vector3(1, 0, 1), new Vector3(2, 0, 1))).toBe(1);

  expect(sdLineParametric(new Vector3(1, 0, 0), new Vector3(0, 0, 0), new Vector3(1, 0, 1))).toEqual({
    t: 0.5,
    sign: -1,
    distance: 0.7071067811865476,
  });
  expect(sdLine(new Vector3(1, 0, 0), new Vector3(0, 0, 0), new Vector3(1, 0, 1))).toBe(-0.7071067811865476);
  expect(sdLineParametric(new Vector3(1, 0, 1), new Vector3(0, 0, 0), new Vector3(1, 0, 1))).toEqual({
    t: 1,
    sign: 1,
    distance: 0,
  });
  expect(sdLine(new Vector3(1, 0, 1), new Vector3(0, 0, 0), new Vector3(1, 0, 1))).toBe(0);

  expect(sdCurtailedLine(new Vector3(0, 0, -2), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(2);
  expect(sdLine(new Vector3(-2, 0, -2), new Vector3(0, 0, 0), new Vector3(1, 0, 0))).toBe(-2);
  expect(sdCurtailedLine(new Vector3(-2, 0, -2), new Vector3(0, 0, 0), new Vector3(2, 0, 0))).toBe(2.8284271247461903);
  expect(sdCurtailedLine(new Vector3(1, 0, 0.5), new Vector3(0, 0, 0), new Vector3(2, 0, 0))).toBe(0.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(0, 0, 0), new Vector3(2, 0, 0))).toBe(1.0);

  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(0, 0, 2), new Vector3(2, 0, 2))).toBe(1);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(2, 0, 2), new Vector3(2, 0, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(2, 0, 0), new Vector3(0, 0, 0))).toBe(1);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(0, 0, 0), new Vector3(0, 0, 2))).toBe(0.5);

  expect(sdCurtailedLine(new Vector3(0.5, 0, 0.5), new Vector3(0, 0, 2), new Vector3(2, 0, 2))).toBe(1.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 0.5), new Vector3(2, 0, 2), new Vector3(2, 0, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 0.5), new Vector3(2, 0, 0), new Vector3(0, 0, 0))).toBe(0.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 0.5), new Vector3(0, 0, 0), new Vector3(0, 0, 2))).toBe(0.5);

  expect(sdLine(new Vector3(1, 0, 1), new Vector3(0, 0, 2), new Vector3(2, 0, 2))).toBe(-1);
  expect(sdLine(new Vector3(1, 0, 1), new Vector3(2, 0, 2), new Vector3(2, 0, 0))).toBe(-1);
  expect(sdLine(new Vector3(1, 0, 1), new Vector3(2, 0, 0), new Vector3(0, 0, 0))).toBe(-1);
  expect(sdLine(new Vector3(1, 0, 1), new Vector3(0, 0, 0), new Vector3(0, 0, 2))).toBe(-1);

  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(0, 0, 2), new Vector3(2, 0, 2))).toBe(1);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(2, 0, 2), new Vector3(2, 0, 0))).toBe(1.5);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(2, 0, 0), new Vector3(0, 0, 0))).toBe(1);
  expect(sdCurtailedLine(new Vector3(0.5, 0, 1), new Vector3(0, 0, 0), new Vector3(0, 0, 2))).toBe(0.5);

  expect(sdCurtailedPolyLine(new Vector3(3, 0, 0), [new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(2, 0, 2), new Vector3(0, 0, 2)], true)).toBe(1);
  expect(sdCurtailedPolyLine(new Vector3(1, 0, 1), [new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(2, 0, 2), new Vector3(0, 0, 2)], true)).toBe(-1);
  expect(sdCurtailedPolyLine(new Vector3(0.5, 0, 1), [new Vector3(0, 0, 2), new Vector3(2, 0, 2), new Vector3(2, 0, 0), new Vector3(0, 0, 0)], true)).toBe(
    -0.5
  );
});

test('circle distance', () => {
  expect(sdCircle(new Vector3(0, 0, 0), new Vector3(0, 0, 0), 1)).toBe(-1);
  expect(sdCircle(new Vector3(1, 0, 0), new Vector3(0, 0, 0), 1)).toBe(0);
  expect(sdCircle(new Vector3(2, 0, 0), new Vector3(0, 0, 0), 1)).toBe(1);
});

test('vector in polygon', () => {
  expect(vectorInPolygon(new Vector3(0, 0, 0), [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1)])).toBe(true);
  expect(vectorInPolygon(new Vector3(-1, 0, 1), [new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1)])).toBe(false);
  expect(vectorInPolygon(new Vector3(-1, 0, -1), [new Vector3(1, 0, -1), new Vector3(1, 0, 0), new Vector3(1, 0, 1), new Vector3(0, 0, 1)])).toBe(false);
  expect(vectorInPolygon(new Vector3(-1, 0, -1), [new Vector3(-1, 0, 0), new Vector3(1, 0, 1), new Vector3(1, 0, 2), new Vector3(0, 0, 2)])).toBe(false);
  expect(vectorInPolygon(new Vector3(0.99, 0, 1.01), [new Vector3(-1, 0, 0), new Vector3(1, 0, 1), new Vector3(1, 0, 2), new Vector3(0, 0, 2)])).toBe(true);
  expect(vectorInPolygon(new Vector3(3, 0, 0), [new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(2, 0, 2), new Vector3(0, 0, 2)])).toBe(false);
  expect(vectorInPolygon(new Vector3(1, 0, 1), [new Vector3(0, 0, 0), new Vector3(2, 0, 0), new Vector3(2, 0, 2), new Vector3(0, 0, 2)])).toBe(true);
  expect(vectorInPolygon(new Vector3(0.5, 0, 1), [new Vector3(0, 0, 2), new Vector3(2, 0, 2), new Vector3(2, 0, 0), new Vector3(0, 0, 0)])).toBe(false);
});
