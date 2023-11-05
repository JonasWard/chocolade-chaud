import { useEffect, useRef } from 'react';
import { Engine, EngineOptions, Scene, SceneOptions } from '@babylonjs/core';
import * as React from 'react';
import { IDistanceData, defaultDistanceData } from '../geometry/sdMethods';
import { IGeometrySettings, createMesh, defaultGeometrySettings } from '../geometry/createMesh';

export interface ISceneProps {
  antialias: boolean;
  engineOptions?: EngineOptions;
  adaptToDeviceRatio: boolean;
  sceneOptions?: SceneOptions;
  geometrySettings?: IGeometrySettings;
  sdfSettings?: IDistanceData;
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
  geometrySettings,
  sdfSettings,
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
    if (scene?.isReady()) createMesh(scene, geometrySettings ?? defaultGeometrySettings, sdfSettings ?? defaultDistanceData);
  }, [onSceneReady, geometrySettings, sdfSettings, scene]);

  return <canvas className='babylon-scene' ref={reactCanvas} id={id} />;
};

export default BabylonScene;
