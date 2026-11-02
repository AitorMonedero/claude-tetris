'use strict';

test('rotateCCW is the inverse of rotateCW', () => {
  const shape = [[0, 3, 0], [3, 3, 3], [0, 0, 0]];
  assertEqual(rotateCCW(rotateCW(shape)), shape);
  assertEqual(rotateCCW([[1, 2], [3, 4]]), [[2, 4], [1, 3]]);
});

test('placeFixedBlocks places garbage without full rows', () => {
  const board = createBoard();
  placeFixedBlocks(board);
  assertTrue(countCells(board, GARBAGE) > 0, 'some garbage placed');
  assertEqual(clearFullRows(board), 0);
});

test('pushGarbageRow adds a row with one hole and shifts the board up', () => {
  const board = boardFromRows(['1.........']);
  assertEqual(pushGarbageRow(board, 3), false);
  assertEqual(board[ROWS - 2], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assertEqual(board[ROWS - 1][3], 0);
  assertEqual(countCells([board[ROWS - 1]], GARBAGE), COLS - 1);
});

test('pushGarbageRow reports overflow when the top row is occupied', () => {
  const board = createBoard();
  board[0][0] = 1;
  assertEqual(pushGarbageRow(board, 0), true);
});

test('tintTargetColor never targets garbage', () => {
  const board = createBoard();
  board[ROWS - 1][2] = GARBAGE;
  assertEqual(tintTargetColor(board, 2, ROWS - 2), 0);
});

test('formatTime renders m:ss rounding up', () => {
  assertEqual(formatTime(120000), '2:00');
  assertEqual(formatTime(61001), '1:02');
  assertEqual(formatTime(-5), '0:00');
});
