// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { Expert, ExpertNotice, IMode, ModeContext, Simple } from '../../src/components/shared/Mode';

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
