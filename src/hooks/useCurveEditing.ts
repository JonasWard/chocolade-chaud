import React from 'react';
import { ICurve, IPoint2 } from '../geometry/curve';
import { IFrame } from '../geometry/pieces';
import { IPattern, ITextNode, SdfNode, SvgFields } from '../geometry/sdf/tree';
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

/** a straight text as a line through its centre along its angle, about as long as the text, for turning it in the scene */
export const rotateLine = ({ size, text, angle }: Pick<ITextNode, 'size' | 'text' | 'angle'>): ICurve => {
  const half = Math.max(size * text.length * 0.7, 2 * size) / 2;
  const [c, s] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
  return { mode: 'polyline', points: [-half, half].map((d) => ({ x: c * d, z: s * d })) };
};

/** the angle of a straight text, in degrees, when an end of its line (see rotateLine) is dragged to p: the start end points the other way */
export const angleFromEnd = (index: number, { x, z }: IPoint2): number => {
  const degrees = (Math.atan2(z, x) * 180) / Math.PI + (index === 0 ? 180 : 0);
  // in (-180, 180]
  const turned = ((degrees % 360) + 360) % 360;
  return Math.round((turned > 180 ? turned - 360 : turned) * 10) / 10;
};

/**
 * The base curve of the selected text node as the scene draws and edits it, undefined when the selected node is no text. A straight
 * text is a line through its centre that turns it (rotate). editing is whether it is edited now: only while there is a text. Escape
 * stops editing. pattern is what is edited, frame is that pattern as the bar it is drawn on sees it (see frameOf in geometry/grid.ts),
 * height the height of the bars
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
  const textNode = node?.kind === 'text' ? node : undefined;
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

  if (!textNode || !scaleAt) return { editing };
  // a text against an edge stays where it is while its curve or its angle changes: centred, moved to where it is
  const { alignX, alignZ, offsetX, offsetZ } = textNode;
  // where a centred one is without a padding
  const centre = frame.centre ? pointInNode(placed, frame.centre, textNode.id) : { x: 0, z: 0 };
  const stay = {
    ...(alignX === 'center' ? {} : { alignX: 'center', paddingX: offsetX - centre.x }),
    ...(alignZ === 'middle' ? {} : { alignZ: 'middle', paddingZ: offsetZ - centre.z }),
  };
  const update = (patch: Partial<ITextNode>) => setPattern({ ...pattern, root: updateNode(pattern.root, textNode.id, (n) => ({ ...n, ...stay, ...patch }) as SdfNode) });
  const rotate = !textNode.curve;
  return {
    editing,
    curve: {
      pattern: placed,
      curve: textNode.curve ?? rotateLine(textNode),
      rotate,
      offset: { x: offsetX, z: offsetZ },
      scaleAt,
      handles,
      editing,
      point: curvePoint,
      onChange: (c: ICurve, index?: number) => {
        if (!rotate) return update({ curve: c });
        if (index !== undefined) update({ angle: angleFromEnd(index, c.points[index]) });
      },
      onSelectPoint: setCurvePoint,
    },
  };
};
