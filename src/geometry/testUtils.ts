import { BarKind, IBar, defaultBar } from './grid';

/** a custom bar whose top is width by length mm */
export const singleGrid = (width: number, length: number, divPerMM = 1, inset = -3): IBar => ({
  ...defaultBar(),
  kind: BarKind.Custom,
  width: width - 2 * inset,
  length: length - 2 * inset,
  inset,
  divPerMM,
});

/** reads a binary stl back into triangles, independent from the writer */
export const readSTL = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  const triangles = [...Array(count).keys()].map((t) => {
    const floats = [...Array(12).keys()].map((k) => view.getFloat32(84 + t * 50 + k * 4, true));
    return { normal: floats.slice(0, 3), vertices: [floats.slice(3, 6), floats.slice(6, 9), floats.slice(9, 12)], attribute: view.getUint16(84 + t * 50 + 48, true) };
  });
  return { header: new TextDecoder().decode(new Uint8Array(buffer, 0, 80)).replace(/\0+$/, ''), count, triangles };
};
