import React from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { GridMeshes } from '../hooks/useGridMeshes';
import { IGridSettings, gridCells } from '../geometry/grid';
import { ChocolateMesh } from './ChocolateMesh';
import { BarMesh, barGeometryKey, createBarGeometry } from './BarMesh';
import { canBakeTopSurface, createFieldTexture } from './shaders/bake';
import { ITextRelief } from '../geometry/text/textField';
import { sdfShaderPlan } from './shaders/sdfCodegen';
import { SvgFields } from '../geometry/sdf/tree';

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

// text is the relief of the text of the grid, fields the distance fields of the svg shapes, meshes what the worker made for the export
type SceneProps = { grid: IGridSettings; text?: ITextRelief; fields: SvgFields; meshes?: GridMeshes };

// the bars of the current settings, drawn from their top surface baked on the gpu
const Bars: React.FC<SceneProps> = ({ grid, text, fields, meshes }) => {
  // the same bars the worker generates for the export
  const cells = React.useMemo(() => gridCells(grid, true, text, fields), [grid, text, fields]);

  const field = text?.field;
  const textTexture = React.useMemo(() => field && createFieldTexture(field), [field]);
  React.useEffect(() => () => textTexture?.dispose(), [textTexture]);

  const svgTextures = React.useMemo(() => new Map([...fields].map(([asset, f]) => [asset, createFieldTexture(f)])), [fields]);
  React.useEffect(() => () => svgTextures.forEach((t) => t.dispose()), [svgTextures]);

  const geometryKeys = cells.map(barGeometryKey);
  const geometryKey = JSON.stringify([...new Set(geometryKeys)]);
  const geometries = React.useMemo(
    () => new Map((JSON.parse(geometryKey) as string[]).map((key) => [key, createBarGeometry(cells[geometryKeys.indexOf(key)])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the cells only matter as far as they are in the key
    [geometryKey]
  );
  React.useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  // the worker result lags behind while editing, only compare with it when it belongs to these settings
  const references = meshes?.grid === grid && meshes.text === text && meshes.fields === fields ? meshes.meshes : undefined;

  return cells.map((cell, i) => (
    <BarMesh
      key={i}
      cell={cell}
      geometry={geometries.get(geometryKeys[i]) as THREE.BufferGeometry}
      textTexture={cell.text && textTexture}
      svgTextures={svgTextures}
      reference={references?.[i]}
    />
  ));
};

// without float render targets (or with a pattern the shader can't hold) the meshes of the worker are shown instead
const Meshes: React.FC<SceneProps> = ({ grid, text, fields, meshes }) => {
  const gl = useThree((state) => state.gl);
  const baked = React.useMemo(() => canBakeTopSurface(gl), [gl]) && gridCells(grid).every((c) => sdfShaderPlan(c.sdfSettings).fits);

  if (baked)
    return (
      <>
        <Bars grid={grid} text={text} fields={fields} meshes={meshes} />
        <FitCamera fitKey={footprint(grid)} />
      </>
    );
  return (
    <>
      {meshes?.meshes.map((mesh, i) => (
        <ChocolateMesh key={`${meshes.id}-${i}`} mesh={mesh} wireframe={!!meshes.cellData[i].geometrySettings.displayWireframe} />
      ))}
      <FitCamera fitKey={meshes && footprint(meshes.grid)} />
    </>
  );
};

export const Scene: React.FC<SceneProps> = ({ grid, text, fields, meshes }) => (
  <div className='scene'>
    {/* looking down on the bar, slightly off the pole so the orbit controls keep a stable up direction */}
    <Canvas camera={{ position: [0, 250, 0.01], fov: 45, near: 0.1, far: 10000 }} dpr={[1, 2]}>
      <color attach='background' args={['#ffffff']} />
      <hemisphereLight args={['#ffffff', '#8a7060', 1.4]} />
      <directionalLight position={[60, 200, -80]} intensity={1.6} />
      <directionalLight position={[-80, -60, 100]} intensity={0.4} />
      <Bounds margin={1.2}>
        <Meshes grid={grid} text={text} fields={fields} meshes={meshes} />
      </Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  </div>
);
