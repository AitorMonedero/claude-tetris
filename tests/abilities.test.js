'use strict';

test('addEnergy adds per cleared line and caps at the maximum', () => {
  assertEqual(addEnergy(0, 2), 2 * ENERGY_PER_LINE);
  assertEqual(addEnergy(ENERGY_MAX - 5, 4), ENERGY_MAX);
  assertEqual(addEnergy(30, 0), 30);
});

test('cloneBoard returns an independent copy', () => {
  const board = boardFromRows(['1.........']);
  const copy = cloneBoard(board);
  copy[ROWS - 1][0] = 0;
  assertEqual(board[ROWS - 1][0], 1);
  assertEqual(cloneBoard(board), board);
});

test('effectiveDropInterval slows the fall only while slowed', () => {
  assertEqual(effectiveDropInterval(400, false), 400);
  assertEqual(effectiveDropInterval(400, true), 400 * SLOW_FACTOR);
});
