import React from 'react';
import { Scene } from './three/Scene';
import { Export } from './Components/Export';
import { BarPanel } from './Components/BarPanel';
import { PatternPanel } from './Components/pattern/PatternPanel';
import { EditorContext, IEditorContext } from './Components/pattern/editorContext';
import { Section, Segmented } from './Components/ui';
import { useGridMeshes } from './hooks/useGridMeshes';
import { usePatternFields } from './hooks/usePatternFields';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MOBILE } from './Components/pattern/PatternPanel';
import { useHistory } from './hooks/useHistory';
import { useStoredFlag } from './hooks/useStoredFlag';
import { loadState, saveState } from './state/persist';
import { ICurve } from './geometry/curve';
import { findNode, updateNode } from './geometry/sdf/treeOps';
import { nodeScaleAt } from './geometry/sdf/evaluate';
import { placePattern } from './geometry/sdf/placement';
import { gridBox } from './geometry/grid';
import { SdfNode } from './geometry/sdf/tree';
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

  // expert mode shows every setting, a preference of this browser, not part of the link
  const [expert, setExpert] = useStoredFlag('chocolade-chaud:expert');

  // the svg shapes and texts where they go on the bars
  const placed = React.useMemo(() => placePattern(pattern, gridBox(grid), fields), [pattern, grid, fields]);
  const node = selected ? findNode(placed.root, selected) : undefined;
  const textNode = node?.kind === 'text' && node.curve ? node : undefined;
  // the scale the text is drawn at over the bars, it varies inside a chain
  const textId = textNode?.id;
  const scaleAt = React.useMemo(() => textId && nodeScaleAt(placed, textId, fields, grid.height - pattern.center.y), [placed, textId, fields, grid.height, pattern.center.y]);
  const editing = curveEdit && !!scaleAt;
  const curve: ICurveEditing | undefined =
    textNode?.curve && scaleAt
      ? {
          curve: textNode.curve,
          offset: { x: textNode.offsetX, z: textNode.offsetZ },
          scaleAt,
          handles: expert,
          editing,
          point: curvePoint,
          // a text against an edge stays where it is while its curve changes: centred, moved to where it is
          onChange: (c: ICurve) => {
            const { alignX, alignZ, offsetX, offsetZ } = textNode;
            const stay = { ...(alignX === 'center' ? {} : { alignX: 'center', paddingX: offsetX }), ...(alignZ === 'middle' ? {} : { alignZ: 'middle', paddingZ: offsetZ }) };
            setGrid({ ...grid, sdfSetting: { ...pattern, root: updateNode(pattern.root, textNode.id, (n) => ({ ...n, ...stay, curve: c }) as SdfNode) } });
          },
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

  // the settings can be hidden, on a phone they make room for a curve while it is edited
  const [panelsHidden, setPanelsHidden] = useStoredFlag('chocolade-chaud:panels-hidden');
  const hidden = panelsHidden || (mobile && editing);

  const editor: IEditorContext = { expert, errors, curveEdit: editing, setCurveEdit, curvePoint, setCurvePoint };

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
      <div className={hidden ? 'app panels-hidden' : 'app'}>
        <main className='viewport'>
          <Scene grid={grid} fields={fields} meshes={result} curve={curve} />
          <div className='toolbar'>
            {curve && (
              <button className={editing ? 'mode primary' : 'mode'} aria-pressed={editing} onClick={() => setCurveEdit(!editing)} title='Edit the curve from above (Esc to leave)'>
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
          <div className='status'>
            {pending && <span className='spinner' aria-label='generating' />}
            {error && <span className='error'>{error}</span>}
          </div>
        </main>
        <aside className='panels'>
          {mobile && (
            // a handle on top of the sheet
            <button className='sheet-handle' aria-expanded={!hidden} onClick={() => setPanelsHidden(!hidden)}>
              <span className='grabber' />
              {hidden ? 'Settings' : 'Hide'}
            </button>
          )}
          {!hidden && (
            <>
              <div className='mode-switch'>
                <Segmented
                  label='mode'
                  value={expert ? 'expert' : 'simple'}
                  options={[
                    ['simple', 'Simple'],
                    ['expert', 'Expert'],
                  ]}
                  onChange={(mode) => setExpert(mode === 'expert')}
                />
              </div>
              <Section title='Bar' open={!mobile}>
                <BarPanel grid={grid} setGrid={setGrid} expert={expert} />
              </Section>
              <Section title='Pattern' open>
                <PatternPanel pattern={pattern} setPattern={(sdfSetting) => setGrid({ ...grid, sdfSetting })} selected={selected} setSelected={setSelected} />
              </Section>
              <Section title='Export' open={!mobile}>
                <Export meshes={pending ? undefined : result} />
              </Section>
            </>
          )}
        </aside>
      </div>
    </EditorContext.Provider>
  );
}

export default App;
