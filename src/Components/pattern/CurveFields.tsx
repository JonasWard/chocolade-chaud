import React from 'react';
import { CurveMode, ICurve, canDelete, convert, deleteAt, insertAt, isAnchor, straightCurve } from '../../geometry/curve';
import { ITextNode } from '../../geometry/sdf/tree';
import { NumberField, Select } from '../ui';
import { EditorContext } from './editorContext';

type BaseLine = 'none' | CurveMode;

/** the base curve of a text node: its kind and its points, edited here or in the scene */
/** exact: whether the curve has a fixed place on the bars, inside a chain it is warped by the input of the chain */
export const CurveFields: React.FC<{ node: ITextNode; onChange: (node: ITextNode) => void; exact: boolean }> = ({ node, onChange, exact }) => {
  const { curveEdit, setCurveEdit, curvePoint, setCurvePoint } = React.useContext(EditorContext);
  const { curve } = node;
  const setCurve = (next: ICurve | null) => onChange({ ...node, curve: next });

  const setMode = (mode: BaseLine) => {
    if (mode === 'none') return setCurve(null);
    if (curve) return setCurve(convert(curve, mode));
    // a straight curve where the text is, as long as the text
    const length = Math.max(node.size * node.text.length * 0.7, 2 * node.size);
    const angle = (node.angle * Math.PI) / 180;
    const straight = straightCurve(mode, length);
    const points = straight.points.map(({ x }) => ({ x: node.offsetX + Math.cos(angle) * x, z: node.offsetZ + Math.sin(angle) * x }));
    setCurve({ mode, points });
  };

  return (
    <>
      <label className='field'>
        <span>Base curve</span>
        <Select<BaseLine>
          label='base curve'
          value={curve?.mode ?? 'none'}
          options={[
            ['none', 'None (straight)'],
            ['polyline', 'Polyline'],
            ['spline', 'Spline (cubic)'],
          ]}
          onChange={setMode}
        />
      </label>
      {curve && (
        <>
          <div className='row'>
            <button className={curveEdit ? 'primary' : ''} aria-pressed={curveEdit} onClick={() => setCurveEdit(!curveEdit)}>
              {curveEdit ? '👁 Back to view' : '✎ Edit in 3D'}
            </button>
            {curvePoint !== undefined && canDelete(curve, curvePoint) && (
              <button
                onClick={() => {
                  setCurve(deleteAt(curve, curvePoint));
                  setCurvePoint(undefined);
                }}
              >
                Delete point
              </button>
            )}
          </div>
          <p className='hint'>
            In 3D: drag a point to move it, drag a small dot between two points to add one, tap a point and press Delete to remove it.
            {!exact && ' Inside a chain the letters are warped by the input of the chain, the points are placed as if it were 1.'}
          </p>
          <ol className='points'>
            {curve.points.map((p, i) => (
              <li key={i} className={[isAnchor(curve, i) ? 'anchor' : 'control', i === curvePoint ? 'selected' : ''].join(' ')}>
                <NumberField label={`x ${i}`} value={+p.x.toFixed(2)} step={1} onChange={(x) => setCurve({ ...curve, points: curve.points.map((q, j) => (j === i ? { ...q, x } : q)) })} />
                <NumberField label={`z ${i}`} value={+p.z.toFixed(2)} step={1} onChange={(z) => setCurve({ ...curve, points: curve.points.map((q, j) => (j === i ? { ...q, z } : q)) })} />
                {isAnchor(curve, i) && i < curve.points.length - 1 && (
                  <button aria-label='add a point after it' onClick={() => setCurve(insertAt(curve, curve.mode === 'polyline' ? i : i / 3).curve)}>
                    +
                  </button>
                )}
                {canDelete(curve, i) && (
                  <button aria-label='delete the point' onClick={() => setCurve(deleteAt(curve, i))}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
};
