import { DistanceMethodType } from '../../geometry/sdMethods';
import { IBooleanNode, NodeKind, defaultPattern, groupNode } from '../../geometry/sdf/tree';
import { KINDS, KIND_GROUPS, kindsIn, newNode, nodeDetails } from './kinds';

test('every kind is in one section of the menus and is made as itself', () => {
  const kinds = Object.keys(KINDS) as NodeKind[];
  expect(KIND_GROUPS.flatMap(kindsIn).sort()).toEqual([...kinds].sort());
  kinds.forEach((kind) => expect(newNode(kind, defaultPattern()).kind).toBe(kind));
  expect(newNode('method', defaultPattern(), DistanceMethodType.SDTorus)).toMatchObject({ kind: 'method', method: DistanceMethodType.SDTorus });
  // the menus keep their order
  expect(KIND_GROUPS.flatMap(kindsIn)).toEqual(['method', 'svg', 'text', 'constant', 'sine', 'union', 'difference', 'intersection', 'add', 'subtract', 'chain']);
});

test('a card shows the key attributes of its node', () => {
  const svg = { ...newNode('svg', defaultPattern()), repeat: 20, gain: 2 };
  expect(nodeDetails(svg)).toBe('30 mm · ↻ 20 · ×2');
  expect(nodeDetails({ ...(groupNode('union') as IBooleanNode), smooth: 1.5 })).toBe('0 items · ~1.5');
});
