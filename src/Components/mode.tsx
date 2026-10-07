import React from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useStoredFlag } from '../hooks/useStoredFlag';
import { Hint } from './ui';

// how the app is shown: simple or expert mode, a preference of this browser and not part of the link, and whether it is on a phone

export const PHONE = '(max-width: 720px)';

export interface IMode {
  /** expert mode shows every setting, simple mode the ones most patterns need */
  expert: boolean;
  setExpert: (expert: boolean) => void;
  /** on a phone the pattern is edited in columns and the settings are a sheet */
  mobile: boolean;
}

export const ModeContext = React.createContext<IMode>({ expert: false, setExpert: () => {}, mobile: false });

/** the mode of this browser, provided once by the app */
export const useModeState = (): IMode => {
  const [expert, setExpert] = useStoredFlag('chocolade-chaud:expert');
  const mobile = useMediaQuery(PHONE);
  return React.useMemo(() => ({ expert, setExpert, mobile }), [expert, setExpert, mobile]);
};

export const useMode = (): IMode => React.useContext(ModeContext);

// the settings expert mode shows that are not their default, see ExpertNotice
const NoticeContext = React.createContext<((name: string) => () => void) | undefined>(undefined);

/**
 * what only expert mode shows, simple mode shows the fallback. A setting with a name that is changed (not its default) is listed by
 * the ExpertNotice around it in simple mode, so what is hidden is never a surprise
 */
export const Expert: React.FC<{ children?: React.ReactNode; fallback?: React.ReactNode; name?: string; changed?: boolean }> = ({
  children,
  fallback = null,
  name,
  changed,
}) => {
  const { expert } = useMode();
  const notice = React.useContext(NoticeContext);
  React.useLayoutEffect(() => (!expert && name && changed && notice ? notice(name) : undefined), [expert, name, changed, notice]);
  return <>{expert ? children : fallback}</>;
};

/** what only simple mode shows */
export const Simple: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{useMode().expert ? null : children}</>;

/** in simple mode, after its children, the names of the changed settings among them that only expert mode shows */
export const ExpertNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { expert } = useMode();
  const [names, setNames] = React.useState<string[]>([]);
  const notice = React.useCallback((name: string) => {
    setNames((n) => [...n, name]);
    return () =>
      setNames((n) => {
        const i = n.indexOf(name);
        return i < 0 ? n : [...n.slice(0, i), ...n.slice(i + 1)];
      });
  }, []);
  const shown = [...new Set(names)];
  return (
    <NoticeContext.Provider value={notice}>
      {children}
      {!expert && shown.length > 0 && <Hint>Also set in expert mode: {shown.join(', ')}.</Hint>}
    </NoticeContext.Provider>
  );
};
