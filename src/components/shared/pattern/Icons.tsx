import React from 'react';
import { DistanceMethodType } from '../../../geometry/sdMethods';
import { IPattern, NodeKind, SdfNode } from '../../../geometry/sdf/tree';
import { KIND_LABEL, methodLabel } from '../../../geometry/sdf/formula';
import { KINDS } from './Kinds';

// line icons on a 24 x 24 grid, drawn in the current colour

const METHOD_ICONS: Record<DistanceMethodType, React.ReactNode> = {
  // two waves in opposite phase, the channels of the gyroid
  [DistanceMethodType.SDGyroid]: <path d='M2 9c2.5-5 5.5-5 8 0s5.5 5 8 0 3.5-2.5 4-2.5M2 15c2.5 5 5.5 5 8 0s5.5-5 8 0 3.5 2.5 4 2.5' />,
  // spheres on a cubic grid
  [DistanceMethodType.SDSchwarzP]: (
    <>
      <circle cx='7' cy='7' r='3.5' />
      <circle cx='17' cy='7' r='3.5' />
      <circle cx='7' cy='17' r='3.5' />
      <circle cx='17' cy='17' r='3.5' />
    </>
  ),
  // a diamond lattice
  [DistanceMethodType.SDSchwarzD]: <path d='M12 2.5l9.5 9.5-9.5 9.5L2.5 12zM7.25 7.25l9.5 9.5M16.75 7.25l-9.5 9.5' />,
  // a cell with scooped corners and a hole
  [DistanceMethodType.SDNeovius]: (
    <>
      <path d='M3 8a5 5 0 0 0 5-5h8a5 5 0 0 0 5 5v8a5 5 0 0 0-5 5H8a5 5 0 0 0-5-5z' />
      <circle cx='12' cy='12' r='2.5' />
    </>
  ),
  [DistanceMethodType.SDSphere]: (
    <>
      <circle cx='12' cy='12' r='8.5' />
      <path d='M7.5 10a5 5 0 0 1 4-4' />
    </>
  ),
  [DistanceMethodType.SDBox]: <path d='M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9' />,
  [DistanceMethodType.SDTorus]: (
    <>
      <ellipse cx='12' cy='12' rx='9.5' ry='5.5' />
      <path d='M8 11.5c2.5 2 5.5 2 8 0M9 12.5c2-1.2 4-1.2 6 0' />
    </>
  ),
  [DistanceMethodType.SDCylinder]: (
    <>
      <ellipse cx='12' cy='6' rx='7' ry='2.5' />
      <path d='M5 6v12a7 2.5 0 0 0 14 0V6' />
    </>
  ),
};


const svgDataUrl = (source: string) => `data:image/svg+xml,${encodeURIComponent(source)}`;

const ACTION_ICONS = {
  duplicate: (
    <>
      <rect x='8' y='8' width='12' height='12' rx='2' />
      <path d='M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3' />
    </>
  ),
  up: <path d='M12 19V5M6 11l6-6 6 6' />,
  down: <path d='M12 5v14M6 13l6 6 6-6' />,
  delete: <path d='M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' />,
  // an arrow into a box, out of a box, a box with its corners apart
  into: <path d='M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M3 12h11M10 8l4 4-4 4' />,
  out: <path d='M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M10 12h11M17 8l4 4-4 4' />,
  unwrap: <path d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 12h6M12 9v6' />,
};

const Icon: React.FC<{ title: string; large?: boolean; children: React.ReactNode }> = ({ title, large, children }) => (
  <svg
    className={large ? 'icon large' : 'icon'}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.6'
    strokeLinecap='round'
    strokeLinejoin='round'
    role='img'
    aria-label={title}
  >
    {children}
  </svg>
);

/** the icon of a kind of node, a method has one of its own */
export const KindIcon: React.FC<{ kind: NodeKind; method?: DistanceMethodType; large?: boolean }> = ({ kind, method, large }) => (
  <Icon title={kind === 'method' && method ? methodLabel(method) : KIND_LABEL[kind]} large={large}>
    {kind === 'method' ? METHOD_ICONS[method ?? DistanceMethodType.SDGyroid] : KINDS[kind].icon}
  </Icon>
);

export const ActionIcon: React.FC<{ action: keyof typeof ACTION_ICONS }> = ({ action }) => <Icon title={action}>{ACTION_ICONS[action]}</Icon>;

/** the icon of a node, an svg node shows its own shape (as an image, which doesn't run scripts) */
export const NodeIcon: React.FC<{ node: SdfNode; svgs: IPattern['svgs']; large?: boolean }> = ({ node, svgs, large }) => {
  if (node.kind === 'svg') {
    const asset = svgs[node.asset];
    if (asset?.source) return <img className={large ? 'icon large' : 'icon'} src={svgDataUrl(asset.source)} alt={asset.name} />;
  }
  return <KindIcon kind={node.kind} method={node.kind === 'method' ? node.method : undefined} large={large} />;
};
