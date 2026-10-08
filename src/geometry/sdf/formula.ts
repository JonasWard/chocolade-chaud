import { DistanceMethodType } from '../sdMethods';
import { IPattern, NodeKind, SdfNode, isGroup } from './tree';
import type { Layout, Wave } from './waves';

export const KIND_GLYPH: Record<NodeKind, string> = {
  union: '∪',
  difference: '∖',
  intersection: '∩',
  add: '+',
  subtract: '−',
  chain: '∘',
  method: '◇',
  svg: '✎',
  text: 'T',
  sine: '∿',
  constant: '#',
};

export const KIND_LABEL: Record<NodeKind, string> = {
  union: 'Union',
  difference: 'Difference',
  intersection: 'Intersection',
  add: 'Add',
  subtract: 'Subtract',
  chain: 'Chain',
  method: 'Method',
  svg: 'SVG',
  text: 'Text',
  sine: 'Wave',
  constant: 'Constant',
};

export const WAVE_LABEL: Record<Wave, string> = { sine: 'Sine', triangle: 'Triangle', sawtooth: 'Sawtooth' };
export const LAYOUT_LABEL: Record<Layout, string> = { rings: 'Rings', spiral: 'Spiral', petals: 'Petals', weave: 'Weave' };

export const methodLabel = (method: DistanceMethodType): string => method.slice(2);

export const formatNumber = (n: number): string => String(+n.toPrecision(3));

/** the name of a node in the tree */
export const nodeLabel = (node: SdfNode, svgs: IPattern['svgs']): string => {
  switch (node.kind) {
    case 'method':
      return methodLabel(node.method);
    case 'svg':
      return svgs[node.asset]?.name ?? 'missing svg';
    case 'text':
      return `"${node.text.length > 14 ? `${node.text.slice(0, 13)}…` : node.text}"`;
    // rings are named after their wave, the other layouts after themselves, with their count
    case 'sine':
      return node.layout === 'rings'
        ? `${WAVE_LABEL[node.wave]}(${formatNumber(node.amplitude)}, ${formatNumber(node.period)})`
        : `${LAYOUT_LABEL[node.layout]}(${formatNumber(node.amplitude)}, ${formatNumber(node.period)}, ${formatNumber(node.count)})`;
    case 'constant':
      return formatNumber(node.value);
    default:
      return KIND_LABEL[node.kind];
  }
};

/**
 * The tree as a short expression: `a@s` is a at scale s, `g×a` is a times gain g, `a ∘ b` chains b into the scale of a.
 * wrap can decorate the text of every node, to mark one
 */
export const formula = (node: SdfNode, svgs: IPattern['svgs'], wrap: (node: SdfNode, text: string) => string = (_, t) => t, nested = false): string => {
  let text: string;
  if (node.kind === 'sine') {
    // a function of the sum of its children
    const parts = node.children.map((c) => formula(c, svgs, wrap, true));
    text = `${nodeLabel(node, svgs)}(${parts.length === 0 ? '∅' : parts.join(' + ')})`;
  } else if (isGroup(node)) {
    const parts = node.children.map((c) => formula(c, svgs, wrap, true));
    text = parts.length === 0 ? '∅' : parts.join(` ${KIND_GLYPH[node.kind]} `);
    if (parts.length > 1 && (nested || node.scale !== 1 || node.gain !== 1)) text = `(${text})`;
  } else text = nodeLabel(node, svgs);

  if (node.kind !== 'constant' && node.scale !== 1) text += `@${formatNumber(node.scale)}`;
  if (node.gain !== 1) text = `${formatNumber(node.gain)}×${text}`;
  return wrap(node, text);
};
