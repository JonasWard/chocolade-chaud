import { Vector3 } from '@babylonjs/core';
import { ITriangularMesh } from './createMesh';

export const exportOBJ = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => {
  // get an index and face list fron the object, geometry is just fine, all faces are quad

  const positionStrings = [...Array(mesh.vertices.length / 3).keys()]
    .map((i) => `v ${mesh.vertices[i * 3]} ${mesh.vertices[i * 3 + 1]} ${mesh.vertices[i * 3 + 2]}`)
    .join('\n');

  const normalStrings = [...Array(mesh.normals.length / 3).keys()]
    .map((i) => `vn ${mesh.normals[i * 3]} ${mesh.normals[i * 3 + 1]} ${mesh.normals[i * 3 + 2]}`)
    .join('\n');
  const faceStrings = [...Array(mesh.faces.length / 3).keys()]
    .map(
      (i) =>
        `f ${mesh.faces[i * 3] + 1}/${mesh.faces[i * 3] + 1} ${mesh.faces[i * 3 + 1] + 1}/${mesh.faces[i * 3 + 1] + 1} ${mesh.faces[i * 3 + 2] + 1}/${
          mesh.faces[i * 3 + 2] + 1
        }`
    )
    .join('\n');

  const objContent = [
    positionStrings,
    // textureStrings,
    normalStrings,
    faceStrings,
  ].join('\n');

  const element = document.createElement('a');
  const file = new Blob([objContent], {
    type: 'text/plain',
  });
  element.href = URL.createObjectURL(file);
  element.download = `${fileName}.obj`;
  document.body.appendChild(element);
  element.click();
};

export const exportSTL = (mesh: ITriangularMesh, fileName = 'chocolade-chaud') => {
  // get an index and face list fron the object, geometry is just fine, all faces are triangles
  const vertexStrings: string[] = [];

  for (let i = 0; i < mesh.faces.length; i += 3) {
    const f = mesh.faces.slice(i, i + 3);

    console.log(f);
    if (f.length === 3) {
      const v0 = new Vector3(mesh.vertices[f[0] * 3], mesh.vertices[f[0] * 3 + 1], mesh.vertices[f[0] * 3 + 2]);
      const v1 = new Vector3(mesh.vertices[f[1] * 3], mesh.vertices[f[1] * 3 + 1], mesh.vertices[f[1] * 3 + 2]);
      const v2 = new Vector3(mesh.vertices[f[2] * 3], mesh.vertices[f[2] * 3 + 1], mesh.vertices[f[2] * 3 + 2]);

      const normal = v1.subtract(v0).cross(v2.subtract(v0)).normalize();

      const n = [normal.x, normal.y, normal.z].map((n) => (n < 0.0001 ? '0.000' : n.toPrecision(3)));
      vertexStrings.push(
        `facet normal ${n[0]} ${n[1]} ${n[2]}
outer loop
vertex ${v0.x.toPrecision(3)} ${v0.y.toPrecision(3)} ${v0.z.toPrecision(3)}
vertex ${v1.x.toPrecision(3)} ${v1.y.toPrecision(3)} ${v1.z.toPrecision(3)}
vertex ${v2.x.toPrecision(3)} ${v2.y.toPrecision(3)} ${v2.z.toPrecision(3)}
endloop
endfacet`
      );
    }
  }

  const element = document.createElement('a');

  const stlContent = `solid Exported by JonasWard with chocolate-chaud
${vertexStrings.join('\n')}
endsolid Exported by JonasWard with chocolate-chaud`;

  const file = new Blob([stlContent], {
    type: 'text/plain',
  });
  element.href = URL.createObjectURL(file);
  element.download = `${fileName}.stl`;
  document.body.appendChild(element);
  element.click();
};
