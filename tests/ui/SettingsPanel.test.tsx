// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IMode, ModeContext } from '../../src/components/shared/Mode';
import { SettingsPanel } from '../../src/components/shared/SettingsPanel';

const mode = (expert: boolean, mobile = false): IMode => ({ expert, setExpert: () => {}, mobile });
const inMode = (m: IMode, children: React.ReactNode) => <ModeContext.Provider value={m}>{children}</ModeContext.Provider>;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('a settings panel remembers being closed, apart for a phone', () => {
  const panel = (mobile: boolean) =>
    inMode(
      mode(false, mobile),
      <SettingsPanel id='bar' title='Bar'>
        <span>bar settings</span>
      </SettingsPanel>
    );
  const details = () => screen.getByText('Bar').closest('details')!;
  const { unmount } = render(panel(false));
  expect(details().open).toBe(true);
  act(() => {
    details().open = false;
    fireEvent(details(), new Event('toggle'));
  });
  unmount();
  render(panel(false));
  expect(details().open).toBe(false);
  cleanup();
  // a phone has its own memory: opened there, it stays closed on a desktop
  render(panel(true));
  expect(details().open).toBe(false);
  act(() => {
    details().open = true;
    fireEvent(details(), new Event('toggle'));
  });
  cleanup();
  render(panel(false));
  expect(details().open).toBe(false);
  cleanup();
  render(panel(true));
  expect(details().open).toBe(true);
});
