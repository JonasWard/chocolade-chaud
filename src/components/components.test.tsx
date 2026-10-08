// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Expert, ExpertNotice, IMode, ModeContext, Simple } from './shared/Mode';
import { SettingsPanel } from './shared/SettingsPanel';
import { Field } from './shared/Fields';
import { Choices } from './shared/Choices';

const mode = (expert: boolean, mobile = false): IMode => ({ expert, setExpert: () => {}, mobile });
const inMode = (m: IMode, children: React.ReactNode) => <ModeContext.Provider value={m}>{children}</ModeContext.Provider>;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('expert mode', () => {
  const settings = (
    <ExpertNotice>
      <Expert name='gain' changed>
        <span>gain field</span>
      </Expert>
      <Expert name='scale' changed={false}>
        <span>scale field</span>
      </Expert>
      <Expert fallback={<span>simple padding</span>}>
        <span>padding x and z</span>
      </Expert>
      <Simple>
        <span>presets</span>
      </Simple>
    </ExpertNotice>
  );

  test('simple mode shows the fallbacks and lists the changed settings it hides', () => {
    render(inMode(mode(false), settings));
    expect(screen.queryByText('gain field')).toBeNull();
    expect(screen.getByText('simple padding')).toBeTruthy();
    expect(screen.getByText('presets')).toBeTruthy();
    // scale is hidden too, but it is its default
    expect(screen.getByText('Also set in expert mode: gain.')).toBeTruthy();
  });

  test('expert mode shows every setting and no notice', () => {
    render(inMode(mode(true), settings));
    expect(screen.getByText('gain field')).toBeTruthy();
    expect(screen.getByText('scale field')).toBeTruthy();
    expect(screen.getByText('padding x and z')).toBeTruthy();
    expect(screen.queryByText('presets')).toBeNull();
    expect(screen.queryByText(/Also set in expert mode/)).toBeNull();
  });
});

test('a click on the caption of a group of buttons picks none of them', () => {
  const picked: string[] = [];
  render(
    <Field label='Position' group>
      <Choices label='position' className='anchor' value='b' options={['a', 'b', 'c']} onChange={(v) => picked.push(v)} name={(v) => v} />
    </Field>
  );
  fireEvent.click(screen.getByText('Position'));
  expect(picked).toEqual([]);
  fireEvent.click(screen.getByRole('radio', { name: 'c' }));
  expect(picked).toEqual(['c']);
  expect(screen.getByRole('group', { name: 'Position' })).toBeTruthy();
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
