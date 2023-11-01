import { useEffect, useRef } from 'react';
import { Engine, EngineOptions, Scene, SceneOptions } from '@babylonjs/core';
import * as React from 'react';
import { IDistanceData } from '../geometry/sdMethods';

export interface ISceneProps {
  antialias: boolean;
  engineOptions?: EngineOptions;
  adaptToDeviceRatio: boolean;
  sceneOptions?: SceneOptions;
  sdfSettings: IDistanceData;
  onRender: (scene: Scene) => void;
  onSceneReady: (scene: Scene, sdfSettings: IDistanceData) => void;
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
  sdfSettings,
}) => {
  const reactCanvas = useRef(null);

  // set up basic engine and scene
  useEffect(() => {
    const { current: canvas } = reactCanvas;

    if (!canvas) return;

    const engine = new Engine(canvas, antialias, engineOptions, adaptToDeviceRatio);
    const scene = new Scene(engine, sceneOptions);

    if (scene.isReady()) {
      onSceneReady(scene, sdfSettings);
    } else {
      scene.onReadyObservable.addOnce((scene) => onSceneReady(scene, sdfSettings));
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
  }, [antialias, engineOptions, adaptToDeviceRatio, sceneOptions, onRender, onSceneReady, sdfSettings]);

  return <canvas className='babylon-scene' ref={reactCanvas} id={id} />;
};

export default BabylonScene;
