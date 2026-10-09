import React from 'react';
import { overrideAt, resetNode } from '../../../geometry/pieces';
import { usePieces } from '../../../hooks/usePieces';

/**
 * next to a node in the tree, while a piece of a unique tablet is edited alone: a dot when some of its settings differ on the piece,
 * and when the node (with what is below it) is the piece's own, that and the way back to the shared one
 */
export const NodeMark: React.FC<{ id: string }> = ({ id }) => {
  const { override, setOverride } = usePieces();
  const found = overrideAt(override, id);
  if (!override || !found) return null;
  const [key, o] = found;
  if ('values' in o)
    return (
      <span className='node-mark' role='img' aria-label='differs on this piece' title='Differs on this piece'>
        ●
      </span>
    );
  return (
    <button
      type='button'
      className='node-mark own'
      aria-label='own on this piece, back to shared'
      title='Its own on this piece: it no longer follows what the pieces share. Back to the shared one.'
      onClick={(e) => {
        e.stopPropagation();
        setOverride(resetNode(override, key));
      }}
    >
      own ↺
    </button>
  );
};
