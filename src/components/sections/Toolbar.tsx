import React from 'react';
import { useMode } from '../shared/Mode';

/** the buttons over the scene: editing the curve or turning a straight text (when a text is selected), undo and redo, and hiding the settings on a desktop */
export const Toolbar: React.FC<{
  /** whether the selected node has a curve to edit, or is a straight text to turn (rotate), and whether it is edited */
  curve: boolean;
  rotate?: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  panelsHidden: boolean;
  setPanelsHidden: (hidden: boolean) => void;
}> = ({ curve, rotate, editing, setEditing, undo, redo, canUndo, canRedo, panelsHidden, setPanelsHidden }) => {
  const { mobile } = useMode();
  return (
    <div className='toolbar'>
      {curve && (
        <button
          className={editing ? 'mode primary' : 'mode'}
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
          title={rotate ? 'Turn the text from above (Esc to leave)' : 'Edit the curve from above (Esc to leave)'}
        >
          {editing ? '👁 View' : rotate ? '↻ Rotate' : '✎ Edit curve'}
        </button>
      )}
      <button onClick={undo} disabled={!canUndo} aria-label='undo' title='Undo (Ctrl+Z)'>
        ↶
      </button>
      <button onClick={redo} disabled={!canRedo} aria-label='redo' title='Redo (Ctrl+Shift+Z)'>
        ↷
      </button>
      {!mobile && (
        <button
          onClick={() => setPanelsHidden(!panelsHidden)}
          aria-pressed={!panelsHidden}
          aria-label={panelsHidden ? 'show the settings' : 'hide the settings'}
          title={panelsHidden ? 'Show the settings' : 'Hide the settings'}
        >
          {panelsHidden ? '⇤' : '⇥'}
        </button>
      )}
    </div>
  );
};
