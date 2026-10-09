// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BarKind, IBar, defaultBar, piecePattern, withPiecePattern } from '../../src/geometry/grid';
import { IPieceOverride, differs } from '../../src/geometry/pieces';
import { IPattern, SdfNode, constantNode, defaultPattern, groupNode, textNode } from '../../src/geometry/sdf/tree';
import { insertChild, updateNode } from '../../src/geometry/sdf/treeOps';
import { IPieces, PiecesContext, Scope } from '../../src/hooks/usePieces';
import { IPatternEditor, PatternEditorContext } from '../../src/hooks/usePatternEditor';
import { Field, NumberSetting, PairSetting, binder } from '../../src/components/shared/Fields';
import { IMarks, MarksContext } from '../../src/components/shared/Marks';
import { IMode, ModeContext } from '../../src/components/shared/Mode';
import { NodeMark } from '../../src/components/shared/pattern/NodeMark';
import { NodeInspector } from '../../src/components/shared/pattern/NodeInspector';
import { PiecesFields } from '../../src/components/sections/pattern/PiecesFields';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mode = (expert: boolean): IMode => ({ expert, setExpert: () => {}, mobile: false });
const RANGE = { min: -100, max: 100 };

describe('the mark on a setting that differs on a piece', () => {
  const marked = (names: string[], reset: IMarks['reset'], children: React.ReactNode) => <MarksContext.Provider value={{ names: new Set(names), reset }}>{children}</MarksContext.Provider>;

  test('only the settings that differ have one, it brings them back to the shared ones', () => {
    const reset = vi.fn();
    const bind = binder({ size: 9, gain: 1, inner: 2, outer: 3 }, () => {});
    render(
      marked(
        ['size', 'outer', 'alignZ'],
        reset,
        <>
          <NumberSetting label='Size mm' field={RANGE} step={1} {...bind('size')} />
          <NumberSetting label='Gain' field={RANGE} step={1} {...bind('gain')} />
          <PairSetting
            label='Limits mm'
            sides={[
              { caption: 'inside', field: RANGE, step: 1, bound: bind('inner') },
              { caption: 'outside', field: RANGE, step: 1, bound: bind('outer') },
            ]}
          />
          <Field label='Position' group mark={['alignX', 'alignZ']}>
            <span>nine places</span>
          </Field>
        </>
      )
    );
    const marks = screen.getAllByRole('button', { name: 'back to shared' });
    expect(marks).toHaveLength(3);
    marks.forEach((mark) => fireEvent.click(mark));
    // of a control that sets two, only the one that differs
    expect(reset.mock.calls).toEqual([[['size']], [['outer']], [['alignZ']]]);
    // the mark comes after its control, so the caption is still the caption of the control
    expect(screen.getByLabelText('Size mm')).toHaveProperty('value', '9');
  });

  test('nothing is marked while all pieces are edited', () => {
    render(<NumberSetting label='Size mm' field={RANGE} step={1} {...binder({ size: 9 }, () => {})('size')} />);
    expect(screen.queryByRole('button', { name: 'back to shared' })).toBeNull();
  });
});

describe('a piece that is edited alone', () => {
  const text = { ...textNode('all'), size: 6 };
  const inner = groupNode('add', [text, constantNode(1)]);
  const root = groupNode('union', [inner]);
  const pattern: IPattern = { ...defaultPattern(), root };
  const editor: IPatternEditor = { pattern, setPattern: () => {}, select: () => {}, onChange: () => {}, onAction: () => {}, pickPreset: () => {}, focus: root.id, setFocus: () => {}, errors: {} };
  const alone = (override: IPieceOverride, setOverride: IPieces['setOverride'], children: React.ReactNode) => (
    <ModeContext.Provider value={mode(true)}>
      <PatternEditorContext.Provider value={editor}>
        <PiecesContext.Provider value={{ piece: 0, setPiece: () => {}, scope: 'piece', setScope: () => {}, override, setOverride }}>{children}</PiecesContext.Provider>
      </PatternEditorContext.Provider>
    </ModeContext.Provider>
  );

  test('a node whose settings differ has a dot, its inspector marks them', () => {
    const override: IPieceOverride = { nodes: { [text.id]: { values: { text: 'Jonas', size: 9 } } } };
    const setOverride = vi.fn();
    const node = { ...text, text: 'Jonas', size: 9 };
    render(
      alone(
        override,
        setOverride,
        <>
          <NodeMark id={text.id} />
          <NodeMark id={inner.id} />
          <NodeInspector node={node} pattern={pattern} onChange={() => {}} />
        </>
      )
    );
    expect(screen.getAllByRole('img', { name: 'differs on this piece' })).toHaveLength(1);
    // the text and its size, not its font or where it is
    const marks = screen.getAllByRole('button', { name: 'back to shared' });
    expect(marks).toHaveLength(2);
    fireEvent.click(marks[1]);
    expect(setOverride).toHaveBeenCalledWith({ nodes: { [text.id]: { values: { text: 'Jonas' } } } });
  });

  test('a group that is its own says so, in the tree and in its inspector, with the way back', () => {
    const own = { ...inner, children: [text] };
    const override: IPieceOverride = { nodes: { [inner.id]: { own } } };
    const setOverride = vi.fn();
    render(
      alone(
        override,
        setOverride,
        <>
          <NodeMark id={inner.id} />
          <NodeMark id={text.id} />
          <NodeInspector node={own} pattern={pattern} onChange={() => {}} />
        </>
      )
    );
    // nothing is marked below it: all of it is the piece's own
    expect(screen.queryByRole('img', { name: 'differs on this piece' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'own on this piece, back to shared' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to shared' }));
    expect(setOverride.mock.calls).toEqual([[{ nodes: {} }], [{ nodes: {} }]]);
  });
});

describe('how the pieces of a combined tablet have the pattern', () => {
  const text = { ...textNode('all'), size: 6 };
  const inner = groupNode('add', [text, constantNode(1)]);
  const combined: IBar = { ...defaultBar(), kind: BarKind.Combined, sdfSetting: { ...defaultPattern(), root: groupNode('union', [inner]) } };

  const Panel: React.FC<{ start: IBar; expert?: boolean; onBar?: (bar: IBar) => void }> = ({ start, expert = false, onBar }) => {
    const [bar, setBar] = React.useState(start);
    const [piece, setPiece] = React.useState(0);
    const [scope, setScope] = React.useState<Scope>('all');
    return (
      <ModeContext.Provider value={mode(expert)}>
        <PiecesContext.Provider value={{ piece, setPiece, scope, setScope, setOverride: () => {} }}>
          <PiecesFields
            bar={bar}
            setBar={(b) => {
              setBar(b);
              onBar?.(b);
            }}
          />
        </PiecesContext.Provider>
      </ModeContext.Provider>
    );
  };

  test('simple mode picks the mode and the piece, expert also where the pattern is on a piece', () => {
    const { unmount } = render(<Panel start={combined} />);
    expect(screen.getByRole('radio', { name: 'One design' })).toHaveProperty('ariaChecked', 'true');
    // one design has no pieces to pick and no frame to set
    expect(screen.queryByRole('button', { name: /^piece 1/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }));
    expect(screen.queryByRole('group', { name: 'Centre at' })).toBeNull();
    expect(screen.queryByLabelText('Scale')).toBeNull();
    unmount();

    render(<Panel start={{ ...combined, pieceMode: 'repeat' }} expert />);
    expect(screen.getByRole('group', { name: 'Centre at' })).toBeTruthy();
    // the reference only counts for a scale
    expect(screen.queryByLabelText('1 to 1 on')).toBeNull();
    fireEvent.change(screen.getByLabelText('Scale'), { target: { value: 'inside' } });
    fireEvent.change(screen.getByLabelText('1 to 1 on'), { target: { value: 'custom' } });
    expect(screen.getByLabelText('Size mm width')).toHaveProperty('value', '100');
  });

  test('a tap on a piece of a unique tablet edits it alone, a piece that differs has a dot and can be reset', () => {
    const bars: IBar[] = [];
    let unique: IBar = { ...combined, pieceMode: 'unique' };
    unique = withPiecePattern(unique, 2, { ...piecePattern(unique, 2), root: updateNode(unique.sdfSetting.root, text.id, (n) => ({ ...n, text: 'Jonas' }) as SdfNode) });
    render(<Panel start={unique} onBar={(b) => bars.push(b)} />);
    expect(screen.getByRole('radio', { name: 'All pieces' })).toHaveProperty('ariaChecked', 'true');
    expect(screen.getByRole('button', { name: 'piece 3, 2×1, differs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'piece 1, 4×1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset this piece' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'piece 3, 2×1, differs' }));
    expect(screen.getByRole('radio', { name: 'This piece' })).toHaveProperty('ariaChecked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Reset this piece' }));
    expect(bars.at(-1)!.overrides.some(differs)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Reset this piece' })).toBeNull();
  });

  test('leaving unique keeps the pattern of the picked piece for all of them', () => {
    const bars: IBar[] = [];
    let unique: IBar = { ...combined, pieceMode: 'unique' };
    unique = withPiecePattern(unique, 1, { ...piecePattern(unique, 1), root: insertChild(unique.sdfSetting.root, inner.id, constantNode(7)) });
    render(<Panel start={unique} onBar={(b) => bars.push(b)} />);
    fireEvent.click(screen.getByRole('button', { name: 'piece 2, 2×1, differs' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }));
    expect(bars.at(-1)).toMatchObject({ pieceMode: 'repeat', overrides: [] });
    expect(bars.at(-1)!.sdfSetting.root).toMatchObject({ children: [{ children: [{ text: 'all' }, { value: 1 }, { value: 7 }] }] });
  });
});
