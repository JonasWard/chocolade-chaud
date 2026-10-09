import React from 'react';
import { COLUMNS, IPiece, ROWS, TabletSize, units } from '../../geometry/tablets';

export const sizeLabel = (size: TabletSize) => size.replace('x', '×');

/**
 * the pieces of a layout in a 6 by 2 drawing, filled by fill, a tap on a piece picks it when onPick is given. A piece that is marked
 * has a dot: it differs from the others
 */
export const LayoutDrawing: React.FC<{
  pieces: IPiece[];
  fill: (i: number) => string;
  selected?: number;
  onPick?: (i: number) => void;
  marked?: (i: number) => boolean;
  className: string;
}> = ({ pieces, fill, selected, onPick, marked, className }) => (
  <svg className={className} viewBox={`-0.1 -0.1 ${COLUMNS + 0.2} ${ROWS * 1.4 + 0.2}`} aria-hidden={!onPick}>
    {pieces.map(({ size, u, v }, i) => {
      const n = units(size);
      const differs = !!marked?.(i);
      return (
        <React.Fragment key={i}>
          <rect
            x={u + 0.06}
            y={v * 1.4 + 0.06}
            width={n.u - 0.12}
            height={n.v * 1.4 - 0.12}
            rx={0.12}
            fill={fill(i)}
            className={i === selected ? 'piece selected' : 'piece'}
            role={onPick ? 'button' : undefined}
            aria-label={onPick ? `piece ${i + 1}, ${sizeLabel(size)}${differs ? ', differs' : ''}` : undefined}
            aria-pressed={onPick ? i === selected : undefined}
            onClick={onPick && (() => onPick(i))}
          />
          {differs && <circle className='piece-mark' cx={u + n.u - 0.36} cy={v * 1.4 + 0.36} r={0.13} />}
        </React.Fragment>
      );
    })}
  </svg>
);
