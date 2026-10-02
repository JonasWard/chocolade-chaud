import React from 'react';
import { FontSource } from '../../geometry/sdf/tree';
import { GENERIC_FONTS, GOOGLE_FONTS, canListInstalledFonts, detectFonts, installedFonts } from '../../geometry/text/fonts';
import { Select } from '../ui';

// the installed fonts, once listed, for every font field
let installed: string[] = [];
let detected: string[] | undefined;

/** a font family: picked from the suggestions or typed, it is applied when picked, on enter or when leaving the field */
export const FontField: React.FC<{ font: string; source: FontSource; onChange: (font: string, source: FontSource) => void; error?: string }> = ({
  font,
  source,
  onChange,
  error,
}) => {
  const id = React.useId();
  const [typed, setTyped] = React.useState(font);
  const [shown, setShown] = React.useState(font);
  const [, setListed] = React.useState(0);
  if (shown !== font) {
    setShown(font);
    setTyped(font);
  }

  // listing the installed fonts renders again with them
  const suggestions = source === 'google' ? GOOGLE_FONTS : [...new Set([...GENERIC_FONTS, ...(detected ??= detectFonts()), ...installed])];
  const commit = (value: string) => value.trim() && value !== font && onChange(value.trim(), source);

  const listInstalled = async () => {
    try {
      installed = await installedFonts();
      setListed(installed.length);
    } catch {
      // permission denied, the detected fonts remain
    }
  };

  return (
    <>
      <div className='row'>
        <Select
          label='font source'
          value={source}
          options={[
            ['local', 'Installed'],
            ['google', 'Google'],
          ]}
          onChange={(s) => onChange(s === 'google' ? GOOGLE_FONTS[0] : GENERIC_FONTS[0], s)}
        />
        <input
          aria-label='font'
          list={id}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            if (suggestions.includes(e.target.value)) commit(e.target.value);
          }}
          onBlur={() => commit(typed)}
          onKeyDown={(e) => e.key === 'Enter' && commit(typed)}
        />
        <datalist id={id}>
          {suggestions.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>
      {source === 'local' && canListInstalledFonts() && !installed.length && (
        <button onClick={listInstalled}>List installed fonts…</button>
      )}
      {error && <span className='error'>{error}</span>}
    </>
  );
};
