// the chocolates a bar can be made of, how they look in the scene

export enum ChocolateType {
  Dark85 = 'Dark85',
  Dark70 = 'Dark70',
  Milk = 'Milk',
  White = 'White',
  Ruby = 'Ruby',
  Blond = 'Blond',
  Gianduja = 'Gianduja',
  Matcha = 'Matcha',
}

export interface IChocolate {
  name: string;
  color: string;
  roughness: number;
  /** the shine of a well tempered surface, 0 to 1 */
  clearcoat: number;
}

export const CHOCOLATES: Record<ChocolateType, IChocolate> = {
  [ChocolateType.Dark85]: { name: 'Dark 85%', color: '#3a1d12', roughness: 0.42, clearcoat: 0.6 },
  [ChocolateType.Dark70]: { name: 'Dark 70%', color: '#5a2c17', roughness: 0.45, clearcoat: 0.5 },
  [ChocolateType.Milk]: { name: 'Milk', color: '#8a5230', roughness: 0.5, clearcoat: 0.35 },
  [ChocolateType.White]: { name: 'White', color: '#f1e3c4', roughness: 0.62, clearcoat: 0.15 },
  [ChocolateType.Ruby]: { name: 'Ruby', color: '#c4566e', roughness: 0.5, clearcoat: 0.35 },
  [ChocolateType.Blond]: { name: 'Blond', color: '#d39a5a', roughness: 0.58, clearcoat: 0.2 },
  [ChocolateType.Gianduja]: { name: 'Gianduja', color: '#7a4a2a', roughness: 0.6, clearcoat: 0.15 },
  [ChocolateType.Matcha]: { name: 'Matcha', color: '#9fb36a', roughness: 0.62, clearcoat: 0.15 },
};

export const CHOCOLATE_TYPES = Object.values(ChocolateType);
export const DEFAULT_CHOCOLATE = ChocolateType.Dark70;

/** the chocolate that looks most like a colour, for the colours of older links */
export const nearestChocolate = (color: string): ChocolateType => {
  const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r, g, b] = rgb(color);
  const distance = (t: ChocolateType) => {
    const [cr, cg, cb] = rgb(CHOCOLATES[t].color);
    return (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
  };
  return CHOCOLATE_TYPES.reduce((best, t) => (distance(t) < distance(best) ? t : best));
};
