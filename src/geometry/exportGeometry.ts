import { Vector3 } from '@babylonjs/core';
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

export const meshToOBJ = (mesh: ITriangularMesh): string => {
  const positionStrings = [...Array(mesh.vertices.length / 3).keys()]
    .map((i) => `v ${mesh.vertices[i * 3]} ${mesh.vertices[i * 3 + 1]} ${mesh.vertices[i * 3 + 2]}`)
    .join('\n');

  const normalStrings = [...Array(mesh.normals.length / 3).keys()]
    .map((i) => `vn ${mesh.normals[i * 3]} ${mesh.normals[i * 3 + 1]} ${mesh.normals[i * 3 + 2]}`)
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

  for (let i = 0; i < mesh.faces.length; i += 3) {
    const f = mesh.faces.slice(i, i + 3);
    if (f.length === 3) {
      const v0 = new Vector3(mesh.vertices[f[0] * 3], mesh.vertices[f[0] * 3 + 1], mesh.vertices[f[0] * 3 + 2]);
      const v1 = new Vector3(mesh.vertices[f[1] * 3], mesh.vertices[f[1] * 3 + 1], mesh.vertices[f[1] * 3 + 2]);
      const v2 = new Vector3(mesh.vertices[f[2] * 3], mesh.vertices[f[2] * 3 + 1], mesh.vertices[f[2] * 3 + 2]);

      const normal = v1.subtract(v0).cross(v2.subtract(v0)).normalize();

      const n = [normal.x, normal.y, normal.z].map((n) => (Math.abs(n) < 0.0001 ? '0.000' : n.toPrecision(6)));
      vertexStrings.push(
        `facet normal ${n[0]} ${n[1]} ${n[2]}
outer loop
vertex ${v0.x.toPrecision(6)} ${v0.y.toPrecision(6)} ${v0.z.toPrecision(6)}
vertex ${v1.x.toPrecision(6)} ${v1.y.toPrecision(6)} ${v1.z.toPrecision(6)}
vertex ${v2.x.toPrecision(6)} ${v2.y.toPrecision(6)} ${v2.z.toPrecision(6)}
endloop
endfacet`
      );
    }
  }

  return `solid Exported by JonasWard with chocolate-chaud
${vertexStrings.join('\n')}
endsolid Exported by JonasWard with chocolate-chaud`;
};

export const exportOBJ = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => downloadFile(meshToOBJ(mesh), `${fileName}.obj`);

export const exportSTL = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => downloadFile(meshToSTL(mesh), `${fileName}.stl`);
