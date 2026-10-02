import React from 'react';
import { DistanceMethodType } from '../../geometry/sdMethods';
import { IPattern, NodeKind, SdfNode } from '../../geometry/sdf/tree';
import { KIND_LABEL, methodLabel } from '../../geometry/sdf/formula';

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

const KIND_ICONS: Record<Exclude<NodeKind, 'method' | 'svg'>, React.ReactNode> = {
  sine: <path d='M2 12c2.5-8 5.5-8 8 0s5.5 8 8 0c1.2-4 2.7-6 4-6' />,
  constant: <path d='M10 4L8 20M16 4l-2 16M4.5 9h15M4 15h15' />,
  union: <path d='M6 4.5v7.5a6 6 0 0 0 12 0V4.5' />,
  intersection: <path d='M6 19.5V12a6 6 0 0 1 12 0v7.5' />,
  // a disc with the second one cut out of it
  difference: (
    <>
      <path d='M13.5 6.2a7 7 0 1 0 0 11.6 6 6 0 0 1 0-11.6z' />
      <circle cx='16' cy='12' r='6' strokeDasharray='2 2.5' />
    </>
  ),
  add: <path d='M12 5v14M5 12h14' />,
  subtract: <path d='M5 12h14' />,
  // linked rings
  chain: (
    <>
      <rect x='2' y='8' width='12' height='8' rx='4' />
      <rect x='10' y='8' width='12' height='8' rx='4' />
    </>
  ),
};

const svgDataUrl = (source: string) => `data:image/svg+xml,${encodeURIComponent(source)}`;

/** the icon of a node, an svg node shows its own shape (as an image, which doesn't run scripts) */
export const NodeIcon: React.FC<{ node: SdfNode; svgs: IPattern['svgs']; large?: boolean }> = ({ node, svgs, large }) => {
  const className = large ? 'icon large' : 'icon';
  if (node.kind === 'svg') {
    const asset = svgs[node.asset];
    if (asset?.source) return <img className={className} src={svgDataUrl(asset.source)} alt={asset.name} />;
  }
  const title = node.kind === 'method' ? methodLabel(node.method) : KIND_LABEL[node.kind];
  return (
    <svg className={className} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' role='img' aria-label={title}>
      {node.kind === 'method' ? METHOD_ICONS[node.method] : node.kind === 'svg' ? <rect x='4' y='4' width='16' height='16' rx='2' strokeDasharray='3 3' /> : KIND_ICONS[node.kind]}
    </svg>
  );
};
