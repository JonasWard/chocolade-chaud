import React from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { ICurve, IPoint2, deleteAt, flatten, insertAt, isAnchor, moveAt, segmentMidpoints } from '../geometry/curve';
import { IPattern } from '../geometry/sdf/tree';
import { fromNode, toPattern, toWorld } from '../geometry/sdf/evaluate';

// the base curve of a text node in the scene while it is edited, its points dragged on the plane at the top of the bars

/** the curve of the selected text node */
export interface ICurveEditing {
  curve: ICurve;
  /** the scale its text node is evaluated at, at a point of the plane of the pattern (see nodeScaleAt) */
  scaleAt: (x: number, z: number) => number;
  /** whether it is edited in the scene */
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

/** where the points of the text node are on the bars, undefined where they are nowhere (see fromNode). Every point starts from the one before */
export const curveToWorld = (pattern: IPattern, scaleAt: ICurveEditing['scaleAt'], points: IPoint2[]): (IPoint2 | undefined)[] => {
  let previous: IPoint2 | undefined;
  return points.map((q) => {
    const p = fromNode(scaleAt, q, previous) ?? fromNode(scaleAt, q);
    previous = p;
    return p && toWorld(pattern, 1, p);
  });
};

/** the runs of a line that are somewhere */
const runs = (points: (THREE.Vector3 | undefined)[]): THREE.Vector3[][] =>
  points.reduce<THREE.Vector3[][]>((all, p, i) => {
    if (!p) return all;
    if (i === 0 || !points[i - 1]) all.push([]);
    all[all.length - 1].push(p);
    return all;
  }, []);

export const CurveEditor: React.FC<ICurveEditing & { pattern: IPattern; y: number }> = ({ curve, scaleAt, point, onChange, onSelectPoint, pattern, y }) => {
  const get = useThree((state) => state.get);
  const handles = React.useRef<THREE.Group>(null);

  const vector = (w?: IPoint2) => w && new THREE.Vector3(w.x, y, w.z);
  const toScene = (points: IPoint2[]) => curveToWorld(pattern, scaleAt, points).map(vector);

  // a world unit per pixel, so the handles have the same size on screen at every zoom
  useFrame(({ camera, size }) => {
    if (!handles.current) return;
    const unit =
      camera instanceof THREE.OrthographicCamera ? 1 / camera.zoom : (2 * camera.position.y * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)) / size.height;
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
      const p = toPattern(pattern, 1, { x: hit.x, z: hit.z });
      const s = scaleAt(p.x, p.z);
      current = moveAt(current, index, { x: p.x * s, z: p.z * s });
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
    if (point === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || isTyping(e.target)) return;
      e.preventDefault();
      onChange(deleteAt(curve, point));
      onSelectPoint(undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [point, curve, onChange, onSelectPoint]);

  const path = runs(toScene(flatten(curve)));
  const points = toScene(curve.points);
  const midpoints = toScene(segmentMidpoints(curve));

  return (
    <group renderOrder={10}>
      {path.map((run, i) => run.length > 1 && <Line key={i} points={run} color={ACCENT} lineWidth={2} depthTest={false} renderOrder={10} />)}
      {curve.mode === 'spline' && (
        // the arms from the anchors to their controls
        <>
          {points.map((p, i) => {
            const anchor = points[i % 3 === 1 ? i - 1 : i + 1];
            return isAnchor(curve, i) || !p || !anchor ? null : (
              <Line key={i} points={[p, anchor]} color={INK} lineWidth={1} transparent opacity={0.5} depthTest={false} renderOrder={10} />
            );
          })}
        </>
      )}
      <group ref={handles}>
        {midpoints.map(
          (m, k) =>
            m && (
              <mesh key={`ghost-${k}`} position={m} rotation={flat} renderOrder={11} onPointerDown={onGhost(k)}>
                <circleGeometry args={[HIT * 0.7, 16]} />
                <meshBasicMaterial color={ACCENT} opacity={0} {...overlay} />
                <mesh renderOrder={11}>
                  <circleGeometry args={[GHOST, 16]} />
                  <meshBasicMaterial color={ACCENT} opacity={0.35} {...overlay} />
                </mesh>
              </mesh>
            )
        )}
        {points.map((p, i) => {
          const anchor = isAnchor(curve, i);
          const selected = i === point;
          return (
            p && (
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
            )
          );
        })}
      </group>
    </group>
  );
};
