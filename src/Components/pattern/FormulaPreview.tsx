import React from 'react';
import { IPattern } from '../../geometry/sdf/tree';
import { formula } from '../../geometry/sdf/formula';

const [START, END] = ['\u0001', '\u0002'];

/** the pattern as an expression, the selected node marked */
export const FormulaPreview: React.FC<{ pattern: IPattern; selected?: string }> = ({ pattern, selected }) => {
  const text = formula(pattern.root, pattern.svgs, (node, t) => (node.id === selected ? `${START}${t}${END}` : t));
  const [before, rest = ''] = text.split(START);
  const [marked, after] = rest.split(END);
  return (
    <code className='formula' title='@ scale, × gain, a ∘ b: b sets the scale of a'>
      {before}
      {marked && <mark>{marked}</mark>}
      {after}
    </code>
  );
};
