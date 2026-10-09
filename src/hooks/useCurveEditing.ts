import React from 'react';
import { ICurve } from '../geometry/curve';
import { IFrame } from '../geometry/pieces';
import { IPattern, SdfNode, SvgFields } from '../geometry/sdf/tree';
import { findNode, updateNode } from '../geometry/sdf/treeOps';
import { nodeScaleAt } from '../geometry/sdf/evaluate';
import { placePattern, pointInNode } from '../geometry/sdf/placement';
import type { ICurveEditing } from '../three/CurveEditor';

/** whether the base curve of the selected text node is edited in the scene, and its selected point */
export interface ICurveEdit {
  curveEdit: boolean;
  setCurveEdit: (editing: boolean) => void;
  curvePoint?: number;
  setCurvePoint: (index?: number) => void;
  /** stops editing, for when another node is selected */
  reset: () => void;
}

/** the editing of the base curve for the fields of the selected text node: curveEdit is whether it is edited now */
export const CurveEditContext = React.createContext<Omit<ICurveEdit, 'reset'>>({ curveEdit: false, setCurveEdit: () => {}, setCurvePoint: () => {} });

export const useCurveEdit = (): ICurveEdit => {
  const [curveEdit, setCurveEdit] = React.useState(false);
  const [curvePoint, setCurvePoint] = React.useState<number>();
  const reset = React.useCallback(() => {
    setCurveEdit(false);
    setCurvePoint(undefined);
  }, []);
  return { curveEdit, setCurveEdit, curvePoint, setCurvePoint, reset };
};

/**
 * The base curve of the selected text node as the scene draws and edits it, undefined when the selected node has none. editing is
 * whether it is edited now: only while there is a curve. Escape stops editing. pattern is what is edited, frame is that pattern as
 * the bar it is drawn on sees it (see frameOf in geometry/grid.ts), height the height of the bars
 */
export const useCurveEditing = (
  frame: IFrame,
  pattern: IPattern,
  setPattern: (pattern: IPattern) => void,
  height: number,
  fields: SvgFields,
  selected: string | undefined,
  handles: boolean,
  { curveEdit, setCurveEdit, curvePoint, setCurvePoint }: ICurveEdit
): { curve?: ICurveEditing; editing: boolean } => {
  // the svg shapes and texts where they go on the bars
  const placed = React.useMemo(() => placePattern(frame.pattern, frame.box, fields, frame.centre), [frame, fields]);
  const node = selected ? findNode(placed.root, selected) : undefined;
  const textNode = node?.kind === 'text' && node.curve ? node : undefined;
  // the scale the text is drawn at over the bars, it varies inside a chain
  const textId = textNode?.id;
  const scaleAt = React.useMemo(() => textId && nodeScaleAt(placed, textId, fields, height - placed.center.y), [placed, textId, fields, height]);
  const editing = curveEdit && !!scaleAt;

  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCurveEdit(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, setCurveEdit]);

  if (!textNode?.curve || !scaleAt) return { editing };
  return {
    editing,
    curve: {
      pattern: placed,
      curve: textNode.curve,
      offset: { x: textNode.offsetX, z: textNode.offsetZ },
      scaleAt,
      handles,
      editing,
      point: curvePoint,
      // a text against an edge stays where it is while its curve changes: centred, moved to where it is
      onChange: (c: ICurve) => {
        const { alignX, alignZ, offsetX, offsetZ } = textNode;
        // where a centred one is without a padding
        const centre = frame.centre ? pointInNode(placed, frame.centre, textNode.id) : { x: 0, z: 0 };
        const stay = {
          ...(alignX === 'center' ? {} : { alignX: 'center', paddingX: offsetX - centre.x }),
          ...(alignZ === 'middle' ? {} : { alignZ: 'middle', paddingZ: offsetZ - centre.z }),
        };
        setPattern({ ...pattern, root: updateNode(pattern.root, textNode.id, (n) => ({ ...n, ...stay, curve: c }) as SdfNode) });
      },
      onSelectPoint: setCurvePoint,
    },
  };
};
