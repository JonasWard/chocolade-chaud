import React from 'react';
import { useStoredFlag } from '../../hooks/useStoredFlag';
import { useMode } from './Mode';

/** when a panel starts open, until it is opened or closed: always, on a desktop only, or never */
export type DefaultOpen = 'always' | 'desktop' | 'never';

/**
 * A panel of settings that folds. Whether it is open is remembered in this browser, apart for a phone and a desktop: a panel closed on
 * a desktop to make room can still start open on a phone
 */
export const SettingsPanel: React.FC<{ id: string; title: string; defaultOpen?: DefaultOpen; sub?: boolean; children: React.ReactNode }> = ({
  id,
  title,
  defaultOpen = 'desktop',
  sub,
  children,
}) => {
  const { mobile } = useMode();
  const storeKey = `chocolade-chaud:panel:${id}:${mobile ? 'phone' : 'desktop'}`;
  const initial = defaultOpen === 'always' || (defaultOpen === 'desktop' && !mobile);
  // a new key reads what is remembered for it
  return (
    <Folding key={storeKey} storeKey={storeKey} initial={initial} title={title} className={sub ? 'subsection' : 'section'}>
      {children}
    </Folding>
  );
};

const Folding: React.FC<{ storeKey: string; initial: boolean; title: string; className: string; children: React.ReactNode }> = ({ storeKey, initial, title, className, children }) => {
  const [open, setOpen] = useStoredFlag(storeKey, initial);
  return (
    <details className={className} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      <div className='stack'>{children}</div>
    </details>
  );
};

/** a panel inside a panel, closed until it is opened */
export const SubPanel: React.FC<{ id: string; title: string; children: React.ReactNode }> = (props) => <SettingsPanel {...props} defaultOpen='never' sub />;
