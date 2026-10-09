import React from 'react';
import type { FixedPointField } from 'densing';
import { MarkNames, Marked } from './Marks';

// the fields of the panels: a caption and its control, numbers and selects, plain html styled by ui.css

/**
 * a caption and its control. A group of buttons is a group, not a label: a label passes a click on its caption to its first button.
 * mark is the names of the settings it sets, for the mark it gets when one differs on a piece (see Marks.tsx)
 */
export const Field: React.FC<{ label: string; group?: boolean; mark?: MarkNames; children: React.ReactNode }> = ({ label, group, mark, children }) => {
  const id = React.useId();
  return group ? (
    <div className='field' role='group' aria-labelledby={id}>
      <span id={id}>{label}</span>
      <Marked names={mark}>{children}</Marked>
    </div>
  ) : (
    <label className='field'>
      <span>{label}</span>
      <Marked names={mark}>{children}</Marked>
    </label>
  );
};

/** the range of a number, a field of the state (see numberField in state/schema.ts) has it */
export type Range = Pick<FixedPointField, 'min' | 'max'>;

/** the value of a property of an object and how to change it, see binder */
export interface IBound<V> {
  value: V;
  onChange: (value: V) => void;
  /** the name of the setting, see Field */
  name?: MarkNames;
}

/** the properties of an object as values a control can show and change, a change is the object with it changed */
export const binder =
  <T extends object>(object: T, onChange: (object: T) => void) =>
  <K extends keyof T>(key: K): IBound<T[K]> => ({ value: object[key], onChange: (value) => onChange({ ...object, [key]: value }), name: String(key) });

/**
 * keeps what is typed until it is a number in range, so typing "-" or "0." doesn't reset the input. A field gives its range
 */
export const NumberField: React.FC<{ value: number; onChange: (v: number) => void; field?: Range; step?: number | 'any'; min?: number; max?: number; label?: string }> = ({
  value,
  onChange,
  field,
  step = 'any',
  min = field?.min ?? -Infinity,
  max = field?.max ?? Infinity,
  label,
}) => {
  const [text, setText] = React.useState(String(value));
  const [shown, setShown] = React.useState(value);
  if (shown !== value) {
    setShown(value);
    if (Number(text) !== value) setText(String(value));
  }

  return (
    <input
      type='number'
      inputMode='decimal'
      aria-label={label}
      value={text}
      step={step}
      min={Number.isFinite(min) ? min : undefined}
      max={Number.isFinite(max) ? max : undefined}
      onChange={(e) => {
        setText(e.target.value);
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
      }}
      onBlur={() => setText(String(value))}
    />
  );
};

/** a number of the state with its caption, in the range of its field. A log one is on a slider, its field holds its log10 */
export const NumberSetting: React.FC<IBound<number> & { label: string; field: Range; step: number; log?: boolean }> = ({ label, field, step, log, value, onChange, name }) => (
  <Field label={label} mark={name}>
    {log ? (
      <LogSlider label={label.toLowerCase()} value={value} min={field.min} max={field.max} onChange={onChange} />
    ) : (
      // named by the label around it
      <NumberField value={value} field={field} step={step} onChange={onChange} />
    )}
  </Field>
);

interface IPairSide {
  caption: string;
  field: Range;
  step: number;
  bound?: IBound<number>;
  /** what a side without a bound shows */
  placeholder?: string;
}

/** two numbers side by side under one caption, each with a caption of its own */
export const PairSetting: React.FC<{ label: string; sides: [IPairSide, IPairSide] }> = ({ label, sides }) => (
  <Field label={label} group>
    <div className='pair'>
      {sides.map(({ caption, field, step, bound, placeholder }) => (
        <label key={caption} className='mini'>
          <span>{caption}</span>
          {bound ? (
            <Marked names={bound.name}>
              <NumberField label={`${label} ${caption}`} value={bound.value} field={field} step={step} onChange={bound.onChange} />
            </Marked>
          ) : (
            <span className='meta'>{placeholder}</span>
          )}
        </label>
      ))}
    </div>
  </Field>
);

/** a positive number on a logarithmic slider, with the number to type in next to it */
export const LogSlider: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }> = ({
  value,
  onChange,
  min = -5,
  max = 5,
  label,
}) => (
  <div className='log-slider'>
    <input type='range' aria-label={label} min={min} max={max} step={0.01} value={Math.log10(value)} onChange={(e) => onChange(10 ** e.target.valueAsNumber)} />
    <NumberField label={label} value={+value.toPrecision(3)} min={10 ** min} max={10 ** max} onChange={onChange} />
  </div>
);

export function Select<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (T | [T, string])[]; onChange: (v: T) => void; label?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => {
        const [v, text] = Array.isArray(o) ? o : [o, o];
        return (
          <option key={v} value={v}>
            {text}
          </option>
        );
      })}
    </select>
  );
}
