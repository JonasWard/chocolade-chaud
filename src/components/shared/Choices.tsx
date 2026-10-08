import React from 'react';

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
