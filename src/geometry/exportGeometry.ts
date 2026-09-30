import { ITriangularMesh } from './createMesh';

// float32 has ~7 significant digits, don't print the float64 noise
const f32 = (n: number): number => Number(n.toPrecision(7));

export const meshToOBJ = (mesh: ITriangularMesh): string => {
  const positionStrings = [...Array(mesh.vertices.length / 3).keys()]
    .map((i) => `v ${f32(mesh.vertices[i * 3])} ${f32(mesh.vertices[i * 3 + 1])} ${f32(mesh.vertices[i * 3 + 2])}`)
    .join('\n');

  const normalStrings = [...Array(mesh.normals.length / 3).keys()]
    .map((i) => `vn ${f32(mesh.normals[i * 3])} ${f32(mesh.normals[i * 3 + 1])} ${f32(mesh.normals[i * 3 + 2])}`)
    .join('\n');

  // v//vn - there are no texture coordinates
  const faceStrings = [...Array(mesh.faces.length / 3).keys()]
    .map((i) => {
      const [a, b, c] = [mesh.faces[i * 3] + 1, mesh.faces[i * 3 + 1] + 1, mesh.faces[i * 3 + 2] + 1];
      return `f ${a}//${a} ${b}//${b} ${c}//${c}`;
    })
    .join('\n');

  return [positionStrings, normalStrings, faceStrings].join('\n');
};

const STL_HEADER = 'Exported by JonasWard with chocolate-chaud'; // must not start with "solid", that marks ascii stl

/**
 * Binary STL: 80 byte header, uint32 triangle count, then per triangle
 * the normal and 3 vertices as float32 and a uint16 attribute count, little endian
 */
export const meshToSTL = (mesh: ITriangularMesh): ArrayBuffer => {
  const { vertices, faces } = mesh;
  const triangleCount = Math.floor(faces.length / 3);
  const buffer = new ArrayBuffer(84 + 50 * triangleCount);
  const view = new DataView(buffer);

  for (let i = 0; i < STL_HEADER.length; i++) view.setUint8(i, STL_HEADER.charCodeAt(i));
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  const write = (value: number) => {
    view.setFloat32(offset, value, true);
    offset += 4;
  };
  const writeVertex = (v: number) => {
    write(vertices[v]);
    write(vertices[v + 1]);
    write(vertices[v + 2]);
  };

  for (let t = 0; t < triangleCount; t++) {
    const a = faces[t * 3] * 3;
    const b = faces[t * 3 + 1] * 3;
    const c = faces[t * 3 + 2] * 3;

    // (v1 - v0) x (v2 - v0)
    const abx = vertices[b] - vertices[a];
    const aby = vertices[b + 1] - vertices[a + 1];
    const abz = vertices[b + 2] - vertices[a + 2];
    const acx = vertices[c] - vertices[a];
    const acy = vertices[c + 1] - vertices[a + 1];
    const acz = vertices[c + 2] - vertices[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    write(nx / l);
    write(ny / l);
    write(nz / l);
    writeVertex(a);
    writeVertex(b);
    writeVertex(c);
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
};
