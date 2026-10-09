import React from 'react';
import { FontSource } from '../../../geometry/sdf/tree';
import { GENERIC_FONTS, GOOGLE_FONTS, canListInstalledFonts, detectFonts, installedFonts } from '../../../geometry/text/fonts';
import { IPickerItem, IPickerSection, Picker } from '../Picker';
import { ErrorText, Hint } from '../Hint';

// the installed fonts once listed, and the detected ones, for every font field
let installed: string[] = [];
let detected: string[] | undefined;

// a font as a value of the picker, its source in front, or the request to list the installed fonts
type FontChoice = `${FontSource}:${string}` | 'list';

const family = (font: string) => (GENERIC_FONTS.includes(font) ? font : `"${font}"`);

const item = (source: FontSource, font: string, hint?: string): IPickerItem<FontChoice> => ({
  value: `${source}:${font}`,
  label: font,
  hint,
  // installed fonts show themselves, a google font only once it is loaded
  style: source === 'local' ? { fontFamily: family(font) } : undefined,
});

const fontSections = (): IPickerSection<FontChoice>[] => {
  detected ??= detectFonts();
  const local = [...new Set([...detected, ...installed])].filter((f) => !GENERIC_FONTS.includes(f));
  const list: IPickerItem<FontChoice>[] =
    canListInstalledFonts() && !installed.length ? [{ value: 'list', label: 'List all installed fonts…', hint: 'asks for permission' }] : [];
  return [
    { title: 'Generic', items: GENERIC_FONTS.map((f) => item('local', f)) },
    { title: installed.length ? 'Installed' : 'Installed (detected)', items: [...local.map((f) => item('local', f)), ...list] },
    { title: 'Google Fonts', items: GOOGLE_FONTS.map((f) => item('google', f)) },
  ];
};

// what is typed narrows the fonts, a name that is not there can be used as it is
const searchFonts = (query: string): IPickerSection<FontChoice>[] => {
  const q = query.trim().toLowerCase();
  const sections = fontSections().map((s) => ({ ...s, items: s.items.filter((i) => i.value !== 'list' && i.label.toLowerCase().includes(q)) }));
  if (!q || sections.some((s) => s.items.some((i) => i.label.toLowerCase() === q))) return sections;
  const name = query.trim();
  return [...sections, { title: 'Use as typed', items: [item('local', name, 'installed'), item('google', name, 'from Google Fonts')] }];
};

/** a font family: generic, installed or from google fonts, the source goes with the font */
export const FontField: React.FC<{ font: string; source: FontSource; onChange: (font: string, source: FontSource) => void; error?: string }> = ({
  font,
  source,
  onChange,
  error,
}) => {
  const [, setListed] = React.useState(0);

  const onPick = async (choice: FontChoice) => {
    if (choice === 'list') {
      try {
        installed = await installedFonts();
        setListed(installed.length);
      } catch {
        // no permission, the detected fonts remain
      }
      return;
    }
    const [picked, ...name] = choice.split(':');
    onChange(name.join(':'), picked as FontSource);
  };

  return (
    <>
      <Picker<FontChoice>
        label='font'
        trigger={
          <>
            <span className='picker-label' style={source === 'local' ? { fontFamily: family(font) } : undefined}>
              {font}
            </span>
            <span className='meta'>{source === 'google' ? 'Google' : 'installed'}</span>
            <span className='picker-caret'>▾</span>
          </>
        }
        sections={fontSections()}
        search={searchFonts}
        value={`${source}:${font}`}
        onPick={onPick}
      />
      {installed.length > 0 && <Hint inline>{installed.length} installed fonts</Hint>}
      {error && <ErrorText>{error}</ErrorText>}
    </>
  );
};
