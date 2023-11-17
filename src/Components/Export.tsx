import { Button } from 'antd';
import { makeMeshTiltOnSide } from '../geometry/createMesh';
import { exportOBJ, exportSTL } from '../geometry/exportGeometry';
import React from 'react';
import './export.css';
import { CellData, GridParser, IGridSettings } from '../geometry/grid';

export const Export: React.FC<{ gridSettings: IGridSettings }> = ({ gridSettings }) => {
  const createSTL = () => {
    const cellData: CellData[] = [];
    const meshes = GridParser(gridSettings, cellData, true); // mesh with internal support structure
    meshes.map((m, i) => exportSTL(makeMeshTiltOnSide(m, cellData[i].geometrySettings), `mesh-${i}`));
  };

  const createObj = () => {
    const cellData: CellData[] = [];
    const meshes = GridParser(gridSettings, cellData, true); // mesh with internal support structure
    meshes.map((m, i) => exportOBJ(makeMeshTiltOnSide(m, cellData[i].geometrySettings), `mesh-${i}`));
  };

  return (
    <>
      <Button className='export-stl' onClick={createSTL}>
        Export STL
      </Button>
      <Button className='export-obj' onClick={createObj}>
        Export OBJ
      </Button>
    </>
  );
};
