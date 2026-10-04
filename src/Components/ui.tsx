import React from 'react';

// the few form controls of the app, plain html styled by ui.css

export const Section: React.FC<{ title: string; open?: boolean; className?: string; children: React.ReactNode }> = ({ title, open, className = 'section', children }) => (
  <details className={className} open={open}>
    <summary>{title}</summary>
    <div className='stack'>{children}</div>
  </details>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className='field'>
    <span>{label}</span>
    {children}
  </label>
);

/** keeps what is typed until it is a number in range, so typing "-" or "0." doesn't reset the input */
export const NumberField: React.FC<{ value: number; onChange: (v: number) => void; step?: number | 'any'; min?: number; max?: number; label?: string }> = ({
  value,
  onChange,
  step = 'any',
  min = -Infinity,
  max = Infinity,
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

/** one of a few options as a row of buttons */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className='segmented' role='radiogroup' aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role='radio' aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
