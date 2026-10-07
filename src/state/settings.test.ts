import { DenseField } from 'densing';
import { StateSchema } from './schema';
import { BAR, INumberSetting, KIND, NODE, PATTERN, PLACEMENT, PROFILE } from './settings';

const named = (fields: DenseField[], name: string) => fields.find((f) => f.name === name);
const node = StateSchema.meta!.definitions.node as Extract<DenseField, { type: 'union' }>;
/** a field of the state, or of the variant of a kind of node */
const stored = (name: string, kind?: string) => named(kind ? node.variants[kind] : StateSchema.fields, name);

const expectStored = (field: DenseField | undefined, name: string, s: INumberSetting) => {
  const [min, max] = s.log ? [Math.log10(s.min), Math.log10(s.max)] : [s.min, s.max];
  expect([name, field]).toEqual([name, expect.objectContaining({ type: 'fixed', name, min, max, precision: s.precision })]);
};
const expectAll = (settings: Record<string, INumberSetting>, kinds?: string[]) =>
  Object.entries(settings).forEach(([name, s]) => (kinds ?? [undefined]).forEach((kind) => expectStored(stored(name, kind), name, s)));

test('every setting is stored with its range and precision, under its name', () => {
  expectAll(BAR);
  expectAll(NODE, Object.keys(node.variants));
  expectAll(PROFILE, ['svg', 'text']);
  expectAll(PLACEMENT, ['svg', 'text']);
  expectAll(KIND.text, ['text']);
  expectAll(KIND.svg, ['svg']);
  expectAll(KIND.sine, ['sine']);
  expectAll(KIND.constant, ['constant']);
  expectAll(KIND.boolean, ['union', 'difference', 'intersection']);
  expectStored(stored('rotation'), 'rotation', PATTERN.rotation);
  const center = stored('center') as Extract<DenseField, { type: 'object' }>;
  ['x', 'y', 'z'].forEach((axis) => expectStored(named(center.fields, axis), axis, PATTERN.center));
  const points = stored('points', 'text') as Extract<DenseField, { type: 'array' }>;
  ['x', 'z'].forEach((axis) => expectStored(named((points.items as Extract<DenseField, { type: 'object' }>).fields, axis), axis, PATTERN.point));
});

test('a step of the panel is within the range and no finer than what a link keeps', () => {
  const all = [BAR, NODE, PROFILE, PLACEMENT, ...Object.values(KIND), PATTERN].flatMap((g) => Object.entries(g as Record<string, INumberSetting>));
  all.forEach(([name, s]) => {
    expect([name, s.min < s.max]).toEqual([name, true]);
    if (!s.log) expect([name, s.step >= s.precision]).toEqual([name, true]);
  });
});
