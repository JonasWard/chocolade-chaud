import { ICurve, arcLengths, flatten, pointAt } from '../curve';

// where the characters of a text go, in mm in the xz plane (x to the right, z down, so it reads from above)

export interface IGlyphPlacement {
  /** the middle of the character on its base line */
  x: number;
  z: number;
  /** of its base line, in radians, from x towards z */
  angle: number;
}

/** a straight line of text centred on (x, z), turned by angle (in degrees) */
export interface IStraightLine {
  x: number;
  z: number;
  angle: number;
}

/** characters with these advances (in mm), centred along the curve or the line */
export const layoutGlyphs = (advances: number[], line: ICurve | IStraightLine): IGlyphPlacement[] => {
  const total = advances.reduce((sum, a) => sum + a, 0);
  // the distance along the line to the middle of every character, from the middle of the text
  let before = -total / 2;
  const along = advances.map((a) => {
    const s = before + a / 2;
    before += a;
    return s;
  });

  if ('points' in line) {
    const polyline = flatten(line);
    const lengths = arcLengths(polyline);
    const middle = lengths[lengths.length - 1] / 2;
    return along.map((s) => {
      const { point, tangent } = pointAt(polyline, lengths, middle + s);
      return { x: point.x, z: point.z, angle: Math.atan2(tangent.z, tangent.x) };
    });
  }

  const angle = (line.angle * Math.PI) / 180;
  return along.map((s) => ({ x: line.x + Math.cos(angle) * s, z: line.z + Math.sin(angle) * s, angle }));
};
