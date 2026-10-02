import React from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { ICurve, IPoint2, deleteAt, flatten, insertAt, isAnchor, moveAt, segmentMidpoints } from '../geometry/curve';
import { IPattern } from '../geometry/sdf/tree';
import { toPattern, toWorld } from '../geometry/sdf/evaluate';

// the base curve of a text node in the scene, its points dragged on the plane at the top of the bars

/** the curve being edited, scale is the static scale of its text node (see staticScale) */
export interface ICurveEditing {
  curve: ICurve;
  scale: number;
  /** points can be dragged, added and deleted, else the curve is only shown */
  editing: boolean;
  point?: number;
  onChange: (curve: ICurve) => void;
  onSelectPoint: (index?: number) => void;
}

const ACCENT = '#a73a08';
const INK = '#2b211c';
// in pixels, the handles keep their size on screen
const ANCHOR = 7;
const CONTROL = 5;
const GHOST = 5;
const HIT = 16;

const flat = new THREE.Euler(-Math.PI / 2, 0, 0);
const overlay = { depthTest: false, depthWrite: false, transparent: true } as const;

const isTyping = (target: EventTarget | null) => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;

export const CurveEditor: React.FC<ICurveEditing & { pattern: IPattern; y: number }> = ({ curve, scale, editing, point, onChange, onSelectPoint, pattern, y }) => {
  const get = useThree((state) => state.get);
  const handles = React.useRef<THREE.Group>(null);

  const world = (p: IPoint2) => {
    const w = toWorld(pattern, scale, p);
    return new THREE.Vector3(w.x, y, w.z);
  };

  // a world unit per pixel, so the handles have the same size on screen at every zoom
  useFrame(({ camera, size }) => {
    if (!handles.current) return;
    const unit =
      camera instanceof THREE.OrthographicCamera
        ? 1 / camera.zoom
        : (2 * camera.position.y * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)) / size.height;
    handles.current.children.forEach((h) => h.scale.setScalar(unit));
  });

  /** follows the pointer on the plane until it is released, from the curve at the start of the drag */
  const drag = (start: ICurve, index: number) => {
    const { controls, gl } = get();
    const orbit = controls as unknown as { enabled: boolean } | null;
    if (orbit) orbit.enabled = false;
    onSelectPoint(index);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const raycaster = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    let current = start;
    const move = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, get().camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      current = moveAt(current, index, toPattern(pattern, scale, { x: hit.x, z: hit.z }));
      onChange(current);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (orbit) orbit.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const onPoint = (index: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    drag(curve, index);
  };

  const onGhost = (segment: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const inserted = insertAt(curve, segment);
    onChange(inserted.curve);
    drag(inserted.curve, inserted.index);
  };

  // the selected point is deleted with delete or backspace
  React.useEffect(() => {
    if (!editing || point === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || isTyping(e.target)) return;
      e.preventDefault();
      onChange(deleteAt(curve, point));
      onSelectPoint(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, point, curve, onChange, onSelectPoint]);

  const path = flatten(curve).map(world);
  const points = curve.points.map(world);

  return (
    <group renderOrder={10}>
      <Line points={path} color={ACCENT} lineWidth={editing ? 2 : 1.5} transparent opacity={editing ? 1 : 0.5} depthTest={false} renderOrder={10} />
      {editing && curve.mode === 'spline' && (
        // the arms from the anchors to their controls
        <>
          {points.map((p, i) =>
            isAnchor(curve, i) ? null : (
              <Line key={i} points={[p, points[i % 3 === 1 ? i - 1 : i + 1]]} color={INK} lineWidth={1} transparent opacity={0.5} depthTest={false} renderOrder={10} />
            )
          )}
        </>
      )}
      {editing && (
        <group ref={handles}>
          {segmentMidpoints(curve).map((m, k) => (
            <mesh key={`ghost-${k}`} position={world(m)} rotation={flat} renderOrder={11} onPointerDown={onGhost(k)}>
              <circleGeometry args={[HIT * 0.7, 16]} />
              <meshBasicMaterial color={ACCENT} opacity={0} {...overlay} />
              <mesh renderOrder={11}>
                <circleGeometry args={[GHOST, 16]} />
                <meshBasicMaterial color={ACCENT} opacity={0.35} {...overlay} />
              </mesh>
            </mesh>
          ))}
          {points.map((p, i) => {
            const anchor = isAnchor(curve, i);
            const selected = i === point;
            return (
              <mesh key={i} position={p} rotation={flat} renderOrder={12} onPointerDown={onPoint(i)}>
                <circleGeometry args={[HIT, 16]} />
                <meshBasicMaterial color={ACCENT} opacity={0} {...overlay} />
                <mesh renderOrder={12}>
                  {anchor ? <circleGeometry args={[selected ? ANCHOR * 1.4 : ANCHOR, 24]} /> : <planeGeometry args={[CONTROL * 2, CONTROL * 2]} />}
                  <meshBasicMaterial color={selected ? INK : anchor ? ACCENT : '#ffffff'} {...overlay} />
                </mesh>
                {!anchor && (
                  <mesh renderOrder={11}>
                    <planeGeometry args={[CONTROL * 2 + 3, CONTROL * 2 + 3]} />
                    <meshBasicMaterial color={INK} {...overlay} />
                  </mesh>
                )}
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
};
