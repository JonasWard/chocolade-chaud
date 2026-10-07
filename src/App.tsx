import React from 'react';
import { Scene } from './three/Scene';
import { Export } from './Components/Export';
import { BarPanel } from './Components/BarPanel';
import { PatternPanel } from './Components/pattern/PatternPanel';
import { PatternEditorContext, usePatternEditor } from './Components/pattern/patternEditor';
import { EditorContext, IEditorContext } from './Components/pattern/editorContext';
import { SettingsPanel } from './Components/panels';
import { ExpertToggle, SceneStatus, SettingsSheet, Toolbar } from './Components/Toolbar';
import { ModeContext, useModeState } from './Components/mode';
import { useGridMeshes } from './hooks/useGridMeshes';
import { usePatternFields } from './hooks/usePatternFields';
import { useHistory } from './hooks/useHistory';
import { useStoredFlag } from './hooks/useStoredFlag';
import { useAutoSave } from './hooks/useAutoSave';
import { useCurveEdit, useCurveEditing } from './hooks/useCurveEditing';
import { loadState } from './state/persist';

function App() {
  const { state: bar, set: setBar, undo, redo, canUndo, canRedo } = useHistory(loadState);
  const pattern = bar.sdfSetting;
  const { fields, errors } = usePatternFields(pattern);
  const { result, pending, error } = useGridMeshes(bar, fields);
  // expert mode shows every setting, on a phone the pattern comes first
  const mode = useModeState();

  // the base curve of a selected text node can be edited in the scene, until another node is selected
  const curveEdit = useCurveEdit();
  const patternEditor = usePatternEditor(pattern, (sdfSetting) => setBar({ ...bar, sdfSetting }), curveEdit.reset);
  const { curve, editing } = useCurveEditing(bar, setBar, fields, patternEditor.selected, mode.expert, curveEdit);

  // the settings can be hidden, on a phone they make room for a curve while it is edited
  const [panelsHidden, setPanelsHidden] = useStoredFlag('chocolade-chaud:panels-hidden');
  const hidden = panelsHidden || (mode.mobile && editing);

  const { setCurveEdit, curvePoint, setCurvePoint } = curveEdit;
  const editor: IEditorContext = { errors, curveEdit: editing, setCurveEdit, curvePoint, setCurvePoint };
  useAutoSave(bar);

  return (
    <ModeContext.Provider value={mode}>
      <EditorContext.Provider value={editor}>
        <PatternEditorContext.Provider value={patternEditor}>
          <div className={hidden ? 'app panels-hidden' : 'app'}>
            <main className='viewport'>
              <Scene grid={bar} fields={fields} meshes={result} curve={curve} />
              <Toolbar curve={!!curve} editing={editing} setEditing={setCurveEdit} {...{ undo, redo, canUndo, canRedo, panelsHidden, setPanelsHidden }} />
              <ExpertToggle />
              <SceneStatus pending={pending} error={error} />
            </main>
            <SettingsSheet hidden={hidden} setHidden={setPanelsHidden}>
              <SettingsPanel id='bar' title='Bar'>
                <BarPanel bar={bar} setBar={setBar} />
              </SettingsPanel>
              <SettingsPanel id='pattern' title='Pattern' defaultOpen='always'>
                <PatternPanel />
              </SettingsPanel>
              <SettingsPanel id='export' title='Export'>
                <Export meshes={pending ? undefined : result} />
              </SettingsPanel>
            </SettingsSheet>
          </div>
        </PatternEditorContext.Provider>
      </EditorContext.Provider>
    </ModeContext.Provider>
  );
}

export default App;
