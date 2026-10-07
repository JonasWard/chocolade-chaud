import React from 'react';
import { useMode } from './mode';
import { ErrorText } from './ui';

/** the buttons over the scene: editing the curve (when there is one), undo and redo, and hiding the settings on a desktop */
export const Toolbar: React.FC<{
  /** whether the selected node has a curve to edit, and whether it is edited */
  curve: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  panelsHidden: boolean;
  setPanelsHidden: (hidden: boolean) => void;
}> = ({ curve, editing, setEditing, undo, redo, canUndo, canRedo, panelsHidden, setPanelsHidden }) => {
  const { mobile } = useMode();
  return (
    <div className='toolbar'>
      {curve && (
        <button
          className={editing ? 'mode primary' : 'mode'}
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
          title='Edit the curve from above (Esc to leave)'
        >
          {editing ? '👁 View' : '✎ Edit curve'}
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

/** the faint ⚙ at the top left of the scene, highlighted while expert mode is on: simple mode is what most people need */
export const ExpertToggle: React.FC = () => {
  const { expert, setExpert } = useMode();
  return (
    <button
      className={expert ? 'expert-toggle on' : 'expert-toggle'}
      aria-pressed={expert}
      aria-label='expert mode'
      title={expert ? 'Expert mode: every setting (tap for simple)' : 'Expert mode: every setting'}
      onClick={() => setExpert(!expert)}
    >
      ⚙
    </button>
  );
};

/** whether the meshes are being generated, and why they couldn't be */
export const SceneStatus: React.FC<{ pending: boolean; error?: string }> = ({ pending, error }) => (
  <div className='status'>
    {pending && <span className='spinner' aria-label='generating' />}
    {error && <ErrorText>{error}</ErrorText>}
  </div>
);

/** the settings next to the scene, on a phone a sheet under it with a handle that hides and shows them */
export const SettingsSheet: React.FC<{ hidden: boolean; setHidden: (hidden: boolean) => void; children: React.ReactNode }> = ({ hidden, setHidden, children }) => {
  const { mobile } = useMode();
  return (
    <aside className='panels'>
      {mobile && (
        <button className='sheet-handle' aria-expanded={!hidden} onClick={() => setHidden(!hidden)}>
          <span className='grabber' />
          {hidden ? 'Settings' : 'Hide'}
        </button>
      )}
      {!hidden && children}
    </aside>
  );
};
