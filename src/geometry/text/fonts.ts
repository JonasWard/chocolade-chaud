import type { ITextNode } from '../sdf/tree';

// the fonts a text node can use: installed ones (listed with the local font access api where there is one) and google fonts

export const GENERIC_FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'];

export const GOOGLE_FONTS = [
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Raleway',
  'Poppins',
  'Nunito',
  'Merriweather',
  'Playfair Display',
  'Lora',
  'Bebas Neue',
  'Anton',
  'Archivo Black',
  'Abril Fatface',
  'Alfa Slab One',
  'Righteous',
  'Lobster',
  'Pacifico',
  'Dancing Script',
  'Great Vibes',
  'Satisfy',
  'Permanent Marker',
  'Shadows Into Light',
  'Caveat',
  'Amatic SC',
  'Fredoka',
  'Comfortaa',
  'Bangers',
  'Shrikhand',
  'Cinzel',
  'Space Mono',
];

const COMMON_FONTS = [
  'Arial',
  'Arial Black',
  'Helvetica',
  'Helvetica Neue',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Calibri',
  'Candara',
  'Gill Sans',
  'Futura',
  'Avenir',
  'Optima',
  'Franklin Gothic Medium',
  'Impact',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Palatino',
  'Palatino Linotype',
  'Book Antiqua',
  'Baskerville',
  'Didot',
  'Cambria',
  'Rockwell',
  'Courier New',
  'Consolas',
  'Menlo',
  'Monaco',
  'Lucida Console',
  'Comic Sans MS',
  'Brush Script MT',
  'Papyrus',
  'Copperplate',
  'Noto Sans',
  'Noto Serif',
  'DejaVu Sans',
  'DejaVu Serif',
  'Liberation Sans',
  'Liberation Serif',
  'Ubuntu',
  'Cantarell',
];

/** a css font, the generic families are not quoted */
export const cssFont = (font: string, bold: boolean, px: number): string =>
  `${bold ? 'bold' : 'normal'} ${px}px ${GENERIC_FONTS.includes(font) ? font : `"${font.replace(/["\\]/g, '')}"`}`;

/** the common fonts this browser has: they draw a test text wider or narrower than every generic fallback */
export const detectFonts = (): string[] => {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return [];
  const width = (font: string) => {
    context.font = font;
    return context.measureText('mmmmmmmmmmlli WQ@#').width;
  };
  const fallbacks = ['monospace', 'serif', 'sans-serif'];
  const base = fallbacks.map((f) => width(`72px ${f}`));
  return COMMON_FONTS.filter((font) => fallbacks.some((f, i) => width(`72px "${font}", ${f}`) !== base[i]));
};

type LocalFontWindow = Window & { queryLocalFonts?: () => Promise<{ family: string }[]> };

export const canListInstalledFonts = (): boolean => typeof window !== 'undefined' && 'queryLocalFonts' in window;

/** every installed font family, asks for permission (chrome and edge only), call it from a click */
export const installedFonts = async (): Promise<string[]> => {
  const fonts = (await (window as LocalFontWindow).queryLocalFonts?.()) ?? [];
  return [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
};

const stylesheets = new Map<string, Promise<void>>();

const addStylesheet = (href: string) =>
  new Promise<void>((resolve, reject) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(new Error('not found'));
    };
    document.head.appendChild(link);
  });

/** the stylesheet of a google font, with its bold weight when it has one */
const loadGoogleStylesheet = (family: string): Promise<void> => {
  let loading = stylesheets.get(family);
  if (!loading) {
    const name = encodeURIComponent(family.trim()).replace(/%20/g, '+');
    const css = (axis: string) => `https://fonts.googleapis.com/css2?family=${name}${axis}&display=block`;
    loading = addStylesheet(css(':wght@400;700'))
      .catch(() => addStylesheet(css('')))
      .catch(() => {
        stylesheets.delete(family);
        throw new Error(`"${family}" could not be loaded from Google Fonts (not a family there, or offline)`);
      });
    stylesheets.set(family, loading);
  }
  return loading;
};

/** resolves once the font of the text can be drawn with, throws for a google font that doesn't exist */
export const loadFont = async ({ font, fontSource, bold, text }: Pick<ITextNode, 'font' | 'fontSource' | 'bold' | 'text'>): Promise<void> => {
  if (fontSource === 'google') await loadGoogleStylesheet(font);
  try {
    await document.fonts.load(cssFont(font, bold, 48), text);
  } catch {
    // drawn with the fallback font
  }
};
