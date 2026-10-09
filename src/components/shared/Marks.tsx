import React from 'react';

// what differs on a piece of a unique tablet is marked where it is set, a tap on the mark brings it back to what the pieces share

/** the settings that differ on what is edited, by their name, and how they go back to the shared ones */
export interface IMarks {
  names: ReadonlySet<string>;
  reset: (names: string[]) => void;
}

export const MarksContext = React.createContext<IMarks | undefined>(undefined);

export type MarkNames = string | string[];

const differing = (marks: IMarks | undefined, names: MarkNames | undefined): string[] =>
  marks && names !== undefined ? (Array.isArray(names) ? names : [names]).filter((n) => marks.names.has(n)) : [];

/** a control with the mark of the settings it sets (by their names) next to it, when one of them differs */
export const Marked: React.FC<{ names?: MarkNames; children: React.ReactNode }> = ({ names, children }) => {
  const marks = React.useContext(MarksContext);
  const differs = differing(marks, names);
  if (!marks || !differs.length) return <>{children}</>;
  return (
    <span className='marked'>
      {children}
      <button type='button' className='mark' aria-label='back to shared' title='Differs on this piece. Back to what the pieces share.' onClick={() => marks.reset(differs)}>
        ↺
      </button>
    </span>
  );
};
