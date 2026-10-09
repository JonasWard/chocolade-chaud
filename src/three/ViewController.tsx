import React from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { MapControls, OrbitControls } from '@react-three/drei';

// view mode: the perspective camera orbiting the bars. Edit mode: an orthographic camera straight above what is edited, panning and
// zooming only. Between them the camera moves smoothly, coming back it returns to where it was before editing

const DURATION = 0.45;
const MARGIN = 1.2;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** what edit mode looks at: a box in the plane at height y */
export interface IViewFocus {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
}

type Phase = 'view' | 'toEdit' | 'edit' | 'toView';
interface IPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}
interface IAnimation {
  from: IPose;
  to: IPose;
  t: number;
  done: () => void;
}

type Controls = { target: THREE.Vector3; update: () => void } | null;

// straight down, the top of the screen towards -z like the view from above the camera fits to
const UP_ON_SCREEN = new THREE.Vector3(0, 0, -1);
const lookingDown = (position: THREE.Vector3, target: THREE.Vector3) =>
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, target, UP_ON_SCREEN));

export const ViewController: React.FC<{ editing: boolean; focus?: IViewFocus }> = ({ editing, focus }) => {
  const set = useThree((state) => state.set);
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as unknown as Controls;
  const initialCamera = useThree((state) => state.camera);
  const [perspective] = React.useState(() => initialCamera as THREE.PerspectiveCamera);
  const [orthographic] = React.useState(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000));
  const [phase, setPhase] = React.useState<Phase>('view');
  const [editTarget, setEditTarget] = React.useState(() => new THREE.Vector3());

  // the view before editing, its camera pose and what it orbited around
  const stored = React.useRef<IPose & { target: THREE.Vector3 }>(undefined);
  const animation = React.useRef<IAnimation>(undefined);

  // the height of the view at a distance, for the perspective camera
  const visibleHeight = (distance: number) => 2 * distance * Math.tan((perspective.fov * Math.PI) / 360);

  React.useEffect(() => {
    if (editing && phase === 'view' && focus) {
      stored.current = { position: perspective.position.clone(), quaternion: perspective.quaternion.clone(), target: controls?.target.clone() ?? new THREE.Vector3() };
      const target = new THREE.Vector3(focus.x, focus.y, focus.z);
      const aspect = size.width / size.height;
      const distance = (MARGIN * Math.max(focus.depth, focus.width / aspect)) / visibleHeight(1);
      const position = target.clone().add(new THREE.Vector3(0, distance, 0));
      const to = { position, quaternion: lookingDown(position, target) };
      animation.current = {
        from: { position: perspective.position.clone(), quaternion: perspective.quaternion.clone() },
        to,
        t: 0,
        done: () => {
          // the same view, orthographic: its frustum is in pixels, see the camera handling of react-three-fiber. The size is the one
          // now, on a phone the settings make room for the scene while it moves
          const now = get().size;
          Object.assign(orthographic, { left: -now.width / 2, right: now.width / 2, top: now.height / 2, bottom: -now.height / 2 });
          orthographic.zoom = now.height / (MARGIN * Math.max(focus.depth, focus.width / (now.width / now.height)));
          orthographic.position.copy(to.position);
          orthographic.quaternion.copy(to.quaternion);
          orthographic.up.copy(UP_ON_SCREEN);
          orthographic.updateProjectionMatrix();
          setEditTarget(target);
          set({ camera: orthographic });
          setPhase('edit');
        },
      };
      setPhase('toEdit');
    } else if (!editing && phase === 'edit' && stored.current) {
      // the same view, in perspective: at the distance that shows as much of the plane
      const target = controls?.target ?? editTarget;
      const distance = (orthographic.top - orthographic.bottom) / orthographic.zoom / visibleHeight(1);
      perspective.position.set(orthographic.position.x, target.y + distance, orthographic.position.z);
      perspective.quaternion.copy(orthographic.quaternion);
      perspective.aspect = size.width / size.height;
      perspective.updateProjectionMatrix();
      set({ camera: perspective });
      const back = stored.current;
      animation.current = {
        from: { position: perspective.position.clone(), quaternion: perspective.quaternion.clone() },
        to: back,
        t: 0,
        done: () => setPhase('view'),
      };
      setPhase('toView');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a change of mode starts a move, not a change of focus or size
  }, [editing, phase]);

  // in edit mode the frustum follows the size of the scene, at the same zoom, so the view is never stretched
  React.useEffect(() => {
    if (phase !== 'edit') return;
    Object.assign(orthographic, { left: -size.width / 2, right: size.width / 2, top: size.height / 2, bottom: -size.height / 2 });
    orthographic.updateProjectionMatrix();
  }, [phase, size, orthographic]);

  // back in view mode, orbit around what was orbited around before
  React.useEffect(() => {
    if (phase !== 'view' || !controls || !stored.current) return;
    controls.target.copy(stored.current.target);
    controls.update();
    stored.current = undefined;
  }, [phase, controls]);

  useFrame((state, delta) => {
    const move = animation.current;
    if (!move) return;
    move.t = Math.min(move.t + delta / DURATION, 1);
    const k = easeInOut(move.t);
    state.camera.position.lerpVectors(move.from.position, move.to.position, k);
    state.camera.quaternion.slerpQuaternions(move.from.quaternion, move.to.quaternion, k);
    if (move.t >= 1) {
      animation.current = undefined;
      move.done();
    }
  });

  if (phase === 'view') return <OrbitControls makeDefault />;
  if (phase === 'edit') return <MapControls makeDefault target={editTarget} enableRotate={false} screenSpacePanning />;
  return null;
};
