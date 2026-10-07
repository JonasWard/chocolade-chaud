import React from 'react';
import { CurveMode, ICurve, anchorSegment, canDelete, convert, deleteAt, insertAt, isAnchor, straightCurve } from '../../geometry/curve';
import { ITextNode } from '../../geometry/sdf/tree';
import { PATTERN } from '../../state/settings';
import { Field, Hint, NumberField, Segmented, Select } from '../ui';
import { EditorContext } from './editorContext';

type BaseLine = 'none' | CurveMode;

/** the base curve of a text node: its kind and its points, edited here or in the scene */
export const CurveFields: React.FC<{ node: ITextNode; onChange: (node: ITextNode) => void }> = ({ node, onChange }) => {
  const { expert, curveEdit, setCurveEdit, curvePoint, setCurvePoint } = React.useContext(EditorContext);
  const { curve } = node;
  const setCurve = (next: ICurve | null) => onChange({ ...node, curve: next });

  const setMode = (mode: BaseLine) => {
    if (mode === 'none') return setCurve(null);
    if (curve) return setCurve(convert(curve, mode));
    // a straight curve where the text is, as long as the text
    const length = Math.max(node.size * node.text.length * 0.7, 2 * node.size);
    const angle = (node.angle * Math.PI) / 180;
    const straight = straightCurve(mode, length);
    // where the text is placed moves the curve along
    const points = straight.points.map(({ x }) => ({ x: Math.cos(angle) * x, z: Math.sin(angle) * x }));
    setCurve({ mode, points });
  };

  return (
    <>
      <Field label='Base curve' group>
        {!expert ? (
          // a curve is smooth, one of another kind stays as it is
          <Segmented<'straight' | 'curved'>
            label='base curve'
            value={curve ? 'curved' : 'straight'}
            options={[
              ['straight', 'Straight'],
              ['curved', 'Curved'],
            ]}
            onChange={(v) => (v === 'straight' ? setMode('none') : !curve && setMode('smooth'))}
          />
        ) : (
          <Select<BaseLine>
            label='base curve'
            value={curve?.mode ?? 'none'}
            options={[
              ['none', 'None (straight)'],
              ['smooth', 'Smooth'],
              ['polyline', 'Polyline'],
              ['spline', 'Spline (handles)'],
            ]}
            onChange={setMode}
          />
        )}
      </Field>
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
          <Hint>
            In 3D: drag a point to move it, drag a small dot between two points to add one, tap a point and press Delete to remove it.
            {expert && ' A smooth curve runs through its points, a spline has handles.'}
          </Hint>
          {expert && (
            <ol className='points'>
              {curve.points.map((p, i) => (
                <li key={i} className={[isAnchor(curve, i) ? 'anchor' : 'control', i === curvePoint ? 'selected' : ''].join(' ')}>
                  <NumberField
                    label={`x ${i}`}
                    value={+p.x.toFixed(2)}
                    setting={PATTERN.point}
                    onChange={(x) => setCurve({ ...curve, points: curve.points.map((q, j) => (j === i ? { ...q, x } : q)) })}
                  />
                  <NumberField
                    label={`z ${i}`}
                    value={+p.z.toFixed(2)}
                    setting={PATTERN.point}
                    onChange={(z) => setCurve({ ...curve, points: curve.points.map((q, j) => (j === i ? { ...q, z } : q)) })}
                  />
                  {isAnchor(curve, i) && i < curve.points.length - 1 && (
                    <button aria-label='add a point after it' onClick={() => setCurve(insertAt(curve, anchorSegment(curve, i)).curve)}>
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
          )}
        </>
      )}
    </>
  );
};
