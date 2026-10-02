import { DistanceMethodType } from '../sdMethods';
import { IPattern, NodeKind, SdfNode, isGroup } from './tree';

export const KIND_GLYPH: Record<NodeKind, string> = {
  union: '∪',
  difference: '∖',
  intersection: '∩',
  add: '+',
  subtract: '−',
  chain: '∘',
  method: '◇',
  svg: '✎',
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
  constant: 'Constant',
};

export const methodLabel = (method: DistanceMethodType): string => method.slice(2);

export const formatNumber = (n: number): string => String(+n.toPrecision(3));

/** the name of a node in the tree */
export const nodeLabel = (node: SdfNode, svgs: IPattern['svgs']): string => {
  switch (node.kind) {
    case 'method':
      return methodLabel(node.method);
    case 'svg':
      return svgs[node.asset]?.name ?? 'missing svg';
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
  if (isGroup(node)) {
    const parts = node.children.map((c) => formula(c, svgs, wrap, true));
    text = parts.length === 0 ? '∅' : parts.join(` ${KIND_GLYPH[node.kind]} `);
    if (parts.length > 1 && (nested || node.scale !== 1 || node.gain !== 1)) text = `(${text})`;
  } else text = nodeLabel(node, svgs);

  if (node.kind !== 'constant' && node.scale !== 1) text += `@${formatNumber(node.scale)}`;
  if (node.gain !== 1) text = `${formatNumber(node.gain)}×${text}`;
  return wrap(node, text);
};
