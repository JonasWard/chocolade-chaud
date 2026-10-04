import { DenseField, array, bool, densing, enumeration, fixed, int, meta, object, pointer, schema, undensing, union } from 'densing';
import { DefaultGridSettings, GridType, IEditableGrid, MAX_DIV_PER_MM, MAX_UV_COUNT } from '../geometry/grid';
import { DistanceMethodType } from '../geometry/sdMethods';
import { GROUP_KINDS, IPattern, ISvgAsset, NodeKind, SdfNode, isGroup, newId, svgHash } from '../geometry/sdf/tree';

// the state of the app packed into a short url safe string with densing. Numbers are rounded to the precision of their field,
// svg sources don't fit: an svg is stored as the hash of its source (see svgKey), its source comes from the svg library

export const STATE_VERSION = 5;
// the oldest version a state can still be read from, see MIGRATIONS
const OLDEST_VERSION = 4;

const MAX_CHILDREN = 16;
const MAX_SVGS = 32;
const MAX_TEXT = 128;
const MAX_FONT = 64;
const MAX_POINTS = 64;

const NODE_KINDS: NodeKind[] = ['method', 'svg', 'text', 'sine', 'constant', ...GROUP_KINDS];

// a string as utf-16 code units, so any text fits
const chars = (name: string, max: number) => array(name, 0, max, int('char', 0, 0xffff));
const toChars = (s: string) => s.split('').map((c) => c.charCodeAt(0));
const fromChars = (codes: number[]) => String.fromCharCode(...codes);
const coordinate = (name: string) => fixed(name, -1000, 1000, 0.01);

// every node has a scale (as log10) and a gain, a node of the tree is a pointer to this union
const variant = (...fields: DenseField[]) => [fixed('scale', -5, 5, 0.001), fixed('gain', -100, 100, 0.001), ...fields];
const children = array('children', 0, MAX_CHILDREN, pointer('child', 'node'));
const smooth = fixed('smooth', 0, 100, 0.01);
// how an svg or a text distance is shaped, see IProfile. Up to version 4 it was a distance or a plateau inside and a cutoff outside
const PROFILE_V4 = [enumeration('inside', ['distance', 'constant']), fixed('depth', -100, 100, 0.01), fixed('bevel', 0, 100, 0.01), fixed('cutoff', 0, 1000, 0.01)];
const PROFILE = [
  fixed('inner', 0, 1000, 0.01),
  fixed('outer', 0, 1000, 0.01),
  bool('beveled'),
  fixed('innerBevel', 0, 1000, 0.01),
  fixed('outerBevel', 0, 1000, 0.01),
];

const size = (name: string, min: number, max: number) => fixed(name, min, max, 0.01);

/** the schema of the state of a version, see STATE_VERSION */
const stateSchema = (version: number) => {
  const profile = version >= 5 ? PROFILE : PROFILE_V4;
  const node = union('node', enumeration('kind', NODE_KINDS), {
    method: variant(enumeration('method', Object.values(DistanceMethodType))),
    svg: variant(
      int('asset', 0, MAX_SVGS - 1),
      fixed('width', 0, 1000, 0.1),
      fixed('offsetX', -1000, 1000, 0.1),
      fixed('offsetZ', -1000, 1000, 0.1),
      fixed('repeat', 0, 1000, 0.1),
      ...profile
    ),
    text: variant(
      chars('text', MAX_TEXT),
      chars('font', MAX_FONT),
      enumeration('fontSource', ['local', 'google']),
      bool('bold'),
      fixed('size', 0.5, 200, 0.01),
      // the mode of the base curve, the points are its points
      enumeration('curve', ['none', 'polyline', 'spline']),
      array('points', 0, MAX_POINTS, object('point', coordinate('x'), coordinate('z'))),
      coordinate('offsetX'),
      coordinate('offsetZ'),
      fixed('angle', -360, 360, 0.1),
      ...profile
    ),
    sine: variant(fixed('amplitude', -100, 100, 0.01), fixed('period', 0, 1000, 0.01), fixed('angle', -360, 360, 0.1)),
    constant: variant(fixed('value', -1000, 1000, 0.001)),
    union: variant(smooth, children),
    difference: variant(smooth, children),
    intersection: variant(smooth, children),
    add: variant(children),
    subtract: variant(children),
    chain: variant(children),
  });

  const state = schema(
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
    object('center', size('x', -1000, 1000), size('y', -1000, 1000), size('z', -1000, 1000)),
    size('rotation', -360, 360),
    array('svgs', 0, MAX_SVGS, int('hash', 0, 0xffffffff)),
    pointer('root', 'node')
  );
  return { schema: state, node, field: { type: 'object', name: 'state', fields: state.fields } as DenseField };
};

const SCHEMAS = new Map([...Array(STATE_VERSION - OLDEST_VERSION + 1).keys()].map((i) => [OLDEST_VERSION + i, stateSchema(OLDEST_VERSION + i)]));
const CURRENT = SCHEMAS.get(STATE_VERSION)!;
export const StateSchema = CURRENT.schema;

/** the data rounded and clamped to what the fields can hold, densing doesn't check */
const fit = (field: DenseField, value: unknown, node = CURRENT.node): unknown => {
  switch (field.type) {
    case 'fixed':
    case 'int': {
      const v = Number(value);
      const step = field.type === 'fixed' ? field.precision : 1;
      if (!Number.isFinite(v)) return field.min;
      const stepped = Math.min(Math.max(Math.round((v - field.min) / step) * step + field.min, field.min), field.max);
      // without the noise of the steps, 0.2 rather than 0.19999999999999993
      return +stepped.toFixed(Math.max(0, Math.ceil(-Math.log10(step))));
    }
    case 'enum':
      return field.options.includes(value as string) ? value : field.options[0];
    case 'bool':
      return !!value;
    case 'array': {
      const items = (value as unknown[]).slice(0, field.maxLength);
      return items.map((item) => fit(field.items, item, node));
    }
    case 'optional':
      return value == null ? null : fit(field.field, value, node);
    case 'object':
      return Object.fromEntries(field.fields.map((f) => [f.name, fit(f, (value as Record<string, unknown>)[f.name], node)]));
    case 'union': {
      const v = value as Record<string, unknown>;
      const kind = fit(field.discriminator, v[field.discriminator.name]) as string;
      return { [field.discriminator.name]: kind, ...Object.fromEntries(field.variants[kind].map((f) => [f.name, fit(f, v[f.name], node)])) };
    }
    case 'pointer':
      return fit(node, value, node);
    default:
      return value;
  }
};

const hashOf = (key: string): number => (/^h[0-9a-f]{8}$/.test(key) ? parseInt(key.slice(1), 16) : svgHash(key));
const keyOf = (hash: number): string => `h${hash.toString(16).padStart(8, '0')}`;
const colorOf = (n: number) => `#${Math.round(n).toString(16).padStart(6, '0')}`;

type NodeData = Record<string, unknown> & { kind: NodeKind; scale: number; gain: number; children?: NodeData[] };

/** the node data of a version as it is in the next one, by version */
const MIGRATIONS: Record<number, (n: NodeData) => NodeData> = {
  // a distance inside becomes no inner limit, a plateau an inner limit with a bevel, the cutoff an outer limit reached with a slope of 1,
  // which is a bevel as wide as it
  4: ({ inside, depth, bevel, cutoff, ...n }) =>
    n.kind === 'svg' || n.kind === 'text'
      ? inside === 'constant'
        ? { ...n, inner: Math.max(depth as number, 0.01), outer: cutoff, beveled: true, innerBevel: bevel, outerBevel: cutoff }
        : { ...n, inner: 0, outer: cutoff, beveled: false, innerBevel: 0, outerBevel: 0 }
      : n,
};

const migrate = (data: NodeData, from: number): NodeData => {
  let n = data;
  for (let v = from; v < STATE_VERSION; v++) n = MIGRATIONS[v](n);
  return n.children ? { ...n, children: n.children.map((c) => migrate(c, from)) } : n;
};

/** the data of the state and the version it was written in, from the newest version that reads it */
const readState = (encoded: string): Record<string, unknown> | undefined => {
  for (let version = STATE_VERSION; version >= OLDEST_VERSION; version--) {
    const { schema: s, node, field } = SCHEMAS.get(version)!;
    try {
      const data = fit(field, undensing(s, encoded), node) as Record<string, unknown>;
      if (data.version === version) return { ...data, root: migrate(data.root as NodeData, version) };
    } catch {
      // not this version
    }
  }
  return undefined;
};

const nodeData = (n: SdfNode, assets: string[]): NodeData => {
  const data = { ...n, scale: Math.log10(n.scale) } as unknown as NodeData;
  if (n.kind === 'svg') data.asset = assets.indexOf(n.asset);
  if (n.kind === 'text') Object.assign(data, { text: toChars(n.text), font: toChars(n.font), curve: n.curve?.mode ?? 'none', points: n.curve?.points ?? [] });
  if (isGroup(n)) data.children = n.children.map((c) => nodeData(c, assets));
  return data;
};

const nodeFrom = (data: NodeData, assets: string[]): SdfNode => {
  const n: Record<string, unknown> = { ...data, id: newId(), scale: 10 ** data.scale };
  if (data.kind === 'svg') n.asset = assets[data.asset as number] ?? '';
  if (data.kind === 'text') {
    n.text = fromChars(data.text as number[]);
    n.font = fromChars(data.font as number[]);
    n.curve = data.curve === 'none' ? null : { mode: data.curve, points: data.points };
    delete n.points;
  }
  if (data.children) n.children = data.children.map((c) => nodeFrom(c, assets));
  return n as unknown as SdfNode;
};

const svgNodes = (n: SdfNode): string[] => (n.kind === 'svg' ? [n.asset] : isGroup(n) ? n.children.flatMap(svgNodes) : []);

/** the state as a short url safe string */
export const encodeState = (grid: IEditableGrid): string => {
  const pattern = grid.sdfSetting;
  const assets = [...new Set([...Object.keys(pattern.svgs), ...svgNodes(pattern.root)])].slice(0, MAX_SVGS);
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
    center: pattern.center,
    rotation: pattern.rotation,
    svgs: assets.map(hashOf),
    root: nodeData(pattern.root, assets),
  };
  return densing(StateSchema, fit(CURRENT.field, data));
};

/** the state of the string, undefined when it isn't one. The svgs come from the library, the ones it doesn't have are missing */
export const decodeState = (encoded: string, library: Record<string, ISvgAsset>): IEditableGrid | undefined => {
  try {
    const read = readState(encoded);
    if (!read) return undefined;
    const data = fit(CURRENT.field, read) as ReturnType<typeof undensing>;
    const assets = (data.svgs as number[]).map(keyOf);
    const svgs: IPattern['svgs'] = Object.fromEntries(assets.flatMap((key) => (library[key] ? [[key, library[key]]] : [])));
    const sdfSetting: IPattern = { root: nodeFrom(data.root, assets), center: data.center, rotation: data.rotation, svgs };
    const colors = (data.colors as number[]).map(colorOf);
    const base = DefaultGridSettings(data.type) as IEditableGrid;
    const { cellWidth, cellLength, uCount, vCount, height, inset, amplitude, divPerMM } = data;
    const grid = { ...base, cellWidth, cellLength, uCount, vCount, height, inset, amplitude, divPerMM, displayWireframe: data.wireframe, sdfSetting };
    return grid.type === GridType.Simple ? { ...grid, colors } : { ...grid, color: colors[0] };
  } catch {
    return undefined;
  }
};
