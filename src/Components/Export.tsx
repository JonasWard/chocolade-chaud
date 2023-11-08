import { Button } from 'antd';
import { IGeometrySettings, createIMesh, makeMeshTiltOnSide } from '../geometry/createMesh';
import { exportOBJ, exportSTL } from '../geometry/exportGeometry';
import { IDistanceData } from '../geometry/sdMethods';
import React from 'react';
import './export.css';

export const Export: React.FC<{ geometrySettings: IGeometrySettings; sdfSettings: IDistanceData }> = ({ geometrySettings, sdfSettings }) => {
  const createSTL = () => {
    const iMesh = createIMesh(geometrySettings, sdfSettings);
    const tiltedMesh = makeMeshTiltOnSide(iMesh, geometrySettings);
    exportSTL(tiltedMesh);
  };

  const createObj = () => {
    const iMesh = createIMesh(geometrySettings, sdfSettings);
    exportOBJ(iMesh);
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
