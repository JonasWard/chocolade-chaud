import React from 'react';
import { IDistanceField } from '../geometry/field';
import { IPattern, SvgFields } from '../geometry/sdf/tree';
import { rasterizeSvg } from '../geometry/svg/rasterizeSvg';

// by source, so an svg is only drawn once
const cache = new Map<string, Promise<IDistanceField>>();
const fieldOf = (source: string) => {
  let field = cache.get(source);
  if (!field) cache.set(source, (field = rasterizeSvg(source)));
  return field;
};

const sameFields = (a: SvgFields, b: SvgFields) => a.size === b.size && [...a].every(([asset, field]) => b.get(asset) === field);

/**
 * The distance fields of the svg assets of a pattern. The map stays the same object until a field changes,
 * errors are by asset, for the svgs that could not be drawn
 */
export const useSvgFields = (svgs: IPattern['svgs']): { fields: SvgFields; errors: Record<string, string> } => {
  const [state, setState] = React.useState<{ fields: SvgFields; errors: Record<string, string> }>({ fields: new Map(), errors: {} });

  React.useEffect(() => {
    let cancelled = false;
    Promise.all(
      Object.entries(svgs).map(([asset, { source }]) =>
        fieldOf(source).then(
          (field) => ({ asset, field }),
          (e: Error) => ({ asset, error: e.message })
        )
      )
    ).then((results) => {
      if (cancelled) return;
      const fields = new Map(results.flatMap((r) => ('field' in r ? [[r.asset, r.field] as const] : [])));
      const errors = Object.fromEntries(results.flatMap((r) => ('error' in r ? [[r.asset, r.error]] : [])));
      setState((previous) => ({ fields: sameFields(previous.fields, fields) ? previous.fields : fields, errors }));
    });
    return () => {
      cancelled = true;
    };
  }, [svgs]);

  return state;
};
