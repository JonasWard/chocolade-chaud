// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Field } from '../../src/components/shared/Fields';
import { Choices } from '../../src/components/shared/Choices';

afterEach(cleanup);

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
