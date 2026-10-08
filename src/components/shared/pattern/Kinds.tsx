import React from 'react';
import { DistanceMethodType } from '../../../geometry/sdMethods';
import { GroupKind, IPattern, NodeKind, SdfNode, constantNode, groupNode, methodNode, sineNode, svgNode, textNode } from '../../../geometry/sdf/tree';
import { formatNumber } from '../../../geometry/sdf/formula';
import { BooleanInspector, ConstantInspector, IInspectorProps, SineInspector, SvgInspector, TextInspector } from './Inspectors';

// everything the editors know about a kind of node, in one place: where it is in the menus, its icon, its hint, what its card shows
// and its settings. Its name and glyph are in geometry/sdf/formula.ts, it is made and changed into in geometry/sdf/tree(Ops).ts

/** the sections of the menus that pick a kind, in their order */
export const KIND_GROUPS = ['Methods', 'Shapes', 'Modifiers', 'Booleans', 'Arithmetic', 'Chain'] as const;
export type KindGroup = (typeof KIND_GROUPS)[number];

interface IKind<N extends SdfNode> {
  group: KindGroup;
  /** made new, in the pattern (an svg node shows its first svg). A method is made as the method given */
  make: (pattern: IPattern, method: DistanceMethodType) => N;
  /** its line icon on a 24 x 24 grid, a method has one per method (see icons.tsx) */
  icon?: React.ReactNode;
  hint?: string;
  /** the key attributes of a node of the kind, for a closed card */
  details?: (node: N) => (string | false | undefined)[];
  /** its own settings, before the scale and gain every node has */
  Inspector?: React.FC<IInspectorProps<N>>;
}

type Kinds = { [K in NodeKind]: IKind<Extract<SdfNode, { kind: K }>> };

export const firstAsset = (pattern: IPattern): string => Object.keys(pattern.svgs)[0] ?? '';

const f = formatNumber;
const items = (node: { children: SdfNode[] }) => `${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`;
const group =
  <K extends GroupKind>(kind: K) =>
  () =>
    groupNode(kind) as Extract<SdfNode, { kind: K }>;
const smoothDetails = (node: { smooth: number; children: SdfNode[] }) => [items(node), node.smooth > 0 && `~${f(node.smooth)}`];
const FIRST_MINUS_OTHERS = 'The first child minus the others.';

export const KINDS: Kinds = {
  method: { group: 'Methods', make: (_, method) => methodNode(method) },
  svg: {
    group: 'Shapes',
    make: (pattern) => svgNode(firstAsset(pattern)),
    icon: <rect x='4' y='4' width='16' height='16' rx='2' strokeDasharray='3 3' />,
    hint: 'Distance in mm to the shape, placed against an edge of the bars or centred. Repeat tiles it, 0 shows it once. The distance stops at its limits (0 is none).',
    details: (node) => [`${f(node.width)} mm`, node.repeat > 0 && `↻ ${f(node.repeat)}`],
    Inspector: SvgInspector,
  },
  text: {
    group: 'Shapes',
    make: () => textNode(),
    icon: <path d='M5 6V4.5h14V6M12 4.5v15M9 19.5h6' />,
    hint: 'Distance in mm to the outline of the letters, negative inside. The distance stops at its limits (0 is none), an inside limit gives flat letters. In mm on the bars.',
    details: (node) => [node.font, `${f(node.size)} mm`, node.curve?.mode],
    Inspector: TextInspector,
  },
  constant: { group: 'Shapes', make: () => constantNode(), icon: <path d='M10 4L8 20M16 4l-2 16M4.5 9h15M4 15h15' />, Inspector: ConstantInspector },
  sine: {
    group: 'Modifiers',
    make: () => sineNode(),
    icon: <path d='M2 12c2.5-8 5.5-8 8 0s5.5 8 8 0c1.2-4 2.7-6 4-6' />,
    hint: 'Ripples along the distance of what it holds: amplitude × sin(2π · distance / period), in mm. Wrap a text or a shape to echo its outline.',
    // amplitude and period are in its name
    details: (node) => [items(node)],
    Inspector: SineInspector,
  },
  union: { group: 'Booleans', make: group('union'), icon: <path d='M6 4.5v7.5a6 6 0 0 0 12 0V4.5' />, details: smoothDetails, Inspector: BooleanInspector },
  difference: {
    group: 'Booleans',
    make: group('difference'),
    // a disc with the second one cut out of it
    icon: (
      <>
        <path d='M13.5 6.2a7 7 0 1 0 0 11.6 6 6 0 0 1 0-11.6z' />
        <circle cx='16' cy='12' r='6' strokeDasharray='2 2.5' />
      </>
    ),
    hint: FIRST_MINUS_OTHERS,
    details: smoothDetails,
    Inspector: BooleanInspector,
  },
  intersection: { group: 'Booleans', make: group('intersection'), icon: <path d='M6 19.5V12a6 6 0 0 1 12 0v7.5' />, details: smoothDetails, Inspector: BooleanInspector },
  add: { group: 'Arithmetic', make: group('add'), icon: <path d='M12 5v14M5 12h14' />, details: (node) => [items(node)] },
  subtract: { group: 'Arithmetic', make: group('subtract'), icon: <path d='M5 12h14' />, hint: FIRST_MINUS_OTHERS, details: (node) => [items(node)] },
  chain: {
    group: 'Chain',
    make: group('chain'),
    // linked rings
    icon: (
      <>
        <rect x='2' y='8' width='12' height='8' rx='4' />
        <rect x='10' y='8' width='12' height='8' rx='4' />
      </>
    ),
    hint: 'The last child is evaluated first, its output is the scale of the child above it.',
    details: (node) => [items(node)],
  },
};

/** the entry of the kind of the node, typed for it */
export const kindOf = <N extends SdfNode>(node: N): IKind<N> => KINDS[node.kind] as unknown as IKind<N>;

/** a new node of the kind, in the pattern */
export const newNode = (kind: NodeKind, pattern: IPattern, method = DistanceMethodType.SDGyroid): SdfNode => KINDS[kind].make(pattern, method);

/** the kinds of a section of the menus, in their order */
export const kindsIn = (section: KindGroup): NodeKind[] => (Object.keys(KINDS) as NodeKind[]).filter((k) => KINDS[k].group === section);

/** the key attributes of a node in a few words, for a closed card */
export const nodeDetails = (node: SdfNode): string =>
  [...(kindOf(node).details?.(node) ?? []), node.kind !== 'constant' && node.scale !== 1 && `@${f(node.scale)}`, node.gain !== 1 && `×${f(node.gain)}`]
    .filter(Boolean)
    .join(' · ');

/** the scale and smooth radius of a node, next to its name in the tree */
export const nodeSummary = (node: SdfNode): string =>
  [node.kind !== 'constant' && node.scale !== 1 && `@${f(node.scale)}`, 'smooth' in node && node.smooth > 0 && `~${f(node.smooth)}`].filter(Boolean).join(' ');
