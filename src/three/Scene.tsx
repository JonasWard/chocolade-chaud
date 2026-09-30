import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { GridMeshes } from '../hooks/useGridMeshes';
import { IGridSettings } from '../geometry/grid';
import { ChocolateMesh } from './ChocolateMesh';

// the part of the settings that changes the outline of the grid, the camera is only refitted when it changes
const footprint = (grid: IGridSettings): string => {
  const { type, uCount, vCount, spacing, inset } = grid;
  const size = 'cellWidth' in grid ? [grid.cellWidth, grid.cellLength] : [grid.totalWidth, grid.totalLength];
  return JSON.stringify([type, uCount, vCount, spacing, inset, size]);
};

const FitCamera: React.FC<{ fitKey?: string }> = ({ fitKey }) => {
  const bounds = useBounds();
  React.useEffect(() => {
    if (!fitKey) return;
    // look straight down on the centre of the grid (fit() would keep the current viewing angle)
    const { center, distance } = bounds.refresh().getSize();
    bounds
      .moveTo([center.x, center.y + distance, center.z + distance * 0.001])
      .lookAt({ target: center, up: [0, 1, 0] })
      .clip();
  }, [bounds, fitKey]);
  return null;
};

export const Scene: React.FC<{ meshes?: GridMeshes }> = ({ meshes }) => (
  <div className='scene'>
    {/* looking down on the bar, slightly off the pole so the orbit controls keep a stable up direction */}
    <Canvas camera={{ position: [0, 250, 0.01], fov: 45, near: 0.1, far: 10000 }} dpr={[1, 2]}>
      <color attach='background' args={['#ffffff']} />
      <hemisphereLight args={['#ffffff', '#8a7060', 1.4]} />
      <directionalLight position={[60, 200, -80]} intensity={1.6} />
      <directionalLight position={[-80, -60, 100]} intensity={0.4} />
      <Bounds margin={1.2}>
        {meshes?.meshes.map((mesh, i) => (
          <ChocolateMesh key={`${meshes.id}-${i}`} mesh={mesh} wireframe={!!meshes.cellData[i].geometrySettings.displayWireframe} />
        ))}
        <FitCamera fitKey={meshes && footprint(meshes.grid)} />
      </Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  </div>
);
