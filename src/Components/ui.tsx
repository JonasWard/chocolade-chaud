import React from 'react';
import type { INumberSetting } from '../state/settings';

// the few form controls of the app, plain html styled by ui.css

export const Section: React.FC<{ title: string; open?: boolean; className?: string; children: React.ReactNode }> = ({ title, open, className = 'section', children }) => (
  <details className={className} open={open}>
    <summary>{title}</summary>
    <div className='stack'>{children}</div>
  </details>
);

/**
 * a caption and its control. A group of buttons is a group, not a label: a label passes a click on its caption to its first button
 */
export const Field: React.FC<{ label: string; group?: boolean; children: React.ReactNode }> = ({ label, group, children }) => {
  const id = React.useId();
  return group ? (
    <div className='field' role='group' aria-labelledby={id}>
      <span id={id}>{label}</span>
      {children}
    </div>
  ) : (
    <label className='field'>
      <span>{label}</span>
      {children}
    </label>
  );
};

export const Hint: React.FC<{ children: React.ReactNode; inline?: boolean }> = ({ children, inline }) =>
  inline ? <span className='hint'>{children}</span> : <p className='hint'>{children}</p>;

export const ErrorText: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className='error'>{children}</span>;

/** the caption of a setting, with its unit */
export const settingLabel = ({ label, unit }: INumberSetting) => (unit ? `${label} ${unit}` : label);

/** the value of a property of an object and how to change it, see binder */
export interface IBound<V> {
  value: V;
  onChange: (value: V) => void;
}

/** the properties of an object as values a control can show and change, a change is the object with it changed */
export const binder =
  <T extends object>(object: T, onChange: (object: T) => void) =>
  <K extends keyof T>(key: K): IBound<T[K]> => ({ value: object[key], onChange: (value) => onChange({ ...object, [key]: value }) });

/**
 * keeps what is typed until it is a number in range, so typing "-" or "0." doesn't reset the input. A setting gives its step and range
 */
export const NumberField: React.FC<{ value: number; onChange: (v: number) => void; setting?: INumberSetting; step?: number | 'any'; min?: number; max?: number; label?: string }> = ({
  value,
  onChange,
  setting,
  step = setting?.step ?? 'any',
  min = setting?.min ?? -Infinity,
  max = setting?.max ?? Infinity,
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

/** a number of the settings, with their caption, unit, range and step. label replaces the caption */
export const NumberSetting: React.FC<IBound<number> & { setting: INumberSetting; label?: string }> = ({ setting, label, value, onChange }) => (
  <Field label={label ?? settingLabel(setting)}>
    {setting.log ? (
      <LogSlider label={setting.label.toLowerCase()} value={value} min={Math.log10(setting.min)} max={Math.log10(setting.max)} onChange={onChange} />
    ) : (
      // named by the label around it
      <NumberField value={value} setting={setting} onChange={onChange} />
    )}
  </Field>
);

/** two numbers side by side under one caption, each with a caption of its own. A side without a setting shows its placeholder */
export const PairSetting: React.FC<{
  label: string;
  sides: [{ caption: string; setting: INumberSetting; bound?: IBound<number>; placeholder?: string }, { caption: string; setting: INumberSetting; bound?: IBound<number>; placeholder?: string }];
}> = ({ label, sides }) => (
  <Field label={label} group>
    <div className='pair'>
      {sides.map(({ caption, setting, bound, placeholder }) => (
        <label key={caption} className='mini'>
          <span>{caption}</span>
          {bound ? (
            <NumberField label={`${label} ${caption}`} value={bound.value} setting={setting} onChange={bound.onChange} />
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

/**
 * one of a set of options as buttons, laid out by className (a row, a grid, swatches): every option a button with its own name
 * (for assistive tech and as a tooltip), class, style and content, the one that is on marked
 */
export function Choices<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  name,
  itemClassName,
  itemStyle,
  children,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  className: string;
  name?: (v: T) => string;
  itemClassName?: string;
  itemStyle?: (v: T) => React.CSSProperties;
  children?: (v: T, on: boolean) => React.ReactNode;
}) {
  return (
    <div className={className} role='radiogroup' aria-label={label}>
      {options.map((v) => (
        <button
          key={v}
          role='radio'
          aria-checked={v === value}
          aria-label={name?.(v)}
          title={name?.(v)}
          className={[itemClassName, v === value && 'on'].filter(Boolean).join(' ')}
          style={itemStyle?.(v)}
          onClick={() => onChange(v)}
        >
          {children?.(v, v === value)}
        </button>
      ))}
    </div>
  );
}

/** one of a few options as a row of buttons with their text */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly [T, string][]; onChange: (v: T) => void; label: string }) {
  const text = new Map(options);
  return (
    <Choices label={label} className='segmented' value={value} options={options.map(([v]) => v)} onChange={onChange}>
      {(v) => text.get(v)}
    </Choices>
  );
}
