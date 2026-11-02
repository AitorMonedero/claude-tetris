'use strict';

function tPiece(x, y) {
  return { type: T_TYPE, shape: [[0, 3, 0], [3, 3, 3], [0, 0, 0]], x, y };
}

test('isTSpin requires 3 blocked corners', () => {
  const board = boardFromRows([
    '1.........',
    '..........',
    '1.1.......',
  ]);
  assertEqual(isTSpin(board, tPiece(0, ROWS - 3)), true);
  assertEqual(isTSpin(createBoard(), tPiece(4, 0)), false);
});

test('isTSpin counts walls and floor as blocked corners', () => {
  assertEqual(isTSpin(createBoard(), tPiece(-1, ROWS - 2)), true);
});

test('isTSpin ignores non-T pieces', () => {
  assertEqual(isTSpin(createBoard(), { ...tPiece(-1, ROWS - 2), type: 1 }), false);
});

test('isDifficultClear: Tetris and T-spin with lines', () => {
  assertEqual(isDifficultClear(4, false), true);
  assertEqual(isDifficultClear(2, true), true);
  assertEqual(isDifficultClear(0, true), false);
  assertEqual(isDifficultClear(3, false), false);
});

test('isBoardEmpty', () => {
  assertEqual(isBoardEmpty(createBoard()), true);
  assertEqual(isBoardEmpty(boardFromRows(['1.........'])), false);
});

test('computeClearScore: plain clear matches lineClearScore', () => {
  assertEqual(computeClearScore({ cleared: 2, level: 3 }), lineClearScore(2, 3));
});

test('computeClearScore: combo multiplies x2, x3... capped', () => {
  assertEqual(computeClearScore({ cleared: 1, level: 1, combo: 2 }), 200);
  assertEqual(computeClearScore({ cleared: 1, level: 1, combo: 4 }), 400);
  assertEqual(computeClearScore({ cleared: 1, level: 1, combo: 50 }), 100 * COMBO_MAX_MULTIPLIER);
});

test('computeClearScore: T-spin and back-to-back bonuses', () => {
  assertEqual(computeClearScore({ cleared: 2, level: 1, tspin: true }), 1200);
  assertEqual(computeClearScore({ cleared: 0, level: 2, tspin: true }), 800);
  assertEqual(computeClearScore({ cleared: 4, level: 1, b2b: true }), 1200);
});

test('computeClearScore: perfect clear and wildcard bonuses are not multiplied by combo', () => {
  assertEqual(computeClearScore({ cleared: 1, level: 1, combo: 2, perfect: true }), 200 + PERFECT_CLEAR_BONUS);
  assertEqual(computeClearScore({ cleared: 1, level: 2, wildCount: 3 }), 200 + 3 * WILD_BONUS * 2);
});
