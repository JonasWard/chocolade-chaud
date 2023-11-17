import { useEffect, useRef } from 'react';
import { Engine, EngineOptions, Scene, SceneOptions } from '@babylonjs/core';
import * as React from 'react';
import { IDistanceData, defaultDistanceData } from '../geometry/sdMethods';
import { IGeometrySettings, createMesh, createMeshForGrid, defaultGeometrySettings } from '../geometry/createMesh';
import { DefaultGridSettings, GridType, IGridSettings } from '../geometry/grid';

export interface ISceneProps {
  antialias: boolean;
  engineOptions?: EngineOptions;
  adaptToDeviceRatio: boolean;
  sceneOptions?: SceneOptions;
  gridSettings?: IGridSettings;
  onRender: (scene: Scene) => void;
  onSceneReady: (scene: Scene) => void;
  id: string;
}

export const BabylonScene: React.FC<ISceneProps> = ({
  antialias,
  engineOptions,
  adaptToDeviceRatio,
  sceneOptions,
  onRender,
  onSceneReady,
  id,
  gridSettings,
}) => {
  const reactCanvas = useRef(null);
  const [scene, setScene] = React.useState<Scene>();

  // set up basic engine and scene
  useEffect(() => {
    const { current: canvas } = reactCanvas;

    if (!canvas) return;

    const engine = new Engine(canvas, antialias, engineOptions, adaptToDeviceRatio);
    const scene = new Scene(engine, sceneOptions);

    setScene(scene);

    if (scene.isReady()) {
      onSceneReady(scene);
    } else {
      scene.onReadyObservable.addOnce((scene) => onSceneReady(scene));
    }

    engine.runRenderLoop(() => {
      if (typeof onRender === 'function') onRender(scene);
      scene.render();
    });

    const resize = () => {
      scene.getEngine().resize();
    };

    if (window) {
      window.addEventListener('resize', resize);
    }

    return () => {
      scene.getEngine().dispose();

      if (window) {
        window.removeEventListener('resize', resize);
      }
    };
  }, [antialias, engineOptions, adaptToDeviceRatio, sceneOptions, onRender, onSceneReady]);

  useEffect(() => {
    if (scene?.isReady()) createMeshForGrid(scene, gridSettings ?? DefaultGridSettings(GridType.Single));
  }, [onSceneReady, scene, gridSettings]);

  return <canvas className='babylon-scene' ref={reactCanvas} id={id} />;
};

export default BabylonScene;
