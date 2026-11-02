'use strict';

test('applyBomb clears the 3x3 area around the impact', () => {
  const board = boardFromRows([
    '1111111111',
    '1111111111',
    '1111111111',
  ]);
  applyBomb(board, 4, ROWS - 2);
  assertEqual(board[ROWS - 3], [1, 1, 1, 0, 0, 0, 1, 1, 1, 1]);
  assertEqual(board[ROWS - 2], [1, 1, 1, 0, 0, 0, 1, 1, 1, 1]);
  assertEqual(board[ROWS - 1], [1, 1, 1, 0, 0, 0, 1, 1, 1, 1]);
});

test('applyBomb ignores cells outside the board', () => {
  const board = boardFromRows(['1111111111']);
  applyBomb(board, 0, ROWS - 1);
  assertEqual(board[ROWS - 1], [0, 0, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test('applyLightning clears the full row and column', () => {
  const board = boardFromRows([
    '2222222222',
    '3333333333',
  ]);
  applyLightning(board, 2, ROWS - 1);
  assertEqual(board[ROWS - 1], new Array(COLS).fill(0));
  assertEqual(board[ROWS - 2], [2, 2, 0, 2, 2, 2, 2, 2, 2, 2]);
});

test('applyTint converts every block of a color into wildcards', () => {
  const board = boardFromRows(['1213141511']);
  assertEqual(applyTint(board, 1), 6);
  assertEqual(board[ROWS - 1], [WILD, 2, WILD, 3, WILD, 4, WILD, 5, WILD, WILD]);
});

test('tintTargetColor prefers the block below the impact', () => {
  const board = boardFromRows(['..3.......']);
  assertEqual(tintTargetColor(board, 2, ROWS - 2), 3);
});

test('tintTargetColor falls back to a color on the board, or 0 if empty', () => {
  const board = boardFromRows(['.....6....']);
  assertEqual(tintTargetColor(board, 0, ROWS - 1, () => 0), 6);
  assertEqual(tintTargetColor(createBoard(), 0, ROWS - 1), 0);
});

test('applyGravity compacts holes in every column', () => {
  const board = boardFromRows([
    '1.2.......',
    '..........',
    '.3........',
    '4.........',
  ]);
  applyGravity(board);
  assertEqual(board[ROWS - 2], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assertEqual(board[ROWS - 1], [4, 3, 2, 0, 0, 0, 0, 0, 0, 0]);
});

test('countWildInFullRows only counts wildcards in complete rows', () => {
  const board = boardFromRows([
    '8.........',
    '8811111111',
  ]);
  assertEqual(countWildInFullRows(board), 2);
});
