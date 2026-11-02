'use strict';

// Pure game rules: no DOM access and no global game state, so they can be tested in isolation.

const COLS = 10;
const ROWS = 20;

const LINE_SCORES = [0, 100, 300, 500, 800];

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function collide(board, shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function clearFullRows(board) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function levelForLines(lines) {
  return Math.floor(lines / 10) + 1;
}

function dropIntervalForLevel(level) {
  return Math.max(100, 1000 - (level - 1) * 90);
}

function lineClearScore(cleared, level) {
  return (LINE_SCORES[cleared] || 0) * level;
}
