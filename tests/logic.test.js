'use strict';

test('createBoard builds an empty ROWS x COLS matrix', () => {
  const board = createBoard();
  assertEqual(board.length, ROWS);
  assertEqual(board[0].length, COLS);
  assertTrue(board.every(row => row.every(v => v === 0)), 'all cells empty');
});

test('collide detects walls and floor', () => {
  const board = createBoard();
  const shape = [[1, 1]];
  assertEqual(collide(board, shape, -1, 0), true, 'left wall');
  assertEqual(collide(board, shape, COLS - 1, 0), true, 'right wall');
  assertEqual(collide(board, shape, 0, ROWS), true, 'floor');
  assertEqual(collide(board, shape, 0, 0), false, 'free space');
});

test('collide allows rows above the board', () => {
  assertEqual(collide(createBoard(), [[1], [1]], 0, -1), false);
});

test('collide detects overlap with locked blocks', () => {
  const board = boardFromRows(['1.........']);
  assertEqual(collide(board, [[1]], 0, ROWS - 1), true);
  assertEqual(collide(board, [[1]], 1, ROWS - 1), false);
});

test('rotateCW rotates a matrix clockwise', () => {
  assertEqual(rotateCW([[1, 2], [3, 4]]), [[3, 1], [4, 2]]);
  assertEqual(rotateCW([[1, 1, 1]]), [[1], [1], [1]]);
});

test('clearFullRows removes full rows and shifts the rest down', () => {
  const board = boardFromRows([
    '2.........',
    '1111111111',
    '3333333333',
  ]);
  assertEqual(clearFullRows(board), 2);
  assertEqual(board[ROWS - 1], [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assertEqual(board.length, ROWS);
});

test('level and drop interval progression', () => {
  assertEqual(levelForLines(0), 1);
  assertEqual(levelForLines(19), 2);
  assertEqual(dropIntervalForLevel(1), 1000);
  assertEqual(dropIntervalForLevel(3), 820);
  assertEqual(dropIntervalForLevel(50), 100);
});

test('lineClearScore scales with level', () => {
  assertEqual(lineClearScore(1, 1), 100);
  assertEqual(lineClearScore(4, 3), 2400);
  assertEqual(lineClearScore(0, 5), 0);
});
