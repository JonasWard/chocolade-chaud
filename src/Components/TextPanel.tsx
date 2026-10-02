import React from 'react';
import { FONT_FAMILIES, ITextSettings } from '../geometry/text/textField';
import { Field, NumberField, Select } from './ui';

export const TextPanel: React.FC<{ text: ITextSettings; setText: (t: ITextSettings) => void }> = ({ text, setText }) => {
  const number = (label: string, key: 'size' | 'depth' | 'bevelWidth' | 'patternFade' | 'offsetX' | 'offsetZ', step: number, min?: number, max?: number) => (
    <Field label={label}>
      <NumberField value={text[key]} step={step} min={min} max={max} onChange={(v) => setText({ ...text, [key]: v })} />
    </Field>
  );

  return (
    <>
      <input placeholder='text on the bar' value={text.text} onChange={(e) => setText({ ...text, text: e.target.value })} />
      <Field label='Font'>
        <Select value={text.fontFamily} options={FONT_FAMILIES} onChange={(fontFamily) => setText({ ...text, fontFamily })} />
      </Field>
      {number('Size', 'size', 1, 1, 200)}
      {number('Height', 'depth', 0.1, -5, 5)}
      {number('Bevel', 'bevelWidth', 0.1, 0, 10)}
      {number('Flatten', 'patternFade', 0.1, 0, 1)}
      {number('X', 'offsetX', 1)}
      {number('Z', 'offsetZ', 1)}
    </>
  );
};
