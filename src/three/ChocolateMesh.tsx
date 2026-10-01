import React from 'react';
import { ITriangularMesh } from '../geometry/createMesh';

// remount (key) for every new mesh, so r3f disposes the old geometry and its gpu buffers
export const ChocolateMesh: React.FC<{ mesh: ITriangularMesh; wireframe: boolean }> = ({ mesh, wireframe }) => (
  <mesh>
    <bufferGeometry>
      <bufferAttribute attach='attributes-position' args={[mesh.vertices, 3]} />
      <bufferAttribute attach='attributes-normal' args={[mesh.normals, 3]} />
      <bufferAttribute attach='index' args={[mesh.faces, 1]} />
    </bufferGeometry>
    <meshStandardMaterial color={mesh.color} roughness={0.55} metalness={0} wireframe={wireframe} />
  </mesh>
);
