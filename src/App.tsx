import React from 'react';
import './App.css';
import { ArcRotateCamera, Color4, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import BabylonScene from './babylon/BabylonScene';
import { IGeometrySettings, defaultGeometrySettings } from './geometry/createMesh';
import { GeometryDrawer } from './Components/GeometryDrawer';
import { Export } from './Components/Export';
import { DefaultGridSettings, GridType, IGridSettings } from './geometry/grid';
import { GridGeometryDrawer } from './Components/GridGeometryDrawer';

let box: any;

const onSceneReady = (scene: Scene) => {
  // This creates and positions a free camera (non-mesh)
  scene.clearColor = new Color4(1, 1, 1, 1);
  const camera = new ArcRotateCamera('camera1', 0.71, 0.71, 100, new Vector3(0, 0, 0), scene);

  // This targets the camera to scene origin
  camera.setTarget(Vector3.Zero());

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

/**
 * Will run on every frame render.  We are spinning the box on y-axis.
 */
const onRender = (scene: Scene) => {
  if (box !== undefined) {
    const deltaTimeInMillis = scene.getEngine().getDeltaTime();

    const rpm = 10;
    box.rotation.y += (rpm / 60) * Math.PI * 2 * (deltaTimeInMillis / 1000);
  }
};

function App() {
  const [geometrySettings, setGeometrySettings] = React.useState<IGeometrySettings>(defaultGeometrySettings);
  const [gridSettings, setGridSettings] = React.useState<IGridSettings>(DefaultGridSettings(GridType.Single));

  return (
    <div className='App'>
      <header className='App-header'>
        <BabylonScene
          antialias
          onSceneReady={onSceneReady}
          onRender={onRender}
          id='my-canvas'
          engineOptions={undefined}
          adaptToDeviceRatio={false}
          sceneOptions={undefined}
          gridSettings={gridSettings}
        />
      </header>
      <Export gridSettings={gridSettings} />
      <GeometryDrawer geometrySettings={geometrySettings} setGeometrySettings={setGeometrySettings} />
      <GridGeometryDrawer gridSettings={gridSettings} setGridSettings={setGridSettings} />
    </div>
  );
}

export default App;
