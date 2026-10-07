import { FixedPointField, fixed } from 'densing';
import { MAX_CUSTOM_SIZE, MAX_DIV_PER_MM } from '../geometry/grid';

// every number of the state, once: how it is stored in a link (see schema.ts) and how it is edited in the panels. The key of a setting
// is the property of the state it is, and the name of its field in the link. A change of a range or a precision changes how a link is
// read, it needs a new STATE_VERSION (a test of schema.ts holds the fingerprint of every version)

export interface INumberSetting {
  label: string;
  unit?: 'mm' | '°';
  min: number;
  max: number;
  /** what a link keeps of it, in log10 for a log setting */
  precision: number;
  /** what a step of the panel changes it by */
  step: number;
  /** on a logarithmic slider, stored as its log10 */
  log?: boolean;
}

const number = (label: string, min: number, max: number, step: number, precision = 0.01, unit?: INumberSetting['unit']): INumberSetting => ({
  label,
  min,
  max,
  step,
  precision,
  ...(unit ? { unit } : {}),
});
const mm = (label: string, min: number, max: number, step: number, precision = 0.01) => number(label, min, max, step, precision, 'mm');
const degrees = (label: string, step: number, precision = 0.1) => number(label, -360, 360, step, precision, '°');

/** the bars */
export const BAR = {
  width: mm('Width', 5, MAX_CUSTOM_SIZE, 5),
  length: mm('Length', 5, MAX_CUSTOM_SIZE, 5),
  height: mm('Height', 2.5, 10, 0.5),
  inset: mm('Inset', -10, 10, 0.5),
  divPerMM: number('Divisions/mm', 0.25, MAX_DIV_PER_MM, 0.25),
} satisfies Record<string, INumberSetting>;

/** of every node */
export const NODE = {
  scale: { label: 'Scale', min: 1e-5, max: 1e5, step: 0.01, precision: 0.001, log: true },
  gain: number('Gain', -20, 20, 0.1, 0.001),
} satisfies Record<string, INumberSetting>;

/** how the distance to an svg shape or a text is shaped, see IProfile */
export const PROFILE = {
  inner: mm('Limit inside', 0, 50, 0.1),
  outer: mm('Limit outside', 0, 50, 0.1),
  innerBevel: mm('Bevel inside', 0, 50, 0.1),
  outerBevel: mm('Bevel outside', 0, 50, 0.1),
} satisfies Record<string, INumberSetting>;

/** where an svg shape or a text goes, see IPlacement */
export const PLACEMENT = {
  paddingX: mm('Padding x', -400, 400, 1),
  paddingZ: mm('Padding z', -400, 400, 1),
} satisfies Record<string, INumberSetting>;

/** the own numbers of the kinds of nodes */
export const KIND = {
  text: { size: mm('Size', 0.5, 200, 0.5), angle: degrees('Angle', 5) },
  svg: { width: mm('Width', 0, 400, 1, 0.1), repeat: mm('Repeat', 0, 400, 1, 0.1) },
  sine: { amplitude: mm('Amplitude', -10, 10, 0.1), period: mm('Period', 0, 200, 0.5) },
  constant: { value: number('Value', -100, 100, 0.1, 0.001) },
  /** of union, difference and intersection */
  boolean: { smooth: number('Smooth', 0, 20, 0.1) },
} satisfies Record<string, Record<string, INumberSetting>>;

/** the pattern as a whole, and the points of a base curve */
export const PATTERN = {
  rotation: degrees('Rotation', 5, 0.01),
  center: mm('Centre', -400, 400, 1),
  point: mm('Point', -400, 400, 1),
} satisfies Record<string, INumberSetting>;

/** the field of a link that holds the setting, named name */
export const denseNumber = (name: string, s: INumberSetting): FixedPointField =>
  fixed(name, s.log ? Math.log10(s.min) : s.min, s.log ? Math.log10(s.max) : s.max, s.precision);

/** the fields of a group of settings, by their key */
export const denseNumbers = (settings: Record<string, INumberSetting>): FixedPointField[] => Object.entries(settings).map(([name, s]) => denseNumber(name, s));
