import { angleFromEnd, rotateLine } from '../../src/hooks/useCurveEditing';

test('a straight text is a line through its centre along its angle', () => {
  const line = rotateLine({ size: 10, text: 'Chaud', angle: 90 });
  expect(line.points.map((p) => [+p.x.toFixed(9), +p.z.toFixed(9)])).toEqual([
    [-0, -17.5],
    [0, 17.5],
  ]);
  // a short text is at least twice its size long
  const short = rotateLine({ size: 10, text: 'a', angle: 0 });
  expect(short.points).toEqual([
    { x: -10, z: -0 },
    { x: 10, z: 0 },
  ]);
});

test('dragging an end of the line turns the text around its centre', () => {
  expect(angleFromEnd(1, { x: 0, z: 10 })).toBe(90);
  // the start end points the other way
  expect(angleFromEnd(0, { x: 0, z: 10 })).toBe(-90);
  expect(angleFromEnd(1, { x: -10, z: 0 })).toBe(180);
  expect(angleFromEnd(1, { x: 10, z: 10.0001 })).toBe(45);
  // the line of the angle it gives has its end where it was dragged, up to the tenth of a degree the angle is rounded to
  const [, end] = rotateLine({ size: 10, text: 'Chaud', angle: angleFromEnd(1, { x: 3, z: 4 }) }).points;
  expect(Math.abs(Math.atan2(end.z, end.x) - Math.atan2(4, 3))).toBeLessThanOrEqual((0.05 * Math.PI) / 180);
});
