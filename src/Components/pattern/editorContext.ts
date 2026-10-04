import React from 'react';

/** what the pattern editors share with the rest of the app: the errors of the fields, the mode and the editing of a base curve in 3d */
export interface IEditorContext {
  /** expert mode shows every setting, simple mode the ones most patterns need */
  expert: boolean;
  /** by field key, see usePatternFields */
  errors: Record<string, string>;
  /** whether the curve of the selected text node is edited in the scene */
  curveEdit: boolean;
  setCurveEdit: (editing: boolean) => void;
  /** the selected point of that curve */
  curvePoint?: number;
  setCurvePoint: (index?: number) => void;
}

export const EditorContext = React.createContext<IEditorContext>({ expert: false, errors: {}, curveEdit: false, setCurveEdit: () => {}, setCurvePoint: () => {} });
