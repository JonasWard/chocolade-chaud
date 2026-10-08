import { DenseField, FixedPointField, array, bool, densing, enumeration, fixed, getFieldByPath, int, object, pointer, schema, undensing, union } from 'densing';
import { BarKind, IBar, defaultBar } from '../geometry/grid';
import { DistanceMethodType } from '../geometry/sdMethods';
import { IPattern, ISvgAsset, NodeKind, SdfNode, isGroup, newId, svgHash } from '../geometry/sdf/tree';
import { CHOCOLATE_TYPES, nearestChocolate } from '../geometry/chocolates';
import { COLUMNS, DEFAULT_PIECES, IPiece, PIECE_SIZES, ROWS, TABLET_SIZES, isLayout } from '../geometry/tablets';

// the state of the app packed into a short url safe string with densing. Numbers are rounded to the precision of their field,
// svg sources don't fit: an svg is stored as the hash of its source (see svgKey), its source comes from the svg library.
// The ranges of the numbers of the current version are the ranges of the panels too (see numberField), the older versions are frozen
// as they were written

export const STATE_VERSION = 9;
// the oldest version a state can still be read from, see MIGRATIONS
const OLDEST_VERSION = 4;

const MAX_CHILDREN = 16;
const MAX_SVGS = 32;
const MAX_TEXT = 128;
const MAX_FONT = 64;
const MAX_POINTS = 64;
const MAX_PIECES = COLUMNS * ROWS;
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
    sine: variant(size('amplitude', -10, 10), size('period', 0, 200), children),
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

const SCHEMAS = new Map([...Array(STATE_VERSION - OLDEST_VERSION).keys()].map((i) => [OLDEST_VERSION + i, legacySchema(OLDEST_VERSION + i)]));
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
  const upgraded = { ...data, version: STATE_VERSION, displayWireframe: data.wireframe };
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

/** the state as a short url safe string */
export const encodeState = (bar: IBar): string => {
  const pattern = bar.sdfSetting;
  const assets = [...new Set([...Object.keys(pattern.svgs), ...svgNodes(pattern.root)])].slice(0, MAX_SVGS);
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
    return { ...defaultBar(), kind, tablet, pieces, ...barNumbers(data), displayWireframe, chocolates, sameChocolate, sdfSetting };
  } catch {
    return undefined;
  }
};
