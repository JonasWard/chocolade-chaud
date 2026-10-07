import React from 'react';
import { ITriangularMesh } from '../geometry/createMesh';
import { CHOCOLATES } from '../geometry/chocolates';

// remount (key) for every new mesh, so r3f disposes the old geometry and its gpu buffers
export const ChocolateMesh: React.FC<{ mesh: ITriangularMesh; wireframe: boolean }> = ({ mesh, wireframe }) => {
  const { color, roughness, clearcoat } = CHOCOLATES[mesh.chocolate];
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute attach='attributes-position' args={[mesh.vertices, 3]} />
        <bufferAttribute attach='attributes-normal' args={[mesh.normals, 3]} />
        <bufferAttribute attach='index' args={[mesh.faces, 1]} />
      </bufferGeometry>
      <meshPhysicalMaterial color={color} roughness={roughness} clearcoat={clearcoat} clearcoatRoughness={0.4} metalness={0} wireframe={wireframe} />
    </mesh>
  );
};
