import React from 'react';
import './App.css';
import { ArcRotateCamera, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import BabylonScene from './babylon/BabylonScene';
import { IGeometrySettings, defaultGeometrySettings } from './geometry/createMesh';
import { MethodDrawer } from './Components/MethodDrawer';
import { IDistanceData, defaultDistanceData } from './geometry/sdMethods';
import { GeometryDrawer } from './Components/GeometryDrawer';
import { Export } from './Components/Export';

let box: any;

const onSceneReady = (scene: Scene) => {
  // This creates and positions a free camera (non-mesh)
  const camera = new ArcRotateCamera('camera1', 0.71, 0.71, 100, new Vector3(0, 0, 0), scene);

  // This targets the camera to scene origin
  camera.setTarget(Vector3.Zero());

  const canvas = scene.getEngine().getRenderingCanvas();

  // This attaches the camera to the canvas
  camera.attachControl(canvas, false);

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);

  const bottomLight = new HemisphericLight('underground', new Vector3(0, 1, 0), scene);

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7;
  bottomLight.intensity = 0.3;
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
  const [sdfSettings, setSdfSettings] = React.useState<IDistanceData>(defaultDistanceData);
  const [geometrySettings, setGeometrySettings] = React.useState<IGeometrySettings>(defaultGeometrySettings);

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
          sdfSettings={sdfSettings}
          geometrySettings={geometrySettings}
        />
      </header>
      <Export sdfSettings={sdfSettings} geometrySettings={geometrySettings} />
      <MethodDrawer sdfSettings={sdfSettings} setSdfSettings={setSdfSettings} />
      <GeometryDrawer geometrySettings={geometrySettings} setGeometrySettings={setGeometrySettings} />
    </div>
  );
}

export default App;
