import React from 'react';
import { useMode } from '../shared/Mode';

/** the settings next to the scene, on a phone a sheet under it with a handle that hides and shows them */
export const SettingsSheet: React.FC<{ hidden: boolean; setHidden: (hidden: boolean) => void; children: React.ReactNode }> = ({ hidden, setHidden, children }) => {
  const { mobile } = useMode();
  return (
    <aside className='panels'>
      {mobile && (
        <button className='sheet-handle' aria-expanded={!hidden} onClick={() => setHidden(!hidden)}>
          <span className='grabber' />
          {hidden ? 'Settings' : 'Hide'}
        </button>
      )}
      {!hidden && children}
    </aside>
  );
};
