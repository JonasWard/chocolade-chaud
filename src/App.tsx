import React from 'react';
import { Scene } from './three/Scene';
import { Export } from './Components/Export';
import { BarPanel } from './Components/BarPanel';
import { PatternPanel } from './Components/pattern/PatternPanel';
import { EditorContext, IEditorContext } from './Components/pattern/editorContext';
import { Section } from './Components/ui';
import { useGridMeshes } from './hooks/useGridMeshes';
import { usePatternFields } from './hooks/usePatternFields';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MOBILE } from './Components/pattern/PatternPanel';
import { useHistory } from './hooks/useHistory';
import { loadState, saveState } from './state/persist';
import { ICurve } from './geometry/curve';
import { findNode, nodeFrame, updateNode } from './geometry/sdf/treeOps';
import { ICurveEditing } from './three/CurveEditor';

const SAVE_DELAY = 300;

function App() {
  const { state: grid, set: setGrid, undo, redo, canUndo, canRedo } = useHistory(loadState);
  const pattern = grid.sdfSetting;
  const { fields, errors } = usePatternFields(pattern);
  const { result, pending, error } = useGridMeshes(grid, fields);
  // on a phone the pattern comes first
  const mobile = useMediaQuery(MOBILE);

  // the selected node, the base curve of a selected text node can be edited in the scene
  const [selected, setSelectedNode] = React.useState<string>();
  const [curveEdit, setCurveEdit] = React.useState(false);
  const [curvePoint, setCurvePoint] = React.useState<number>();
  const setSelected = (id?: string) => {
    if (id === selected) return;
    setSelectedNode(id);
    setCurveEdit(false);
    setCurvePoint(undefined);
  };

  const node = selected ? findNode(pattern.root, selected) : undefined;
  const textNode = node?.kind === 'text' && node.curve ? node : undefined;
  const frame = textNode && nodeFrame(pattern.root, textNode.id);
  const editing = curveEdit && !!frame;
  const curve: ICurveEditing | undefined =
    textNode?.curve && frame
      ? {
          curve: textNode.curve,
          scale: frame.scale,
          exact: frame.exact,
          editing,
          point: curvePoint,
          onChange: (c: ICurve) => setGrid({ ...grid, sdfSetting: { ...pattern, root: updateNode(pattern.root, textNode.id, (n) => ({ ...n, curve: c })) } }),
          onSelectPoint: setCurvePoint,
        }
      : undefined;

  // escape leaves the editing of a curve
  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCurveEdit(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const editor: IEditorContext = { errors, curveEdit: editing, setCurveEdit, curvePoint, setCurvePoint };

  // in the url and local storage, a little after the last edit or when the page is left before that
  React.useEffect(() => {
    const timeout = setTimeout(() => saveState(grid), SAVE_DELAY);
    const save = () => saveState(grid, true);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('pagehide', save);
    };
  }, [grid]);

  return (
    <EditorContext.Provider value={editor}>
      <div className='app'>
        <main className='viewport'>
          <Scene grid={grid} fields={fields} meshes={result} curve={curve} />
          <div className='toolbar'>
            {curve && (
              <button className={editing ? 'mode primary' : 'mode'} aria-pressed={editing} onClick={() => setCurveEdit(!editing)} title='Edit the curve from above (Esc to leave)'>
                {editing ? '👁 View' : '✎ Edit curve'}
              </button>
            )}
            {editing && !curve?.exact && <span className='toolbar-note'>warped by its chain: points as if its input were 1</span>}
            <button onClick={undo} disabled={!canUndo} aria-label='undo' title='Undo (Ctrl+Z)'>
              ↶
            </button>
            <button onClick={redo} disabled={!canRedo} aria-label='redo' title='Redo (Ctrl+Shift+Z)'>
              ↷
            </button>
          </div>
          <div className='status'>
            {pending && <span className='spinner' aria-label='generating' />}
            {error && <span className='error'>{error}</span>}
          </div>
        </main>
        <aside className='panels'>
          <Section title='Bar' open={!mobile}>
            <BarPanel grid={grid} setGrid={setGrid} />
          </Section>
          <Section title='Pattern' open>
            <PatternPanel pattern={pattern} setPattern={(sdfSetting) => setGrid({ ...grid, sdfSetting })} selected={selected} setSelected={setSelected} />
          </Section>
          <Section title='Export' open={!mobile}>
            <Export meshes={pending ? undefined : result} />
          </Section>
        </aside>
      </div>
    </EditorContext.Provider>
  );
}

export default App;
