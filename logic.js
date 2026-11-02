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

// ---- Power-ups ----

const WILD = 8;
const WILD_BONUS = 50;
const POWERUP_EVERY_LINES = 8;
const FREEZE_MS = 5000;
const POWERUP_TYPES = ['bomb', 'lightning', 'tint', 'gravity', 'freeze'];

function isInside(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function applyBomb(board, x, y) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (isInside(x + dx, y + dy)) board[y + dy][x + dx] = 0;
}

function applyLightning(board, x, y) {
  if (y >= 0 && y < ROWS) board[y].fill(0);
  for (let r = 0; r < ROWS; r++) board[r][x] = 0;
}

function applyTint(board, colorIndex) {
  let converted = 0;
  for (const row of board)
    for (let c = 0; c < COLS; c++)
      if (row[c] === colorIndex) { row[c] = WILD; converted++; }
  return converted;
}

// Color the tint power-up converts: the block it lands on, or any color on the board if it lands on the floor.
function tintTargetColor(board, x, y, random = Math.random) {
  const below = y + 1 < ROWS ? board[y + 1][x] : 0;
  if (below && below !== WILD) return below;
  const present = [...new Set(board.flat().filter(v => v && v !== WILD))];
  return present.length ? present[Math.floor(random() * present.length)] : 0;
}

function applyGravity(board) {
  for (let c = 0; c < COLS; c++) {
    const blocks = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) blocks.push(board[r][c]);
    const firstFilled = ROWS - blocks.length;
    for (let r = 0; r < ROWS; r++) board[r][c] = r < firstFilled ? 0 : blocks[r - firstFilled];
  }
}

function countWildInFullRows(board) {
  return board
    .filter(row => row.every(v => v !== 0))
    .reduce((sum, row) => sum + row.filter(v => v === WILD).length, 0);
}
