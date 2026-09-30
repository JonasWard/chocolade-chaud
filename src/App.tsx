import React from 'react';
import './App.css';
import { ArcRotateCamera, Color4, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import BabylonScene from './babylon/BabylonScene';
import { Export } from './Components/Export';
import { DefaultGridSettings, GridType, IGridSettings } from './geometry/grid';
import { GridGeometryDrawer } from './Components/GridGeometryDrawer';
import { useGridMeshes } from './hooks/useGridMeshes';
import { Spin } from 'antd';

const onSceneReady = (scene: Scene) => {
  // This creates and positions a free camera (non-mesh)
  scene.clearColor = new Color4(1, 1, 1, 1);
  const camera = new ArcRotateCamera('camera1', 1.57, 0, 0, new Vector3(100, 250, 0), scene);

  // This targets the camera to scene origin
  camera.setTarget(new Vector3(100, 0, 0));

  const canvas = scene.getEngine().getRenderingCanvas();

  // This attaches the camera to the canvas
  camera.attachControl(canvas, false);

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  const light = new HemisphericLight('light', new Vector3(0, 1, -1), scene);

  const bottomLight = new HemisphericLight('underground', new Vector3(0, -1, 1), scene);

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7;
  bottomLight.intensity = 0.25;
};

function App() {
  const [gridSettings, setGridSettings] = React.useState<IGridSettings>(DefaultGridSettings(GridType.Single));
  const { result, pending, error } = useGridMeshes(gridSettings);

  return (
    <div className='App'>
      <header className='App-header'>
        <BabylonScene
          antialias
          onSceneReady={onSceneReady}
          id='my-canvas'
          engineOptions={undefined}
          adaptToDeviceRatio={false}
          sceneOptions={undefined}
          meshes={result}
        />
      </header>
      <Spin className='mesh-status' spinning={pending} />
      {error && <div className='mesh-status'>{error}</div>}
      <Export meshes={pending ? undefined : result} />
      <GridGeometryDrawer gridSettings={gridSettings} setGridSettings={setGridSettings} />
    </div>
  );
}

export default App;
