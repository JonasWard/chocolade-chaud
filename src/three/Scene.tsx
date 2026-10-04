import React from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, useBounds } from '@react-three/drei';
import { GridMeshes } from '../hooks/useGridMeshes';
import { IGridSettings, gridCells } from '../geometry/grid';
import { ChocolateMesh } from './ChocolateMesh';
import { BarMesh, barGeometryKey, createBarGeometry } from './BarMesh';
import { canBakeTopSurface, createFieldTexture, fieldTextureSize } from './shaders/bake';
import { sdfShaderPlan } from './shaders/sdfCodegen';
import { SvgFields } from '../geometry/sdf/tree';
import { CurveEditor, ICurveEditing, curveToWorld } from './CurveEditor';
import { IViewFocus, ViewController } from './ViewController';

// the part of the settings that changes the outline of the grid, the camera is only refitted when it changes
const footprint = (grid: IGridSettings): string => {
  const { type, uCount, vCount, spacing, inset } = grid;
  const size = 'cellWidth' in grid ? [grid.cellWidth, grid.cellLength] : [grid.totalWidth, grid.totalLength];
  return JSON.stringify([type, uCount, vCount, spacing, inset, size]);
};

// only fits again for another outline, so coming back from editing a curve keeps the view
const FitCamera: React.FC<{ fitKey?: string }> = ({ fitKey }) => {
  const bounds = useBounds();
  const fitted = React.useRef<string>(undefined);
  React.useEffect(() => {
    if (!fitKey || fitKey === fitted.current) return;
    fitted.current = fitKey;
    // look straight down on the centre of the grid (fit() would keep the current viewing angle)
    const { center, distance } = bounds.refresh().getSize();
    bounds
      .moveTo([center.x, center.y + distance, center.z + distance * 0.001])
      .lookAt({ target: center, up: [0, 1, 0] })
      .clip();
  }, [bounds, fitKey]);
  return null;
};

// fields are the distance fields of the svg and text nodes, meshes what the worker made for the export
type SceneProps = { grid: IGridSettings; fields: SvgFields; meshes?: GridMeshes };
// the camera is not fitted while a curve is edited
type MeshesProps = SceneProps & { fit: boolean };

// the bars of the current settings, drawn from their top surface baked on the gpu
const Bars: React.FC<SceneProps> = ({ grid, fields, meshes }) => {
  // the same bars the worker generates for the export
  const cells = React.useMemo(() => gridCells(grid, true, fields), [grid, fields]);

  const fieldTextures = React.useMemo(() => new Map([...fields].map(([key, f]) => [key, createFieldTexture(f)])), [fields]);
  React.useEffect(() => () => fieldTextures.forEach((t) => t.dispose()), [fieldTextures]);

  const geometryKeys = cells.map(barGeometryKey);
  const geometryKey = JSON.stringify([...new Set(geometryKeys)]);
  const geometries = React.useMemo(
    () => new Map((JSON.parse(geometryKey) as string[]).map((key) => [key, createBarGeometry(cells[geometryKeys.indexOf(key)])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the cells only matter as far as they are in the key
    [geometryKey]
  );
  React.useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  // the worker result lags behind while editing, only compare with it when it belongs to these settings
  const references = meshes?.grid === grid && meshes.fields === fields ? meshes.meshes : undefined;

  return cells.map((cell, i) => (
    <BarMesh key={i} cell={cell} geometry={geometries.get(geometryKeys[i]) as THREE.BufferGeometry} fieldTextures={fieldTextures} reference={references?.[i]} />
  ));
};

// without float render targets (or with a pattern the shader can't hold, or bars or fields too large for a texture) the meshes
// of the worker are shown instead
const Meshes: React.FC<MeshesProps> = ({ grid, fields, meshes, fit }) => {
  const gl = useThree((state) => state.gl);
  const maxSize = gl.capabilities.maxTextureSize;
  const fits = (width: number, height: number) => width <= maxSize && height <= maxSize;
  const baked =
    React.useMemo(() => canBakeTopSurface(gl), [gl]) &&
    gridCells(grid).every((c) => sdfShaderPlan(c.sdfSettings).fits && fits(c.geometrySettings.horizontalDivisions + 1, c.geometrySettings.verticalDivisions + 1)) &&
    [...fields.values()].every((f) => fits(...fieldTextureSize(f)));

  if (baked)
    return (
      <>
        <Bars grid={grid} fields={fields} meshes={meshes} />
        <FitCamera fitKey={fit ? footprint(grid) : undefined} />
      </>
    );
  return (
    <>
      {meshes?.meshes.map((mesh, i) => (
        <ChocolateMesh key={`${meshes.id}-${i}`} mesh={mesh} wireframe={!!meshes.cellData[i].geometrySettings.displayWireframe} />
      ))}
      <FitCamera fitKey={fit && meshes ? footprint(meshes.grid) : undefined} />
    </>
  );
};

// the box around a curve on the bars, what the camera looks at while it is edited
const curveFocus = (grid: IGridSettings, { curve, scaleAt, offset }: ICurveEditing): IViewFocus => {
  const pattern = 'sdfSetting' in grid ? grid.sdfSetting : grid.sdfSettings[0];
  const found = curveToWorld(pattern, { scaleAt, offset }, curve.points).filter((p) => !!p);
  const points = found.length ? found : [{ x: 0, z: 0 }];
  const [xs, zs] = [points.map((p) => p.x), points.map((p) => p.z)];
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { x: (x0 + x1) / 2, y: grid.height, z: (z0 + z1) / 2, width: Math.max(x1 - x0, 20), depth: Math.max(z1 - z0, 20) };
};

/** curve is the base curve of the selected text node, when it has one: shown and edited from above in edit mode */
export const Scene: React.FC<SceneProps & { curve?: ICurveEditing }> = ({ grid, fields, meshes, curve }) => {
  const editing = !!curve?.editing;
  const pattern = 'sdfSetting' in grid ? grid.sdfSetting : grid.sdfSettings[0];
  return (
    <div className='scene'>
      {/* looking down on the bar, slightly off the pole so the orbit controls keep a stable up direction */}
      <Canvas camera={{ position: [0, 250, 0.01], fov: 45, near: 0.1, far: 10000 }} dpr={[1, 2]}>
        <color attach='background' args={['#ffffff']} />
        <hemisphereLight args={['#ffffff', '#8a7060', 1.4]} />
        <directionalLight position={[60, 200, -80]} intensity={1.6} />
        <directionalLight position={[-80, -60, 100]} intensity={0.4} />
        <Bounds margin={1.2}>
          <Meshes grid={grid} fields={fields} meshes={meshes} fit={!editing} />
        </Bounds>
        {curve?.editing && <CurveEditor {...curve} pattern={pattern} y={grid.height} />}
        <ViewController editing={editing} focus={curve && curveFocus(grid, curve)} />
      </Canvas>
    </div>
  );
};
