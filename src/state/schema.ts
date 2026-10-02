import { DenseField, array, bool, densing, enumeration, fixed, int, meta, object, optional, pointer, schema, undensing, union } from 'densing';
import { DefaultGridSettings, GridType, IEditableGrid, MAX_DIV_PER_MM, MAX_UV_COUNT } from '../geometry/grid';
import { DistanceMethodType } from '../geometry/sdMethods';
import { GROUP_KINDS, IPattern, ISvgAsset, NodeKind, SdfNode, isGroup, newId, svgHash } from '../geometry/sdf/tree';
import { FONT_FAMILIES, ITextSettings } from '../geometry/text/textField';

// the state of the app packed into a short url safe string with densing. Numbers are rounded to the precision of their field,
// svg sources don't fit: an svg is stored as the hash of its source (see svgKey), its source comes from the svg library

export const STATE_VERSION = 1;

const MAX_CHILDREN = 16;
const MAX_SVGS = 32;
const MAX_TEXT = 64;

const NODE_KINDS: NodeKind[] = ['method', 'svg', 'sine', 'constant', ...GROUP_KINDS];

// every node has a scale (as log10) and a gain, a node of the tree is a pointer to this union
const variant = (...fields: DenseField[]) => [fixed('scale', -5, 5, 0.001), fixed('gain', -100, 100, 0.001), ...fields];
const children = array('children', 0, MAX_CHILDREN, pointer('child', 'node'));
const smooth = fixed('smooth', 0, 100, 0.01);
const node = union('node', enumeration('kind', NODE_KINDS), {
  method: variant(enumeration('method', Object.values(DistanceMethodType))),
  svg: variant(int('asset', 0, MAX_SVGS - 1), fixed('width', 0, 1000, 0.1), fixed('offsetX', -1000, 1000, 0.1), fixed('offsetZ', -1000, 1000, 0.1), fixed('repeat', 0, 1000, 0.1)),
  sine: variant(fixed('amplitude', -100, 100, 0.01), fixed('period', 0, 1000, 0.01), fixed('angle', -360, 360, 0.1)),
  constant: variant(fixed('value', -1000, 1000, 0.001)),
  union: variant(smooth, children),
  difference: variant(smooth, children),
  intersection: variant(smooth, children),
  add: variant(children),
  subtract: variant(children),
  chain: variant(children),
});

const size = (name: string, min: number, max: number) => fixed(name, min, max, 0.01);

export const StateSchema = schema(
  meta(node),
  int('version', 0, 255),
  enumeration('type', [GridType.Single, GridType.Simple]),
  size('cellWidth', 5, 400),
  size('cellLength', 5, 400),
  int('uCount', 1, MAX_UV_COUNT),
  int('vCount', 1, MAX_UV_COUNT),
  size('height', 0, 50),
  size('inset', -50, 50),
  fixed('amplitude', -20, 20, 0.001),
  size('divPerMM', 0.25, MAX_DIV_PER_MM),
  bool('wireframe'),
  array('colors', 1, 16, int('color', 0, 0xffffff)),
  optional(
    'text',
    object(
      'textSettings',
      array('chars', 0, MAX_TEXT, int('char', 0, 0xffff)),
      enumeration('fontFamily', FONT_FAMILIES),
      fixed('size', 1, 200, 0.1),
      size('depth', -5, 5),
      size('bevelWidth', 0, 10),
      size('patternFade', 0, 1),
      fixed('offsetX', -500, 500, 0.1),
      fixed('offsetZ', -500, 500, 0.1)
    )
  ),
  object('center', size('x', -1000, 1000), size('y', -1000, 1000), size('z', -1000, 1000)),
  size('rotation', -360, 360),
  array('svgs', 0, MAX_SVGS, int('hash', 0, 0xffffffff)),
  pointer('root', 'node')
);

/** the data rounded and clamped to what the fields can hold, densing doesn't check */
const fit = (field: DenseField, value: unknown): unknown => {
  switch (field.type) {
    case 'fixed':
    case 'int': {
      const v = Number(value);
      const step = field.type === 'fixed' ? field.precision : 1;
      return Number.isFinite(v) ? Math.min(Math.max(Math.round((v - field.min) / step) * step + field.min, field.min), field.max) : field.min;
    }
    case 'enum':
      return field.options.includes(value as string) ? value : field.options[0];
    case 'bool':
      return !!value;
    case 'array': {
      const items = (value as unknown[]).slice(0, field.maxLength);
      return items.map((item) => fit(field.items, item));
    }
    case 'optional':
      return value == null ? null : fit(field.field, value);
    case 'object':
      return Object.fromEntries(field.fields.map((f) => [f.name, fit(f, (value as Record<string, unknown>)[f.name])]));
    case 'union': {
      const v = value as Record<string, unknown>;
      const kind = fit(field.discriminator, v[field.discriminator.name]) as string;
      return { [field.discriminator.name]: kind, ...Object.fromEntries(field.variants[kind].map((f) => [f.name, fit(f, v[f.name])])) };
    }
    case 'pointer':
      return fit(node, value);
    default:
      return value;
  }
};

const hashOf = (key: string): number => (/^h[0-9a-f]{8}$/.test(key) ? parseInt(key.slice(1), 16) : svgHash(key));
const keyOf = (hash: number): string => `h${hash.toString(16).padStart(8, '0')}`;
const colorOf = (n: number) => `#${Math.round(n).toString(16).padStart(6, '0')}`;

type NodeData = Record<string, unknown> & { kind: NodeKind; scale: number; gain: number; children?: NodeData[] };

const nodeData = (n: SdfNode, assets: string[]): NodeData => {
  const data = { ...n, scale: Math.log10(n.scale) } as unknown as NodeData;
  if (n.kind === 'svg') data.asset = assets.indexOf(n.asset);
  if (isGroup(n)) data.children = n.children.map((c) => nodeData(c, assets));
  return data;
};

const nodeFrom = (data: NodeData, assets: string[]): SdfNode => {
  const n: Record<string, unknown> = { ...data, id: newId(), scale: 10 ** data.scale };
  if (data.kind === 'svg') n.asset = assets[data.asset as number] ?? '';
  if (data.children) n.children = data.children.map((c) => nodeFrom(c, assets));
  return n as unknown as SdfNode;
};

const svgNodes = (n: SdfNode): string[] => (n.kind === 'svg' ? [n.asset] : isGroup(n) ? n.children.flatMap(svgNodes) : []);

/** the state as a short url safe string */
export const encodeState = (grid: IEditableGrid): string => {
  const pattern = grid.sdfSetting;
  const assets = [...new Set([...Object.keys(pattern.svgs), ...svgNodes(pattern.root)])].slice(0, MAX_SVGS);
  const text = grid.type === GridType.Single && grid.text?.text ? grid.text : undefined;
  const data = {
    version: STATE_VERSION,
    type: grid.type,
    cellWidth: grid.cellWidth,
    cellLength: grid.cellLength,
    uCount: grid.uCount,
    vCount: grid.vCount,
    height: grid.height,
    inset: grid.inset,
    amplitude: grid.amplitude,
    divPerMM: grid.divPerMM,
    wireframe: grid.displayWireframe,
    colors: (grid.type === GridType.Single ? [grid.color] : grid.colors).map((c) => parseInt(c.slice(1), 16)),
    // utf-16 code units, so any text fits
    text: text && { ...text, chars: text.text.split('').map((c) => c.charCodeAt(0)) },
    center: pattern.center,
    rotation: pattern.rotation,
    svgs: assets.map(hashOf),
    root: nodeData(pattern.root, assets),
  };
  return densing(StateSchema, fit({ type: 'object', name: 'state', fields: StateSchema.fields }, data));
};

/** the state of the string, undefined when it isn't one. The svgs come from the library, the ones it doesn't have are missing */
export const decodeState = (encoded: string, library: Record<string, ISvgAsset>): IEditableGrid | undefined => {
  try {
    const data = undensing(StateSchema, encoded);
    if (data.version !== STATE_VERSION) return undefined;
    const assets = (data.svgs as number[]).map(keyOf);
    const svgs: IPattern['svgs'] = Object.fromEntries(assets.flatMap((key) => (library[key] ? [[key, library[key]]] : [])));
    const sdfSetting: IPattern = { root: nodeFrom(data.root, assets), center: data.center, rotation: data.rotation, svgs };
    const colors = (data.colors as number[]).map(colorOf);
    const base = DefaultGridSettings(data.type) as IEditableGrid;
    const { cellWidth, cellLength, uCount, vCount, height, inset, amplitude, divPerMM } = data;
    const grid = { ...base, cellWidth, cellLength, uCount, vCount, height, inset, amplitude, divPerMM, displayWireframe: data.wireframe, sdfSetting };
    if (grid.type === GridType.Simple) return { ...grid, colors };
    const { chars, ...text } = data.text ?? {};
    return { ...grid, color: colors[0], text: data.text ? ({ ...text, text: String.fromCharCode(...chars) } as ITextSettings) : undefined };
  } catch {
    return undefined;
  }
};
