import React from 'react';
import { IDistanceField, fieldDetail } from '../geometry/field';
import { IPattern, ISvgNode, ITextNode, SdfNode, SvgFields, isGroup, textFieldKey } from '../geometry/sdf/tree';
import { rasterizeSvg } from '../geometry/svg/rasterizeSvg';
import { rasterizeTextNode } from '../geometry/text/rasterizeText';
import { loadFont } from '../geometry/text/fonts';

// a text is drawn again a little after its last edit, while dragging a point of its curve
const TEXT_DELAY = 120;
const MAX_CACHED = 64;

type Drawn = { field?: IDistanceField; error?: string };

// by svg source and by text field key, so a field is only drawn once
const cache = new Map<string, Promise<Drawn>>();
const cached = (key: string, draw: () => Promise<Drawn>) => {
  let drawn = cache.get(key);
  if (!drawn) {
    cache.set(key, (drawn = draw().catch((e: Error) => ({ error: e.message }))));
    // one with an error is tried again next time
    drawn.then(({ error }) => error && cache.delete(key));
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return drawn;
};

// a font that can't be loaded still draws, with the fallback font
const drawText = async (node: ITextNode, detail: number): Promise<Drawn> => {
  const error = await loadFont(node).then(
    () => undefined,
    (e: Error) => e.message
  );
  return { field: rasterizeTextNode(node, detail), error };
};

type FieldNode = { node: ITextNode | ISvgNode; frame: number };

/** the text and svg nodes with their frame, the static part of their scale (see nodeFrame in geometry/sdf/treeOps.ts) */
const fieldNodes = (node: SdfNode, parentFrame = 1): FieldNode[] => {
  const frame = parentFrame * node.scale;
  if (node.kind === 'text' || node.kind === 'svg') return [{ node, frame }];
  if (!isGroup(node)) return [];
  const last = node.children.length - 1;
  return node.children.flatMap((c, i) => fieldNodes(c, node.kind !== 'chain' || i === last ? frame : 1));
};

/** by field key the finest detail any of its nodes needs */
const detailsOf = (nodes: FieldNode[], key: (node: ITextNode | ISvgNode) => string) => {
  const details = new Map<string, number>();
  nodes.forEach(({ node, frame }) => details.set(key(node), Math.max(details.get(key(node)) ?? 1, fieldDetail(frame))));
  return details;
};

const sameFields = (a: SvgFields, b: SvgFields) => a.size === b.size && [...a].every(([key, field]) => b.get(key) === field);

export interface IPatternFields {
  fields: SvgFields;
  /** by field key: svg asset or text field key, for the ones that could not be drawn */
  errors: Record<string, string>;
}

/** the distance fields of the svg assets and text nodes of a pattern. The map stays the same object until a field changes */
export const usePatternFields = (pattern: IPattern): IPatternFields => {
  const [state, setState] = React.useState<IPatternFields>({ fields: new Map(), errors: {} });
  const { svgs, root } = pattern;
  const { texts, svgDetails } = React.useMemo(() => {
    const nodes = fieldNodes(root);
    const textDetails = detailsOf(nodes, (n) => (n.kind === 'text' ? textFieldKey(n) : ''));
    const texts = new Map(nodes.flatMap(({ node }) => (node.kind === 'text' ? [[textFieldKey(node), { node, detail: textDetails.get(textFieldKey(node))! }] as const] : [])));
    return { texts, svgDetails: detailsOf(nodes, (n) => (n.kind === 'svg' ? n.asset : '')) };
  }, [root]);

  React.useEffect(() => {
    let cancelled = false;
    const jobs = [
      ...Object.entries(svgs).map(([key, { source }]) => {
        const detail = svgDetails.get(key) ?? 1;
        return [key, () => cached(`svg:${detail}:${source}`, async () => ({ field: await rasterizeSvg(source, detail) }))] as const;
      }),
      ...[...texts].map(([key, { node, detail }]) => [key, () => cached(`${detail}:${key}`, () => drawText(node, detail))] as const),
    ];
    const timeout = setTimeout(
      () =>
        Promise.all(jobs.map(([key, job]) => job().then((drawn) => ({ key, ...drawn })))).then((results) => {
          if (cancelled) return;
          const fields = new Map(results.flatMap((r) => (r.field ? [[r.key, r.field] as const] : [])));
          const errors = Object.fromEntries(results.flatMap((r) => (r.error ? [[r.key, r.error]] : [])));
          setState((previous) => ({ fields: sameFields(previous.fields, fields) ? previous.fields : fields, errors }));
        }),
      texts.size ? TEXT_DELAY : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [svgs, texts, svgDetails]);

  return state;
};
