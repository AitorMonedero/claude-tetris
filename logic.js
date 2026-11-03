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

// ---- Records ----

const RECORDS_LIMIT = 5;
const RECORD_NAME_MAX = 12;
const RECORD_DEFAULT_NAME = 'Anónimo';

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeRecordName(name) {
  const trimmed = typeof name === 'string' ? name.trim().slice(0, RECORD_NAME_MAX) : '';
  return trimmed || RECORD_DEFAULT_NAME;
}

function isValidRecord(entry) {
  return entry !== null && typeof entry === 'object'
    && typeof entry.name === 'string'
    && isNonNegativeNumber(entry.score)
    && isNonNegativeNumber(entry.lines)
    && isNonNegativeNumber(entry.maxCombo)
    && typeof entry.mode === 'string'
    && typeof entry.date === 'string';
}

// Keeps only well-formed entries (e.g. read from localStorage), sorted by score, at most `limit`.
function sanitizeRecords(raw, limit = RECORDS_LIMIT) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isValidRecord)
    .map(({ name, score, lines, maxCombo, mode, date }) =>
      ({ name: normalizeRecordName(name), score, lines, maxCombo, mode, date }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// `records` must be sorted by score (highest first), as sanitizeRecords and insertRecord leave it.
function qualifiesForTop(records, score, limit = RECORDS_LIMIT) {
  if (!(score > 0)) return false;
  return records.length < limit || score > records[limit - 1].score;
}

// Returns a new list with `entry` in place and its index (-1 if it did not make the top).
// On ties the older record keeps the higher position.
function insertRecord(records, entry, limit = RECORDS_LIMIT) {
  let index = records.findIndex(record => entry.score > record.score);
  if (index === -1) index = records.length;
  if (index >= limit) return { records: records.slice(0, limit), index: -1 };
  const updated = [...records.slice(0, index), entry, ...records.slice(index)].slice(0, limit);
  return { records: updated, index };
}

function sanitizeBests(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    lines: isNonNegativeNumber(source.lines) ? source.lines : 0,
    maxCombo: isNonNegativeNumber(source.maxCombo) ? source.maxCombo : 0,
  };
}

function updateBests(bests, { lines, maxCombo }) {
  const previous = sanitizeBests(bests);
  return {
    lines: Math.max(previous.lines, lines),
    maxCombo: Math.max(previous.maxCombo, maxCombo),
  };
}

// ---- Pause menu ----

const START_LEVEL_MIN = 1;
const START_LEVEL_MAX = 15;

// Any input (string from storage, NaN, out of range) becomes a valid integer level.
function clampStartLevel(value) {
  const level = Math.round(Number(value));
  if (Number.isNaN(level)) return START_LEVEL_MIN;
  return Math.min(START_LEVEL_MAX, Math.max(START_LEVEL_MIN, level));
}

// A mode's own start level is a minimum: the player's preference can only raise it.
function startLevelForMode(modeStartLevel, preferred) {
  return Math.max(modeStartLevel ?? START_LEVEL_MIN, clampStartLevel(preferred));
}

function wrapMenuIndex(index, delta, count) {
  return ((index + delta) % count + count) % count;
}

// ---- Chaos mode ----

const CHAOS_SHAPE_TYPE = 15; // generated shapes: no PIECES entry, each cell keeps its own color
const CHAOS_COLOR_TYPES = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11];
const CHAOS_SPEED_FACTORS = [0.4, 0.7, 1, 1.6, 2.5]; // multiplies the drop interval: < 1 is faster
const CHAOS_RANDOM_SHAPE_CHANCE = 0.3;
const CHAOS_AUTO_ROTATE_CHANCE = 0.25;
const CHAOS_AUTO_ROTATE_MIN_MS = 800;
const CHAOS_AUTO_ROTATE_SPREAD_MS = 800;
const CHAOS_MIN_DROP_MS = 50;
// No 4: every connected 4-cell shape is a standard tetromino, so it would not look new.
const CHAOS_SHAPE_SIZES = [3, 5];
const CHAOS_SHAPE_BOX = 4; // the preview is 4x4, so generated shapes must fit in it
const CHAOS_EVENT_EVERY_MS = 15000;
const CHAOS_EVENT_DURATIONS = { invert: 6000, wind: 5000, blackout: 4000, earthquake: 0, garbage: 0 };
const CHAOS_EVENTS = Object.keys(CHAOS_EVENT_DURATIONS);
const WIND_PUSH_MS = 500;

// Random connected shape of 3 or 5 cells grown inside a 4x4 box, trimmed to its bounding box.
function generateRandomPolyomino(random = Math.random) {
  const colorIndex = pickFrom(CHAOS_COLOR_TYPES, random);
  const size = pickFrom(CHAOS_SHAPE_SIZES, random);
  const box = CHAOS_SHAPE_BOX;
  const cells = [[Math.floor(random() * box), Math.floor(random() * box)]];
  const isTaken = (r, c) => cells.some(([cr, cc]) => cr === r && cc === c);
  while (cells.length < size) {
    const [r, c] = pickFrom(cells, random);
    const [dr, dc] = pickFrom([[1, 0], [-1, 0], [0, 1], [0, -1]], random);
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < box && nc >= 0 && nc < box && !isTaken(nr, nc)) cells.push([nr, nc]);
  }
  const rows = cells.map(([r]) => r), cols = cells.map(([, c]) => c);
  const top = Math.min(...rows), left = Math.min(...cols);
  const shape = Array.from({ length: Math.max(...rows) - top + 1 },
    () => new Array(Math.max(...cols) - left + 1).fill(0));
  for (const [r, c] of cells) shape[r - top][c - left] = colorIndex;
  return shape;
}

function rollChaosTraits(random = Math.random) {
  const speedFactor = pickFrom(CHAOS_SPEED_FACTORS, random);
  const autoRotateMs = random() < CHAOS_AUTO_ROTATE_CHANCE
    ? CHAOS_AUTO_ROTATE_MIN_MS + Math.floor(random() * CHAOS_AUTO_ROTATE_SPREAD_MS)
    : 0;
  const randomShape = random() < CHAOS_RANDOM_SHAPE_CHANCE;
  return { speedFactor, autoRotateMs, randomShape };
}

function chaosDropInterval(baseInterval, speedFactor = 1) {
  return Math.max(CHAOS_MIN_DROP_MS, Math.round(baseInterval * speedFactor));
}

// Never repeats the previous event, so consecutive events always feel different.
function pickChaosEvent(random = Math.random, previous = null) {
  return pickFrom(CHAOS_EVENTS.filter(event => event !== previous), random);
}

function applyControlInversion(dx, inverted) {
  return inverted ? -dx : dx;
}

// ---- Skins ----

// Returns the stored skin id if it is still available, otherwise the fallback.
function resolveSkinId(stored, availableIds, fallback) {
  return typeof stored === 'string' && availableIds.includes(stored) ? stored : fallback;
}
