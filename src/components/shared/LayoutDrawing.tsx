import React from 'react';
import { COLUMNS, IPiece, ROWS, TabletSize, units } from '../../geometry/tablets';

export const sizeLabel = (size: TabletSize) => size.replace('x', '×');

/** the pieces of a layout in a 6 by 2 drawing, filled by fill, a tap on a piece picks it when onPick is given */
export const LayoutDrawing: React.FC<{ pieces: IPiece[]; fill: (i: number) => string; selected?: number; onPick?: (i: number) => void; className: string }> = ({
  pieces,
  fill,
  selected,
  onPick,
  className,
}) => (
  <svg className={className} viewBox={`-0.1 -0.1 ${COLUMNS + 0.2} ${ROWS * 1.4 + 0.2}`} aria-hidden={!onPick}>
    {pieces.map(({ size, u, v }, i) => {
      const n = units(size);
      return (
        <rect
          key={i}
          x={u + 0.06}
          y={v * 1.4 + 0.06}
          width={n.u - 0.12}
          height={n.v * 1.4 - 0.12}
          rx={0.12}
          fill={fill(i)}
          className={i === selected ? 'piece selected' : 'piece'}
          role={onPick ? 'button' : undefined}
          aria-label={onPick ? `piece ${i + 1}, ${sizeLabel(size)}` : undefined}
          onClick={onPick && (() => onPick(i))}
        />
      );
    })}
  </svg>
);
