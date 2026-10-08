import React from 'react';
import { IPattern, SdfNode } from '../geometry/sdf/tree';
import { updateNode } from '../geometry/sdf/treeOps';
import { PRESETS } from '../geometry/sdf/presets';
import { NodeAction, applyAction } from '../components/shared/pattern/actions';

/** the pattern being edited and what the editors do with it, shared by the panel, both tree editors and the scene */
export interface IPatternEditor {
  pattern: IPattern;
  setPattern: (pattern: IPattern) => void;
  /** the selected node */
  selected?: string;
  select: (id?: string) => void;
  /** replaces the node with the same id */
  onChange: (node: SdfNode) => void;
  onAction: (id: string, action: NodeAction) => void;
  /** a preset replaces the tree, undo brings it back */
  pickPreset: (index: number) => void;
  /** the group the phone editor shows */
  focus: string;
  setFocus: (id: string) => void;
  /** why the distance field of an svg or a text couldn't be made, by field key (see usePatternFields) */
  errors: Record<string, string>;
}

/** the state of the editing of a pattern, onSelect is told when another node is selected */
export const usePatternEditor = (
  pattern: IPattern,
  setPattern: (pattern: IPattern) => void,
  errors: Record<string, string>,
  onSelect?: (id?: string) => void
): IPatternEditor => {
  const [selected, setSelected] = React.useState<string>();
  const [focus, setFocus] = React.useState(pattern.root.id);

  const select = (id?: string) => {
    if (id === selected) return;
    setSelected(id);
    onSelect?.(id);
  };
  const setRoot = (root: SdfNode) => setPattern({ ...pattern, root });
  return {
    pattern,
    setPattern,
    selected,
    select,
    onChange: (node) => setRoot(updateNode(pattern.root, node.id, () => node)),
    onAction: (id, action) => {
      const { root, select: next } = applyAction(pattern, id, action);
      setRoot(root);
      if (next) select(next);
    },
    pickPreset: (index) => {
      const { root, svgs } = PRESETS[index].make();
      select(undefined);
      setFocus(root.id);
      setPattern({ ...pattern, root, svgs: { ...pattern.svgs, ...svgs } });
    },
    focus,
    setFocus,
    errors,
  };
};

export const PatternEditorContext = React.createContext<IPatternEditor | undefined>(undefined);

/** the pattern editor of the app, see PatternEditorContext */
export const usePatternEditorContext = (): IPatternEditor => {
  const editor = React.useContext(PatternEditorContext);
  if (!editor) throw new Error('the pattern editors need a PatternEditorContext');
  return editor;
};
