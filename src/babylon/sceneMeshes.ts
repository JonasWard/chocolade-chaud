import { Color3, Mesh, PBRMetallicRoughnessMaterial, Scene, VertexBuffer } from '@babylonjs/core';
import { IGeometrySettings, ITriangularMesh } from '../geometry/createMesh';
import { GridMeshes } from '../hooks/useGridMeshes';

export const addMeshToScene = (iMesh: ITriangularMesh, scene: Scene, geometrySettings?: IGeometrySettings, name: string = 'custom') => {
  const mesh = new Mesh(name, scene);
  mesh.setVerticesData(VertexBuffer.PositionKind, iMesh.vertices);
  mesh.setIndices(iMesh.faces);
  mesh.setVerticesData(VertexBuffer.NormalKind, iMesh.normals);

  const material = new PBRMetallicRoughnessMaterial(`chocolate-material-for-${iMesh.color}`, scene);

  material.wireframe = !!geometrySettings?.displayWireframe;
  material.baseColor = Color3.FromHexString(iMesh.color);
  material.roughness = 0.7;

  mesh.material = material;
};

export const replaceSceneMeshes = (scene: Scene, { meshes, cellData }: GridMeshes) => {
  while (scene.meshes.length) {
    const mesh = scene.meshes[0];
    mesh.dispose(false, true); // also dispose the material, otherwise every update leaks one
  }
  meshes.forEach((m, i) => addMeshToScene(m, scene, cellData[i].geometrySettings, `mesh-${i}`));
};
