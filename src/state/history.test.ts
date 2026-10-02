import { COALESCE_MS, MAX_STEPS, createHistory, historyReducer } from './history';

const set = (state: number, now: number) => ({ type: 'set' as const, state, now });

test('edits are undone and redone in order', () => {
  let h = createHistory(0);
  h = historyReducer(h, set(1, 0));
  h = historyReducer(h, set(2, 1000));
  h = historyReducer(h, { type: 'undo' });
  expect(h.present).toBe(1);
  h = historyReducer(h, { type: 'undo' });
  expect(h.present).toBe(0);
  expect(historyReducer(h, { type: 'undo' })).toBe(h);
  h = historyReducer(h, { type: 'redo' });
  expect([h.past, h.present, h.future]).toEqual([[0], 1, [2]]);
  // an edit drops what could be redone
  h = historyReducer(h, set(5, 5000));
  expect([h.past, h.present, h.future]).toEqual([[0, 1], 5, []]);
});

test('quick edits are one step', () => {
  let h = createHistory(0);
  h = historyReducer(h, set(1, 0));
  h = historyReducer(h, set(2, COALESCE_MS / 2));
  h = historyReducer(h, set(3, COALESCE_MS));
  expect([h.past, h.present]).toEqual([[0], 3]);
  h = historyReducer(h, set(4, 10 * COALESCE_MS));
  expect([h.past, h.present]).toEqual([[0, 3], 4]);
  // after an undo the next edit is a step of its own
  h = historyReducer(h, { type: 'undo' });
  h = historyReducer(h, set(7, 10 * COALESCE_MS + 1));
  expect([h.past, h.present]).toEqual([[0, 3], 7]);
});

test('the stack is capped', () => {
  let h = createHistory(0);
  for (let i = 1; i <= MAX_STEPS + 20; i++) h = historyReducer(h, set(i, i * COALESCE_MS * 2));
  expect(h.past.length).toBe(MAX_STEPS);
  expect(h.past[0]).toBe(20);
});
