import React from 'react';

/** what the pattern editors share with the rest of the app: the errors of the fields and the editing of a base curve in 3d */
export interface IEditorContext {
  /** by field key, see usePatternFields */
  errors: Record<string, string>;
  /** whether the curve of the selected text node is edited in the scene */
  curveEdit: boolean;
  setCurveEdit: (editing: boolean) => void;
  /** the selected point of that curve */
  curvePoint?: number;
  setCurvePoint: (index?: number) => void;
}

export const EditorContext = React.createContext<IEditorContext>({ errors: {}, curveEdit: false, setCurveEdit: () => {}, setCurvePoint: () => {} });
