import { Vec2 } from '../vec2';
import { sdBoolean, sdCircle, sdCircleSegment, sdLine } from '../sdMethods';

const cs = [
  [new Vec2(18, -86), 100, -1],
  [new Vec2(20, -119), 150, -1],
  [new Vec2(214, -23), 198, -1],
  [new Vec2(187, -45), 160, -1],
  [new Vec2(159, -76), 134, -1],
  [new Vec2(-209, -34), 200, -1],
  [new Vec2(-178, -58), 160, -1],
] as [Vec2, number, -1 | 1][];

const vShift = new Vec2(-67, -33);

export const sdGeometry = (p: Vec2): number => {
  const v = p.subtract(vShift).scale(0.5);
  v.set(v.y, -v.x);

  let d = 1000;
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(28.5496441825, -49.876256281), new Vec2(34.8625303151, -37.193994026), new Vec2(38.8436252875, -40.1435146201))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(41.8864249142, -37.2984497859), new Vec2(38.8436252875, -40.1435146201), new Vec2(42.4549136739, -41.4251729422))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(39.9981623366, -19.6195055984), new Vec2(42.4549136739, -41.4251729422), new Vec2(51.3746058391, -38.3838145033))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(21.5765506077, 22.3202460519), new Vec2(51.3746058391, -38.3838145033), new Vec2(60.4919276317, -32.9834653474))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(59.343132455, -30.9845269838), new Vec2(60.4919276317, -32.9834653474), new Vec2(61.6206770219, -30.6263710325))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(47.5342918149, -31.6293162903), new Vec2(61.6206770219, -30.6263710325), new Vec2(58.6953831712, -22.9770225408))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(41.2841284545, -36.6666584225), new Vec2(58.6953831712, -22.9770225408), new Vec2(50.6092677933, -16.5768675402))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(45.9244459658, -26.9009237664), new Vec2(50.6092677933, -16.5768675402), new Vec2(40.9776008829, -16.6998249901))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(59.6239994368, -46.7553455874), new Vec2(40.9776008829, -16.6998249901), new Vec2(29.2423952351, -28.6451102621))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(38.9973256731, -35.90241029), new Vec2(29.2423952351, -28.6451102621), new Vec2(27.1953230731, -32.980115614))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(28.8765423944, -33.6521131325), new Vec2(27.1953230731, -32.980115614), new Vec2(28.4054088164, -35.4002871007))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(25.5538778852, -60.3808688004), new Vec2(28.4054088164, -35.4002871007), new Vec2(32.575027363, -36.2382891802))
  );
  d = sdBoolean(
    d,
    sdCircleSegment(v, new Vec2(30.0956308923, -45.3882349389), new Vec2(32.575027363, -36.2382891802), new Vec2(34.8625303151, -37.193994026))
  );

  return d;
};

export const sdGeometryBis = (v: Vec2, s: number): number => {
  v.set(v.x, v.y + 100);
  const l0 = new Vec2(3, 0);
  const ld = new Vec2(5, -100).normalize();

  const sideMap = (n: number): number => (Math.abs(n) + n * 0.1) / 1.1;

  // const l = sideMap(sdLine(v, l0.scale(s), ld));
  const l = sideMap(sdLine(v, l0.scale(s), l0.add(ld)));
  const cDs = cs.map(([c, r]) => sideMap(sdCircle(v, c.scale(s), r * s))).reduce((a, b) => sdBoolean(a, b));
  const d = sdBoolean(l, cDs);
  return d * 10 - 2;
};

