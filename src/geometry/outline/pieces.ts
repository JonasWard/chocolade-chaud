import { IDistanceField } from '../field';
import { IFieldBox, buildOutlineField } from './outlineField';
import { Contour, placeContour, simplifyContour, smoothContour, traceCoverage } from './trace';

// a shape drawn in pieces (the characters of a text, or an svg in one), traced and turned into its distance field

/** the drawn coverage of a piece and where it goes */
export interface IOutlinePiece {
  coverage: Float32Array;
  width: number;
  height: number;
  /** the pixel location (pixel (i, j) has its centre at (i + 0.5, j + 0.5)) that goes to (x, z) */
  anchorX: number;
  anchorY: number;
  /** of a pixel, in the unit of the field */
  scale: number;
  /** turned by, in radians, from x towards z */
  angle: number;
  x: number;
  z: number;
}

export interface IOutlineRequest {
  pieces: IOutlinePiece[];
  box: IFieldBox;
  pixelSize: number;
  maxSize?: number;
}

/** how far the traced outline may be simplified, in pixels of the drawing */
const TRACE_TOLERANCE = 0.05;

/** the outline of the pieces, placed */
export const traceOutline = (pieces: IOutlinePiece[]): Contour[] =>
  pieces.flatMap(({ coverage, width, height, anchorX, anchorY, scale, angle, x, z }) => {
    // the anchor goes to (x, z): moved there after turning
    const [cos, sin] = [Math.cos(angle) * scale, Math.sin(angle) * scale];
    const [dx, dz] = [x - (cos * anchorX - sin * anchorY), z - (sin * anchorX + cos * anchorY)];
    return traceCoverage(coverage, width, height).map((c) => placeContour(simplifyContour(smoothContour(c), TRACE_TOLERANCE), scale, angle, dx, dz));
  });

/** the distance field of the pieces over the box, undefined when nothing is drawn */
export const buildPiecesField = ({ pieces, box, pixelSize, maxSize }: IOutlineRequest): IDistanceField | undefined => {
  const contours = traceOutline(pieces);
  return contours.length ? buildOutlineField(contours, box, pixelSize, maxSize) : undefined;
};
