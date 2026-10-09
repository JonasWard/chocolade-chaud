import React from 'react';
import { Scene } from './three/Scene';
import { ExportPanel } from './components/sections/ExportPanel';
import { BarPanel } from './components/sections/BarPanel';
import { PatternPanel } from './components/sections/pattern/PatternPanel';
import { PatternEditorContext, usePatternEditor } from './hooks/usePatternEditor';
import { SettingsPanel } from './components/shared/SettingsPanel';
import { Toolbar } from './components/sections/Toolbar';
import { ExpertToggle } from './components/sections/ExpertToggle';
import { SceneStatus } from './components/sections/SceneStatus';
import { SettingsSheet } from './components/sections/SettingsSheet';
import { ModeContext, useModeState } from './components/shared/Mode';
import { useGridMeshes } from './hooks/useGridMeshes';
import { usePatternFields } from './hooks/usePatternFields';
import { useHistory } from './hooks/useHistory';
import { useStoredFlag } from './hooks/useStoredFlag';
import { useAutoSave } from './hooks/useAutoSave';
import { CurveEditContext, useCurveEdit, useCurveEditing } from './hooks/useCurveEditing';
import { loadState } from './state/persist';
import { barFrames, frameOf, isUnique, overrideOf, piecePattern, withOverride, withPiecePattern, withSharedPattern } from './geometry/grid';
import { IPieces, PiecesContext, Scope } from './hooks/usePieces';

function App() {
  const { state: bar, set: setBar, undo, redo, canUndo, canRedo } = useHistory(loadState);
  // the piece of a combined tablet that is picked, of a unique one the pattern is edited for all its pieces or for that one alone
  const [picked, setPiece] = React.useState(0);
  const [scope, setScope] = React.useState<Scope>('all');
  const piece = Math.min(picked, bar.pieces.length - 1);
  const alone = isUnique(bar) && scope === 'piece';
  const pattern = alone ? piecePattern(bar, piece) : bar.sdfSetting;
  const setPattern = (edited: typeof pattern) => setBar(alone ? withPiecePattern(bar, piece, edited) : withSharedPattern(bar, edited));
  const pieces: IPieces = {
    piece,
    setPiece,
    scope,
    setScope,
    override: alone ? overrideOf(bar, piece) : undefined,
    setOverride: (override) => setBar(withOverride(bar, piece, override)),
  };

  // every bar has the pattern in its frame, the picked one is where the pattern is edited in the scene
  const frames = React.useMemo(() => barFrames(bar), [bar]);
  const frame = React.useMemo(() => frameOf(bar, pattern, piece), [bar, pattern, piece]);
  const trees = React.useMemo(() => frames.map((f) => f.pattern.root), [frames]);
  const { fields, errors } = usePatternFields(bar.sdfSetting.svgs, trees);
  const { result, pending, error } = useGridMeshes(bar, fields);
  // expert mode shows every setting, on a phone the pattern comes first
  const mode = useModeState();

  // the base curve of a selected text node can be edited in the scene, until another node is selected
  const curveEdit = useCurveEdit();
  const patternEditor = usePatternEditor(pattern, setPattern, errors, curveEdit.reset);
  const { curve, editing } = useCurveEditing(frame, pattern, setPattern, bar.height, fields, patternEditor.selected, mode.expert, curveEdit);

  // the settings can be hidden, on a phone they make room for a curve while it is edited
  const [panelsHidden, setPanelsHidden] = useStoredFlag('chocolade-chaud:panels-hidden');
  const hidden = panelsHidden || (mode.mobile && editing);

  const { setCurveEdit, curvePoint, setCurvePoint } = curveEdit;
  const curveContext = { curveEdit: editing, setCurveEdit, curvePoint, setCurvePoint };
  useAutoSave(bar);

  // a tap on a piece in the scene edits it alone
  const pick = (index: number) => {
    setPiece(index);
    setScope('piece');
  };

  return (
    <ModeContext.Provider value={mode}>
      <PiecesContext.Provider value={pieces}>
        <CurveEditContext.Provider value={curveContext}>
          <PatternEditorContext.Provider value={patternEditor}>
            <div className={hidden ? 'app panels-hidden' : 'app'}>
              <main className='viewport'>
                <Scene grid={bar} fields={fields} meshes={result} curve={curve} piece={alone ? piece : undefined} onPick={isUnique(bar) && !editing ? pick : undefined} />
                <Toolbar
                  curve={!!curve}
                  rotate={!!curve?.rotate}
                  editing={editing}
                  setEditing={setCurveEdit}
                  {...{ undo, redo, canUndo, canRedo, panelsHidden, setPanelsHidden }}
                />
                <ExpertToggle />
                <SceneStatus pending={pending} error={error} />
              </main>
              <SettingsSheet hidden={hidden} setHidden={setPanelsHidden}>
                <SettingsPanel id='bar' title='Bar'>
                  <BarPanel bar={bar} setBar={setBar} />
                </SettingsPanel>
                <SettingsPanel id='pattern' title='Pattern' defaultOpen='always'>
                  <PatternPanel bar={bar} setBar={setBar} />
                </SettingsPanel>
                <SettingsPanel id='export' title='Export'>
                  <ExportPanel meshes={pending ? undefined : result} />
                </SettingsPanel>
              </SettingsSheet>
            </div>
          </PatternEditorContext.Provider>
        </CurveEditContext.Provider>
      </PiecesContext.Provider>
    </ModeContext.Provider>
  );
}

export default App;
