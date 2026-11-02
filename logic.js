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

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
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
  if (below && below !== WILD && below !== GARBAGE) return below;
  const present = [...new Set(board.flat().filter(v => v && v !== WILD && v !== GARBAGE))];
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

// ---- Piece selection ----

const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7];
const PENTOMINO_TYPES = [9, 10, 11]; // +, U, Y
const SINGLE_TYPE = 12;
const HOLLOW_TYPE = 13;
const PENTOMINO_CHANCE = 0.1;
const HOLLOW_CHANCE = 0.03;
const HOLLOW_MIN_LEVEL = 3;

function pickFrom(list, random) {
  return list[Math.floor(random() * list.length)];
}

function pickPieceType(level, random = Math.random) {
  const roll = random();
  if (level >= HOLLOW_MIN_LEVEL && roll < HOLLOW_CHANCE) return HOLLOW_TYPE;
  if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE) return pickFrom(PENTOMINO_TYPES, random);
  return pickFrom(STANDARD_TYPES, random);
}

// ---- Combos and bonuses ----

const T_TYPE = 3;
const TSPIN_SCORES = [400, 800, 1200, 1600];
const COMBO_MAX_MULTIPLIER = 10;
const B2B_MULTIPLIER = 1.5;
const PERFECT_CLEAR_BONUS = 2000;

// T-spin (3-corner rule): at least 3 of the 4 corners of the T's 3x3 box are walls, floor or blocks.
function isTSpin(board, piece) {
  if (piece.type !== T_TYPE) return false;
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
  const blocked = corners.filter(([dx, dy]) => {
    const x = piece.x + dx, y = piece.y + dy;
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    return y >= 0 && board[y][x] !== 0;
  });
  return blocked.length >= 3;
}

// Tetrises and T-spins that clear lines keep the back-to-back chain alive.
function isDifficultClear(cleared, tspin) {
  return cleared === 4 || (tspin && cleared > 0);
}

function isBoardEmpty(board) {
  return board.every(row => row.every(v => v === 0));
}

function comboMultiplier(combo) {
  return Math.min(Math.max(combo, 1), COMBO_MAX_MULTIPLIER);
}

// combo: consecutive line-clearing locks including this one (1 = first clear, no multiplier).
function computeClearScore({ cleared, level, combo = 1, tspin = false, b2b = false, perfect = false, wildCount = 0 }) {
  let base = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared] || 0) * level;
  if (b2b) base *= B2B_MULTIPLIER;
  const comboPoints = cleared > 0 ? base * comboMultiplier(combo) : base;
  const bonus = wildCount * WILD_BONUS * level + (perfect ? PERFECT_CLEAR_BONUS * level : 0);
  return Math.round(comboPoints + bonus);
}

// ---- Challenge modes ----

const GARBAGE = 14;

// Bottom rows for the "fixed blocks" challenge: no row is full, so they must be dug out.
const FIXED_BLOCKS_PATTERN = [
  'x..x..x..x',
  '.x..xx..x.',
  'xx.x..x.xx',
  'x.xx.x.xx.',
  '.xx.xx.x.x',
  'xx.xx.xxx.',
];

function placeFixedBlocks(board) {
  const offset = ROWS - FIXED_BLOCKS_PATTERN.length;
  FIXED_BLOCKS_PATTERN.forEach((row, r) =>
    [...row].forEach((ch, c) => { if (ch === 'x') board[offset + r][c] = GARBAGE; }));
}

function countCells(board, value) {
  return board.reduce((sum, row) => sum + row.filter(v => v === value).length, 0);
}

// Pushes a garbage row with one hole from the bottom. Returns true if blocks were pushed off the top.
function pushGarbageRow(board, holeCol) {
  const overflow = board[0].some(v => v !== 0);
  board.shift();
  const row = new Array(COLS).fill(GARBAGE);
  row[holeCol] = 0;
  board.push(row);
  return overflow;
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// ---- Abilities ----

const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;
const QUEUE_SIZE = 5;
const PREVIEW_MS = 20000;
const SLOW_MS = 10000;
const SLOW_FACTOR = 2.5;

function addEnergy(energy, cleared) {
  return Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
}

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function effectiveDropInterval(interval, slowed) {
  return slowed ? interval * SLOW_FACTOR : interval;
}

// ---- Hold ----

const HOLD_USES_PER_TURN = 1;

function createHoldState() {
  return { piece: null, usesLeft: HOLD_USES_PER_TURN };
}

// Stores the current piece (reset with `fresh`) and returns the piece to play next:
// the previously held one, or `takeNext()` if the slot was empty. Returns null while locked.
function applyHold(hold, currentPiece, takeNext, fresh) {
  if (hold.usesLeft <= 0) return null;
  hold.usesLeft--;
  const nextPiece = hold.piece ? fresh(hold.piece) : takeNext();
  hold.piece = fresh(currentPiece);
  return nextPiece;
}

function resetHoldForNewPiece(hold) {
  hold.usesLeft = HOLD_USES_PER_TURN;
}

function grantExtraHold(hold) {
  hold.usesLeft++;
}
