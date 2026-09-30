import { Button } from 'antd';
import { makeMeshTiltOnSide } from '../geometry/createMesh';
import { exportOBJ, exportSTL } from '../geometry/exportGeometry';
import React from 'react';
import './export.css';
import { GridMeshes } from '../hooks/useGridMeshes';

// exports the meshes shown in the scene, those already contain the internal support structure
export const Export: React.FC<{ meshes?: GridMeshes }> = ({ meshes }) => {
  const tiltedMeshes = () => meshes?.meshes.map((m, i) => makeMeshTiltOnSide(m, meshes.cellData[i].geometrySettings)) ?? [];

  const createSTL = () => tiltedMeshes().forEach((m, i) => exportSTL(m, `mesh-${i}`));

  const createObj = () => tiltedMeshes().forEach((m, i) => exportOBJ(m, `mesh-${i}`));

  return (
    <>
      <Button className='export-stl' onClick={createSTL} disabled={!meshes}>
        Export STL
      </Button>
      <Button className='export-obj' onClick={createObj} disabled={!meshes}>
        Export OBJ
      </Button>
    </>
  );
};
