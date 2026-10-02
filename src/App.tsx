import React from 'react';
import { Scene } from './three/Scene';
import { Export } from './Components/Export';
import { GridType } from './geometry/grid';
import { BarPanel } from './Components/BarPanel';
import { TextPanel } from './Components/TextPanel';
import { PatternPanel } from './Components/pattern/PatternPanel';
import { Section } from './Components/ui';
import { useGridMeshes } from './hooks/useGridMeshes';
import { useTextRelief } from './hooks/useTextRelief';
import { useSvgFields } from './hooks/useSvgFields';
import { defaultTextSettings } from './geometry/text/textField';
import { useMediaQuery } from './hooks/useMediaQuery';
import { MOBILE } from './Components/pattern/PatternPanel';
import { useHistory } from './hooks/useHistory';
import { loadState, saveState } from './state/persist';

const SAVE_DELAY = 300;

function App() {
  const { state: grid, set: setGrid, undo, redo, canUndo, canRedo } = useHistory(loadState);
  const { fields, errors } = useSvgFields(grid.sdfSetting.svgs);
  const text = useTextRelief(grid);
  const { result, pending, error } = useGridMeshes(grid, text, fields);
  // on a phone the pattern comes first
  const mobile = useMediaQuery(MOBILE);

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
    <div className='app'>
      <main className='viewport'>
        <Scene grid={grid} text={text} fields={fields} meshes={result} />
        <div className='toolbar'>
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
          <PatternPanel pattern={grid.sdfSetting} setPattern={(sdfSetting) => setGrid({ ...grid, sdfSetting })} svgErrors={errors} />
        </Section>
        {grid.type === GridType.Single && (
          <Section title='Text'>
            <TextPanel text={grid.text ?? defaultTextSettings} setText={(text) => setGrid({ ...grid, text })} />
          </Section>
        )}
        <Section title='Export' open={!mobile}>
          <Export meshes={pending ? undefined : result} />
        </Section>
      </aside>
    </div>
  );
}

export default App;
