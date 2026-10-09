import { DenseField, FixedPointField, array, bool, densing, enumeration, fixed, getFieldByPath, int, object, optional, pointer, schema, undensing, union } from 'densing';
import { BarKind, IBar, defaultBar } from '../geometry/grid';
import { DEFAULT_REPEAT, FITS, IPieceOverride, IRepeat, REFERENCES, differs, settleOverride } from '../geometry/pieces';
import { DistanceMethodType } from '../geometry/sdMethods';
import { IPattern, ISvgAsset, NodeKind, SdfNode, isGroup, newId, svgHash } from '../geometry/sdf/tree';
import { AROUNDS, LAYOUTS, WAVES } from '../geometry/sdf/waves';
import { CHOCOLATE_TYPES, nearestChocolate } from '../geometry/chocolates';
import { COLUMNS, DEFAULT_PIECES, IPiece, PIECE_SIZES, ROWS, TABLET_SIZES, isLayout } from '../geometry/tablets';

// the state of the app packed into a short url safe string with densing. Numbers are rounded to the precision of their field,
// svg sources don't fit: an svg is stored as the hash of its source (see svgKey), its source comes from the svg library.
// The ranges of the numbers of the current version are the ranges of the panels too (see numberField), the older versions are frozen
// as they were written

export const STATE_VERSION = 11;
// the oldest version a state can still be read from, see MIGRATIONS
const OLDEST_VERSION = 4;

const MAX_CHILDREN = 16;
const MAX_SVGS = 32;
const MAX_TEXT = 128;
const MAX_FONT = 64;
const MAX_POINTS = 64;
const MAX_PIECES = COLUMNS * ROWS;
// the nodes of the shared tree that differ on a piece, by their place in it
const MAX_OVERRIDES = 64;
const MAX_NODE_INDEX = 4095;
const MAX_SETTINGS = 32;
// up to version 7, a grid of bars
const MAX_UV_COUNT = 10;

// in the order of version 4, a sine was a leaf up to version 7
const NODE_KINDS: NodeKind[] = ['method', 'svg', 'text', 'sine', 'constant', 'union', 'difference', 'intersection', 'add', 'subtract', 'chain'];

// a string as utf-16 code units, so any text fits
const chars = (name: string, max: number) => array(name, 0, max, int('char', 0, 0xffff));
const toChars = (s: string) => s.split('').map((c) => c.charCodeAt(0));
const fromChars = (codes: number[]) => String.fromCharCode(...codes);
// a node of the tree is the union that is the root, its children point to it
const children = array('children', 0, MAX_CHILDREN, pointer('child', 'root'));
const size = (name: string, min: number, max: number) => fixed(name, min, max, 0.01);
const svgs = array('svgs', 0, MAX_SVGS, int('hash', 0, 0xffffffff));
const placementAlign = [enumeration('alignX', ['center', 'left', 'right']), enumeration('alignZ', ['middle', 'top', 'bottom'])];
const curveModes = ['none', 'polyline', 'spline', 'smooth'];
const textOwn = [chars('text', MAX_TEXT), chars('font', MAX_FONT), enumeration('fontSource', ['local', 'google']), bool('bold')];
const withField = (state: ReturnType<typeof schema>, node: DenseField) => ({ schema: state, node, field: { type: 'object', name: 'state', fields: state.fields } as DenseField });

/** the schema of the state as it is now */
const currentSchema = () => {
  // every node has a scale (as log10) and a gain
  const variant = (...fields: DenseField[]) => [fixed('scale', -5, 5, 0.001), fixed('gain', -20, 20, 0.001), ...fields];
  const profile = [size('inner', 0, 50), size('outer', 0, 50), bool('beveled'), size('innerBevel', 0, 50), size('outerBevel', 0, 50)];
  const placement = [...placementAlign, size('paddingX', -400, 400), size('paddingZ', -400, 400)];
  const smooth = size('smooth', 0, 20);
  const node = union('root', enumeration('kind', NODE_KINDS), {
    method: variant(enumeration('method', Object.values(DistanceMethodType))),
    svg: variant(int('asset', 0, MAX_SVGS - 1), fixed('width', 0, 400, 0.1), ...placement, fixed('repeat', 0, 400, 0.1), ...profile),
    text: variant(
      ...textOwn,
      size('size', 0.5, 200),
      // the mode of the base curve, the points are its points
      enumeration('curve', curveModes),
      array('points', 0, MAX_POINTS, object('point', size('x', -400, 400), size('z', -400, 400))),
      ...placement,
      fixed('angle', -360, 360, 0.1),
      ...profile
    ),
    sine: variant(
      size('amplitude', -10, 10),
      size('period', 0, 200),
      enumeration('wave', [...WAVES]),
      enumeration('layout', [...LAYOUTS]),
      // a whole number
      fixed('count', 1, 24, 1),
      fixed('twist', -90, 90, 0.1),
      enumeration('around', [...AROUNDS]),
      size('detail', 0, 20),
      children
    ),
    constant: variant(fixed('value', -100, 100, 0.001)),
    union: variant(smooth, children),
    difference: variant(smooth, children),
    intersection: variant(smooth, children),
    add: variant(children),
    subtract: variant(children),
    chain: variant(children),
  });
  // what differs on a piece of a unique tablet: the centre and the rotation of the pattern, and nodes of the shared tree by their index
  // in it (parents first). An own node is the whole of it, of another one only the settings that are set count (see settingFields)
  const override = object(
    'piece',
    optional('center', object('centre', size('x', -400, 400), size('y', -400, 400), size('z', -400, 400))),
    optional('rotation', size('turn', -360, 360)),
    array(
      'nodes',
      0,
      MAX_OVERRIDES,
      object('override', int('index', 0, MAX_NODE_INDEX), bool('own'), array('set', 0, MAX_SETTINGS, bool('differs')), pointer('node', 'root'))
    )
  );
  // only there when the pieces of a combined tablet each have the pattern, see geometry/pieces.ts
  const repeat = optional(
    'repeat',
    object(
      'frames',
      enumeration('mode', ['repeat', 'unique']),
      enumeration('anchorX', ['center', 'left', 'right']),
      enumeration('anchorZ', ['middle', 'top', 'bottom']),
      enumeration('fit', [...FITS]),
      enumeration('reference', [...REFERENCES]),
      size('referenceWidth', 5, 400),
      size('referenceLength', 5, 400),
      array('overrides', 0, MAX_PIECES, override)
    )
  );
  const state = schema(
    int('version', 0, 255),
    enumeration('kind', Object.values(BarKind)),
    enumeration('tablet', TABLET_SIZES),
    array('pieces', 1, MAX_PIECES, object('piece', enumeration('size', PIECE_SIZES), int('u', 0, COLUMNS - 1), int('v', 0, ROWS - 1))),
    size('width', 5, 400),
    size('length', 5, 400),
    size('height', 2.5, 10),
    size('inset', -10, 10),
    size('divPerMM', 0.25, 32),
    bool('displayWireframe'),
    array('chocolates', 1, MAX_PIECES, enumeration('chocolate', CHOCOLATE_TYPES)),
    bool('sameChocolate'),
    repeat,
    object('center', size('x', -400, 400), size('y', -400, 400), size('z', -400, 400)),
    size('rotation', -360, 360),
    svgs,
    node
  );
  return withField(state, node);
};

// versions 9 and 10, as they were written: never change these. The sine of version 9 was only a sine along the distance, the pieces of
// a combined tablet had one design up to version 10

const schemaV9to10 = (version: number) => {
  // every node has a scale (as log10) and a gain
  const variant = (...fields: DenseField[]) => [fixed('scale', -5, 5, 0.001), fixed('gain', -20, 20, 0.001), ...fields];
  const profile = [size('inner', 0, 50), size('outer', 0, 50), bool('beveled'), size('innerBevel', 0, 50), size('outerBevel', 0, 50)];
  const placement = [...placementAlign, size('paddingX', -400, 400), size('paddingZ', -400, 400)];
  const smooth = size('smooth', 0, 20);
  const node = union('root', enumeration('kind', NODE_KINDS), {
    method: variant(enumeration('method', Object.values(DistanceMethodType))),
    svg: variant(int('asset', 0, MAX_SVGS - 1), fixed('width', 0, 400, 0.1), ...placement, fixed('repeat', 0, 400, 0.1), ...profile),
    text: variant(
      ...textOwn,
      size('size', 0.5, 200),
      // the mode of the base curve, the points are its points
      enumeration('curve', curveModes),
      array('points', 0, MAX_POINTS, object('point', size('x', -400, 400), size('z', -400, 400))),
      ...placement,
      fixed('angle', -360, 360, 0.1),
      ...profile
    ),
    sine:
      version >= 10
        ? variant(
            size('amplitude', -10, 10),
            size('period', 0, 200),
            enumeration('wave', [...WAVES]),
            enumeration('layout', [...LAYOUTS]),
            // a whole number
            fixed('count', 1, 24, 1),
            fixed('twist', -90, 90, 0.1),
            enumeration('around', [...AROUNDS]),
            size('detail', 0, 20),
            children
          )
        : variant(size('amplitude', -10, 10), size('period', 0, 200), children),
    constant: variant(fixed('value', -100, 100, 0.001)),
    union: variant(smooth, children),
    difference: variant(smooth, children),
    intersection: variant(smooth, children),
    add: variant(children),
    subtract: variant(children),
    chain: variant(children),
  });
  const state = schema(
    int('version', 0, 255),
    enumeration('kind', Object.values(BarKind)),
    enumeration('tablet', TABLET_SIZES),
    array('pieces', 1, MAX_PIECES, object('piece', enumeration('size', PIECE_SIZES), int('u', 0, COLUMNS - 1), int('v', 0, ROWS - 1))),
    size('width', 5, 400),
    size('length', 5, 400),
    size('height', 2.5, 10),
    size('inset', -10, 10),
    size('divPerMM', 0.25, 32),
    bool('displayWireframe'),
    array('chocolates', 1, MAX_PIECES, enumeration('chocolate', CHOCOLATE_TYPES)),
    bool('sameChocolate'),
    object('center', size('x', -400, 400), size('y', -400, 400), size('z', -400, 400)),
    size('rotation', -360, 360),
    svgs,
    node
  );
  return withField(state, node);
};

// up to version 8, as they were written: never change these

const coordinate = (name: string) => fixed(name, -1000, 1000, 0.01);
const variant = (...fields: DenseField[]) => [fixed('scale', -5, 5, 0.001), fixed('gain', -100, 100, 0.001), ...fields];
const smooth = fixed('smooth', 0, 100, 0.01);
// how an svg or a text distance is shaped, see IProfile. Up to version 4 it was a distance or a plateau inside and a cutoff outside
const PROFILE_V4 = [enumeration('inside', ['distance', 'constant']), fixed('depth', -100, 100, 0.01), fixed('bevel', 0, 100, 0.01), fixed('cutoff', 0, 1000, 0.01)];
const PROFILE_V5 = [
  fixed('inner', 0, 1000, 0.01),
  fixed('outer', 0, 1000, 0.01),
  bool('beveled'),
  fixed('innerBevel', 0, 1000, 0.01),
  fixed('outerBevel', 0, 1000, 0.01),
];

/** the schema of the state of a version up to 8 */
const legacySchema = (version: number) => {
  const profile = version >= 5 ? PROFILE_V5 : PROFILE_V4;
  // up to version 6 an svg or a text had an offset, a curved text ignored it
  const placement = [...placementAlign, coordinate('paddingX'), coordinate('paddingZ')];
  const node = union('root', enumeration('kind', NODE_KINDS), {
    method: variant(enumeration('method', Object.values(DistanceMethodType))),
    svg: variant(
      int('asset', 0, MAX_SVGS - 1),
      fixed('width', 0, 1000, 0.1),
      ...(version >= 7 ? placement : [fixed('offsetX', -1000, 1000, 0.1), fixed('offsetZ', -1000, 1000, 0.1)]),
      fixed('repeat', 0, 1000, 0.1),
      ...profile
    ),
    text: variant(
      ...textOwn,
      fixed('size', 0.5, 200, 0.01),
      // smooth curves came in version 6
      enumeration('curve', version >= 6 ? curveModes : curveModes.slice(0, 3)),
      array('points', 0, MAX_POINTS, object('point', coordinate('x'), coordinate('z'))),
      ...(version >= 7 ? placement : [coordinate('offsetX'), coordinate('offsetZ')]),
      fixed('angle', -360, 360, 0.1),
      ...profile
    ),
    // up to version 7 the distance to a sine curve, a modifier of the distance of its children since
    sine: version >= 8 ? variant(fixed('amplitude', -100, 100, 0.01), fixed('period', 0, 1000, 0.01), children) : variant(fixed('amplitude', -100, 100, 0.01), fixed('period', 0, 1000, 0.01), fixed('angle', -360, 360, 0.1)),
    constant: variant(fixed('value', -1000, 1000, 0.001)),
    union: variant(smooth, children),
    difference: variant(smooth, children),
    intersection: variant(smooth, children),
    add: variant(children),
    subtract: variant(children),
    chain: variant(children),
  });

  // up to version 7 a single bar or a grid of them, with an amplitude the pattern was multiplied by and a colour per bar
  const bars =
    version >= 8
      ? [
          enumeration('kind', Object.values(BarKind)),
          enumeration('tablet', TABLET_SIZES),
          array('pieces', 1, MAX_PIECES, object('piece', enumeration('size', PIECE_SIZES), int('u', 0, COLUMNS - 1), int('v', 0, ROWS - 1))),
          size('width', 5, 400),
          size('length', 5, 400),
          size('height', 0, 50),
          size('inset', -50, 50),
          size('divPerMM', 0.25, 32),
          bool('wireframe'),
          array('chocolates', 1, MAX_PIECES, enumeration('chocolate', CHOCOLATE_TYPES)),
          bool('sameChocolate'),
        ]
      : [
          enumeration('type', ['Single', 'Simple']),
          size('cellWidth', 5, 400),
          size('cellLength', 5, 400),
          int('uCount', 1, MAX_UV_COUNT),
          int('vCount', 1, MAX_UV_COUNT),
          size('height', 0, 50),
          size('inset', -50, 50),
          fixed('amplitude', -20, 20, 0.001),
          size('divPerMM', 0.25, 32),
          bool('wireframe'),
          array('colors', 1, 16, int('color', 0, 0xffffff)),
        ];

  const state = schema(
    int('version', 0, 255),
    ...bars,
    object('center', size('x', -1000, 1000), size('y', -1000, 1000), size('z', -1000, 1000)),
    size('rotation', -360, 360),
    svgs,
    node
  );
  return withField(state, node);
};

/** a hash of the schema of a version, it changes with any of its fields */
export const schemaFingerprint = (version: number): string | undefined => {
  const s = SCHEMAS.get(version);
  return s && svgHash(JSON.stringify(s.schema)).toString(16).padStart(8, '0');
};

const SCHEMAS = new Map([...Array(9 - OLDEST_VERSION).keys()].map((i) => [OLDEST_VERSION + i, legacySchema(OLDEST_VERSION + i)]));
SCHEMAS.set(9, schemaV9to10(9));
SCHEMAS.set(10, schemaV9to10(10));
SCHEMAS.set(STATE_VERSION, currentSchema());
const CURRENT = SCHEMAS.get(STATE_VERSION)!;
export const StateSchema = CURRENT.schema;

// densing before 0.4 can't look into the union of the nodes (and can't follow their pointers without meta): say so, rather than
// failing at the first field of a node a panel looks up
if (!getFieldByPath(StateSchema, 'root.gain')) throw new Error('densing 0.4 or later is needed to read the nodes of the state: run bun install');

/**
 * a number of the current schema by its path, e.g. 'height', 'center.x', a field of a node 'root.size' or 'root.points[].point.x' (the
 * fields of the nodes are named the same in every kind they are in). The panels take their ranges from it
 */
export const numberField = (path: string): FixedPointField => {
  const field = getFieldByPath(StateSchema, path);
  if (field?.type !== 'fixed') throw new Error(`no number at ${path} in the state`);
  return field;
};

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
  // only added a mode of curves
  5: (n) => n,
  // an offset becomes a centred placement moved by it, a curved text ignored it
  6: ({ offsetX, offsetZ, ...n }) =>
    n.kind === 'svg' || n.kind === 'text'
      ? { ...n, alignX: 'center', alignZ: 'middle', ...(n.kind === 'text' && n.curve !== 'none' ? { paddingX: 0, paddingZ: 0 } : { paddingX: offsetX, paddingZ: offsetZ }) }
      : n,
  // a sine curve has no equivalent in a modifier, it keeps its numbers and has nothing to modify
  7: (n) => (n.kind === 'sine' ? { kind: 'sine', scale: n.scale, gain: n.gain, amplitude: n.amplitude, period: n.period, children: [] } : n),
  // only the ranges changed, its numbers are clamped into them
  8: (n) => n,
  // a sine was a plain sine along the distance
  9: (n) => (n.kind === 'sine' ? { ...n, wave: 'sine', layout: 'rings', count: 5, twist: 0, around: 'centre', detail: 0 } : n),
  // only the pieces of a combined tablet got a choice, nothing of a node changed
  10: (n) => n,
};

const migrate = (data: NodeData, from: number): NodeData => {
  let n = data;
  for (let v = from; v < STATE_VERSION; v++) n = MIGRATIONS[v](n);
  return n.children ? { ...n, children: n.children.map((c) => migrate(c, from)) } : n;
};

/**
 * the bars of a state of an older version as they are now, the fields of the older version that are gone are left out by fit. Up to
 * version 7 a single bar or one bar of a grid becomes a custom bar with its top where it was (the size is of the base now), the
 * amplitude is in the gain of the pattern, the colour the chocolate that looks most like it
 */
const upgradeBars = (data: Record<string, unknown>, version: number): Record<string, unknown> => {
  if (version >= STATE_VERSION) return data;
  // the wireframe got its name in version 9
  const upgraded = { ...data, version: STATE_VERSION, ...(version < 9 && { displayWireframe: data.wireframe }) };
  if (version >= 8) return upgraded;
  const { cellWidth, cellLength, inset, amplitude, colors } = data as Record<string, number> & { colors: number[] };
  const root = data.root as NodeData;
  return {
    ...upgraded,
    kind: BarKind.Custom,
    tablet: '6x2',
    pieces: DEFAULT_PIECES,
    width: cellWidth - 2 * inset,
    length: cellLength - 2 * inset,
    chocolates: [nearestChocolate(colorOf(colors[0]))],
    sameChocolate: true,
    root: { ...root, gain: root.gain * amplitude },
  };
};

/** the data of the state as it is now, from the newest version that reads it */
const readState = (encoded: string): Record<string, unknown> | undefined => {
  for (let version = STATE_VERSION; version >= OLDEST_VERSION; version--) {
    const { schema: s, node, field } = SCHEMAS.get(version)!;
    try {
      const data = fit(field, undensing(s, encoded), node) as Record<string, unknown>;
      if (data.version === version) return upgradeBars({ ...data, root: migrate(data.root as NodeData, version) }, version);
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
  // where it goes is filled in by placePattern
  if (data.kind === 'svg' || data.kind === 'text') Object.assign(n, { offsetX: 0, offsetZ: 0 });
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

/** the numbers of the bars, stored as they are */
const BAR_NUMBERS = ['width', 'length', 'height', 'inset', 'divPerMM'] as const;
const barNumbers = (data: Pick<IBar, (typeof BAR_NUMBERS)[number]>) => Object.fromEntries(BAR_NUMBERS.map((key) => [key, data[key]]));

const svgNodes = (n: SdfNode): string[] => (n.kind === 'svg' ? [n.asset] : isGroup(n) ? n.children.flatMap(svgNodes) : []);

/** the nodes of a tree, parents first: where a node is in it is how what differs on a piece refers to it */
const inOrder = (n: SdfNode): SdfNode[] => [n, ...(isGroup(n) ? n.children.flatMap(inOrder) : [])];

/** the svg shapes of what differs on a piece */
const overrideSvgs = (override?: IPieceOverride): string[] =>
  Object.values(override?.nodes ?? {}).flatMap((o) => ('own' in o ? svgNodes(o.own) : typeof o.values.asset === 'string' ? [o.values.asset] : []));

/**
 * the fields of a kind of node that are a setting of it, in the order of the schema: which of them differ on a piece is written as a
 * list of that order. The curve of a text is two of them, its mode and its points
 */
const settingFields = (kind: NodeKind): DenseField[] => (CURRENT.node.type === 'union' ? CURRENT.node.variants[kind] : []).filter((f) => f.name !== 'children');
const settingOf = (field: DenseField) => (field.name === 'points' ? 'curve' : field.name);

const overrideData = (pattern: IPattern, override: IPieceOverride | undefined, assets: string[]) => {
  const shared = inOrder(pattern.root);
  const nodes = Object.entries(override?.nodes ?? {})
    .flatMap(([id, o]) => {
      const index = shared.findIndex((n) => n.id === id);
      if (index < 0) return [];
      if ('own' in o) return [{ index, own: true, set: [], node: nodeData(o.own, assets) }];
      // only the settings that differ are read back: the texts and the points of the others are left out
      const fields = settingFields(shared[index].kind);
      const set = fields.map((f) => settingOf(f) in o.values);
      const node = nodeData({ ...shared[index], ...o.values, ...(isGroup(shared[index]) ? { children: [] } : {}) } as SdfNode, assets);
      fields.forEach((f, i) => !set[i] && f.type === 'array' && (node[f.name] = []));
      return [{ index, own: false, set: set.slice(0, set.lastIndexOf(true) + 1), node }];
    })
    .sort((a, b) => a.index - b.index);
  return { center: override?.center ?? null, rotation: override?.rotation ?? null, nodes };
};

type OverrideData = { center: IPattern['center'] | null; rotation: number | null; nodes: { index: number; own: boolean; set: boolean[]; node: NodeData }[] };

const overrideFrom = (pattern: IPattern, data: OverrideData, assets: string[]): IPieceOverride | undefined => {
  const shared = inOrder(pattern.root);
  const nodes: IPieceOverride['nodes'] = {};
  for (const { index, own, set, node } of data.nodes) {
    const target = shared[index];
    if (!target) continue;
    // an own node stands where the shared one is
    const read = { ...nodeFrom(node, assets), id: target.id } as SdfNode;
    if (own) nodes[target.id] = { own: read };
    else if (read.kind === target.kind) {
      const names = new Set(settingFields(target.kind).flatMap((f, i) => (set[i] ? [settingOf(f)] : [])));
      nodes[target.id] = { values: Object.fromEntries([...names].map((name) => [name, (read as unknown as Record<string, unknown>)[name]])) };
    }
  }
  const override = settleOverride(pattern, { ...(data.center ? { center: data.center } : {}), ...(data.rotation === null ? {} : { rotation: data.rotation }), nodes });
  return differs(override) ? override : undefined;
};

/** the state as a short url safe string */
export const encodeState = (bar: IBar): string => {
  const pattern = bar.sdfSetting;
  const overrides = bar.pieceMode === 'unique' ? bar.pieces.map((_, i) => bar.overrides[i]) : [];
  const assets = [...new Set([...Object.keys(pattern.svgs), ...svgNodes(pattern.root), ...overrides.flatMap(overrideSvgs)])].slice(0, MAX_SVGS);
  // as many as there are pieces that differ
  const last = overrides.reduce((n, o, i) => (differs(o) ? i + 1 : n), 0);
  const data = {
    version: STATE_VERSION,
    kind: bar.kind,
    tablet: bar.tablet,
    pieces: bar.pieces,
    ...barNumbers(bar),
    displayWireframe: bar.displayWireframe,
    // only as many as it needs
    chocolates: bar.sameChocolate ? bar.chocolates.slice(0, 1) : bar.chocolates.slice(0, Math.max(bar.pieces.length, 1)),
    sameChocolate: bar.sameChocolate,
    repeat: bar.pieceMode === 'one' ? null : { mode: bar.pieceMode, ...bar.repeat, overrides: overrides.slice(0, last).map((o) => overrideData(pattern, o, assets)) },
    center: pattern.center,
    rotation: pattern.rotation,
    svgs: assets.map(hashOf),
    root: nodeData(pattern.root, assets),
  };
  return densing(StateSchema, fit(CURRENT.field, data));
};

/** the state of the string, undefined when it isn't one. The svgs come from the library, the ones it doesn't have are missing */
export const decodeState = (encoded: string, library: Record<string, ISvgAsset>): IBar | undefined => {
  try {
    const read = readState(encoded);
    if (!read) return undefined;
    const data = fit(CURRENT.field, read) as ReturnType<typeof undensing>;
    const assets = (data.svgs as number[]).map(keyOf);
    const svgs: IPattern['svgs'] = Object.fromEntries(assets.flatMap((key) => (library[key] ? [[key, library[key]]] : [])));
    const sdfSetting: IPattern = { root: nodeFrom(data.root, assets), center: data.center, rotation: data.rotation, svgs };
    const { kind, tablet, displayWireframe, chocolates, sameChocolate } = data;
    // pieces that don't fill the tablet are not a layout
    const pieces = isLayout(data.pieces as IPiece[]) ? data.pieces : defaultBar().pieces;
    const frames = data.repeat as ({ mode: 'repeat' | 'unique'; overrides: OverrideData[] } & IRepeat) | null;
    const { anchorX, anchorZ, fit: scale, reference, referenceWidth, referenceLength } = frames ?? DEFAULT_REPEAT;
    return {
      ...defaultBar(),
      kind,
      tablet,
      pieces,
      ...barNumbers(data),
      displayWireframe,
      chocolates,
      sameChocolate,
      sdfSetting,
      pieceMode: frames?.mode ?? 'one',
      repeat: { anchorX, anchorZ, fit: scale, reference, referenceWidth, referenceLength },
      overrides: frames?.mode === 'unique' ? frames.overrides.map((o) => overrideFrom(sdfSetting, o, assets)) : [],
    };
  } catch {
    return undefined;
  }
};
