import { ITriangularMesh } from './createMesh';

const downloadFile = (content: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  const element = document.createElement('a');
  element.href = url;
  element.download = fileName;
  document.body.appendChild(element);
  element.click();
  element.remove();
  // give the browser a moment to start the download before releasing the blob
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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

export const meshToSTL = (mesh: ITriangularMesh): string => {
  const vertexStrings: string[] = [];

  const vertex = (index: number): [number, number, number] => [mesh.vertices[index * 3], mesh.vertices[index * 3 + 1], mesh.vertices[index * 3 + 2]];
  const format = (v: number[]) => v.map((n) => n.toPrecision(6)).join(' ');

  for (let i = 0; i + 2 < mesh.faces.length; i += 3) {
    const v0 = vertex(mesh.faces[i]);
    const v1 = vertex(mesh.faces[i + 1]);
    const v2 = vertex(mesh.faces[i + 2]);

    // (v1 - v0) x (v2 - v0)
    const a = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const b = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];
    const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2) || 1;

    const n = normal.map((n) => n / l).map((n) => (Math.abs(n) < 0.0001 ? '0.000' : n.toPrecision(6)));
    vertexStrings.push(
      `facet normal ${n[0]} ${n[1]} ${n[2]}
outer loop
vertex ${format(v0)}
vertex ${format(v1)}
vertex ${format(v2)}
endloop
endfacet`
    );
  }

  return `solid Exported by JonasWard with chocolate-chaud
${vertexStrings.join('\n')}
endsolid Exported by JonasWard with chocolate-chaud`;
};

export const exportOBJ = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => downloadFile(meshToOBJ(mesh), `${fileName}.obj`);

export const exportSTL = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => downloadFile(meshToSTL(mesh), `${fileName}.stl`);
