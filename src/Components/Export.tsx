import { Button } from 'antd';
import { makeMeshTiltOnSide } from '../geometry/createMesh';
import { meshToOBJ, meshToSTL } from '../geometry/exportGeometry';
import React from 'react';
import './export.css';
import { GridMeshes } from '../hooks/useGridMeshes';
import { downloadFiles, Files } from '../export/download';

type Format = 'stl' | 'obj';

const serialize: Record<Format, (mesh: ReturnType<typeof makeMeshTiltOnSide>) => Uint8Array> = {
  stl: (mesh) => new Uint8Array(meshToSTL(mesh)),
  obj: (mesh) => new TextEncoder().encode(meshToOBJ(mesh)),
};

// exports the meshes shown in the scene, those already contain the internal support structure
export const Export: React.FC<{ meshes?: GridMeshes }> = ({ meshes }) => {
  const [busy, setBusy] = React.useState<Format>();

  const exportAs = async (format: Format) => {
    if (!meshes) return;
    setBusy(format);
    // let the loading state render before the (synchronous) serialization starts
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const files: Files = {};
      meshes.meshes.forEach((m, i) => {
        files[`mesh-${i}.${format}`] = serialize[format](makeMeshTiltOnSide(m, meshes.cellData[i].geometrySettings));
      });
      await downloadFiles(files, `chocolade-chaud-${format}.zip`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className='export-buttons'>
      <Button onClick={() => exportAs('stl')} disabled={!meshes || !!busy} loading={busy === 'stl'}>
        Export STL
      </Button>
      <Button onClick={() => exportAs('obj')} disabled={!meshes || !!busy} loading={busy === 'obj'}>
        Export OBJ
      </Button>
    </div>
  );
};
