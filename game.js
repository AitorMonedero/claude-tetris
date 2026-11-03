'use strict';

const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#ffffff', // WILD - drawn as a rainbow gradient
  '#f06292', // + - pink
  '#4db6ac', // U - teal
  '#aed581', // Y - lime
  '#fff176', // single - light yellow
  '#90a4ae', // hollow 3x3 - blue grey
  '#4a4f5c', // GARBAGE - challenge blocks
];

const POWERUP_STYLES = {
  bomb:      { symbol: '✸', color: '#ff5252', label: 'BOMBA' },
  lightning: { symbol: 'ϟ', color: '#ffee58', label: 'RAYO' },
  tint:      { symbol: '◈', color: '#e040fb', label: 'TINTE' },
  gravity:   { symbol: '⇊', color: '#69f0ae', label: 'GRAVEDAD' },
  freeze:    { symbol: '❄', color: '#80d8ff', label: 'CONGELAR' },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  null,                                        // WILD is a color, not a piece
  [[0,9,0],[9,9,9],[0,9,0]],                  // +
  [[10,0,10],[10,10,10],[0,0,0]],             // U
  [[0,0,0,0],[11,11,11,11],[0,11,0,0],[0,0,0,0]], // Y
  [[12]],                                      // single (Tetris reward)
  [[13,13,13],[13,0,13],[13,13,13]],          // hollow 3x3 (challenge)
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const queueSection = document.getElementById('queue-section');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const holdSection = document.getElementById('hold-section');
const energyFill = document.getElementById('energy-fill');
const energyHint = document.getElementById('energy-hint');
const abilityMenuEl = document.getElementById('ability-menu');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const effectEl = document.getElementById('effect');
const comboEl = document.getElementById('combo');
const soundEl = document.getElementById('sound');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const modeMenu = document.getElementById('mode-menu');
const endActions = document.getElementById('end-actions');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const objectiveSection = document.getElementById('objective-section');
const modeNameEl = document.getElementById('mode-name');
const objectiveEl = document.getElementById('objective');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerupAtLines, pendingPowerup, freezeRemaining, pendingReward;
let combo, b2bActive, lastActionWasRotate, popups, flashRemaining;

const POPUP_MS = 1200;
const FLASH_MS = 250;
const TSPIN_NAMES = ['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'];

let mode = null, startLevel, modeElapsed, garbageAccum, lockFlash;
let energy, abilityMenu, previewRemaining, slowRemaining, undoSnapshot, hold;

const PIECE_NAMES = { 1: 'I', 2: 'O', 3: 'T', 4: 'S', 5: 'Z', 6: 'J', 7: 'L' };

// Each ability's use() returns true when it was applied, so the energy is only spent on success.
const ABILITIES = [
  { name: 'Ver 5 siguientes (20 s)', use: () => { previewRemaining = PREVIEW_MS; return true; } },
  { name: 'Intercambiar pieza', submenu: 'swap' },
  { name: 'Ralentizar (10 s)', use: () => { slowRemaining = SLOW_MS; return true; } },
  { name: 'Deshacer colocación', isAvailable: () => undoSnapshot !== null, use: () => restoreSnapshot() },
  { name: 'Hold extra (este turno)', use: () => { grantExtraHold(hold); return true; } },
];

const LOCK_FLASH_MS = 300;

const MODES = {
  classic: {
    name: 'Clásico',
    description: 'Partida libre, sin objetivo.',
  },
  sprint: {
    name: 'Sprint 40',
    description: 'Limpia 40 líneas en 2 minutos.',
    timeLimitMs: 120000,
    isWon: () => lines >= 40,
    progress: () => `${lines}/40 líneas · ${formatTime(timeLeft())}`,
  },
  garbage: {
    name: 'Marea de basura',
    description: 'Sobrevive 2 minutos: cada 10 s sube una fila de basura.',
    timeLimitMs: 120000,
    winOnTimeout: true,
    garbageEveryMs: 10000,
    progress: () => `${formatTime(timeLeft())} · sube en ${formatTime(mode.garbageEveryMs - garbageAccum)}`,
  },
  fixed: {
    name: 'Bloques fijos',
    description: 'Elimina todos los bloques grises pre-colocados.',
    setup: () => placeFixedBlocks(board),
    isWon: () => countCells(board, GARBAGE) === 0,
    progress: () => `quedan ${countCells(board, GARBAGE)} bloques`,
  },
  invisible: {
    name: 'Invisibles',
    description: 'Las piezas desaparecen al tocar suelo. Limpia 20 líneas.',
    hideLockedBlocks: true,
    isWon: () => lines >= 20,
    progress: () => `${lines}/20 líneas`,
  },
  reverse: {
    name: 'Rotación inversa',
    description: 'Empiezas en nivel 4 y desde el 5 se gira al revés. Limpia 30 líneas.',
    startLevel: 4,
    reverseRotationFromLevel: 5,
    isWon: () => lines >= 30,
    progress: () => `${lines}/30 líneas${isRotationReversed() ? ' · ↺ inversa' : ''}`,
  },
};

function timeLeft() {
  return mode.timeLimitMs - modeElapsed;
}

function isRotationReversed() {
  return mode.reverseRotationFromLevel !== undefined && level >= mode.reverseRotationFromLevel;
}

function pieceAtSpawn(type, shape) {
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return pieceOfType(pickPieceType(level));
}

function takePendingSpecialPiece() {
  if (pendingPowerup) {
    pendingPowerup = false;
    return powerupPiece(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]);
  }
  if (pendingReward) {
    pendingReward = false;
    return pieceOfType(SINGLE_TYPE);
  }
  return null;
}

function refillQueue() {
  while (queue.length < QUEUE_SIZE) queue.push(randomPiece());
}

// Special pieces jump to the front of the queue so they are always the very next piece.
function takeFromQueue() {
  const piece = queue.shift();
  const special = takePendingSpecialPiece();
  if (special) queue.unshift(special);
  refillQueue();
  return piece;
}

// A copy of the piece back at its spawn position and orientation.
function freshPiece(piece) {
  return piece.power ? powerupPiece(piece.power) : pieceOfType(piece.type);
}

function pieceOfType(type) {
  return pieceAtSpawn(type, PIECES[type].map(row => [...row]));
}

function powerupPiece(power) {
  return { ...pieceAtSpawn(0, [[1]]), power };
}

function tryRotate() {
  const rotated = isRotationReversed() ? rotateCCW(current.shape) : rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(board, rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastActionWasRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines(tspin = false) {
  const wildCount = countWildInFullRows(board);
  const cleared = clearFullRows(board);
  if (!cleared) {
    combo = 0;
    if (tspin) {
      score += computeClearScore({ cleared, level, tspin });
      announce([TSPIN_NAMES[0]], 0);
    }
    return;
  }
  combo++;
  const difficult = isDifficultClear(cleared, tspin);
  const b2b = difficult && b2bActive;
  const perfect = isBoardEmpty(board);
  b2bActive = difficult;
  score += computeClearScore({ cleared, level, combo, tspin, b2b, perfect, wildCount });
  announceClear({ cleared, tspin, b2b, perfect });
  lines += cleared;
  energy = addEnergy(energy, cleared);
  level = levelForLines(lines) + startLevel - 1;
  dropInterval = dropIntervalForLevel(level);
  if (cleared === 4) pendingReward = true;
  if (lines >= nextPowerupAtLines) {
    pendingPowerup = true;
    nextPowerupAtLines += POWERUP_EVERY_LINES;
  }
  updateHUD();
}

function applyPowerup(piece) {
  const { x, y, power } = piece;
  switch (power) {
    case 'bomb':      applyBomb(board, x, y); break;
    case 'lightning': applyLightning(board, x, y); break;
    case 'tint':      applyTint(board, tintTargetColor(board, x, y)); break;
    case 'gravity':   applyGravity(board); break;
    case 'freeze':    freezeRemaining = FREEZE_MS; break;
  }
}

function announceClear({ cleared, tspin, b2b, perfect }) {
  const texts = [];
  if (tspin) texts.push(TSPIN_NAMES[cleared]);
  else if (cleared === 4) texts.push('TETRIS');
  if (b2b) texts.push('B2B');
  if (combo >= 2) texts.push(`COMBO x${comboMultiplier(combo)}`);
  if (perfect) texts.push('PERFECT CLEAR');
  if (texts.length) announce(texts, combo);
  else playTone(440, 0.08);
}

function announce(texts, intensity) {
  texts.forEach((text, i) => popups.push({ text, remaining: POPUP_MS, row: popups.length + i }));
  flashRemaining = FLASH_MS;
  // Each chained step raises the pitch two semitones.
  const baseFreq = 440 * Math.pow(2, (2 * intensity) / 12);
  texts.forEach((_, i) => playTone(baseFreq * Math.pow(2, (4 * i) / 12), 0.12, i * 0.09));
}

let audioCtx = null;
let soundEnabled = true;

function playTone(freq, duration, delay = 0) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!soundEnabled || !AudioContextClass) return;
  audioCtx = audioCtx || new AudioContextClass();
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.06, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundEl.textContent = soundEnabled ? 'sonido ON' : 'sonido OFF';
}

function moveHorizontal(dx) {
  if (collide(board, current.shape, current.x + dx, current.y)) return;
  current.x += dx;
  lastActionWasRotate = false;
}

function ghostY() {
  let gy = current.y;
  while (!collide(board, current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastActionWasRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(board, current.shape, current.x, current.y + 1)) {
    current.y++;
    lastActionWasRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function takeSnapshot() {
  return {
    board: cloneBoard(board),
    piece: freshPiece(current),
    queue: queue.map(freshPiece),
    score, lines, level, combo, b2bActive, dropInterval, nextPowerupAtLines, pendingPowerup, pendingReward,
  };
}

function restoreSnapshot() {
  const { piece, ...state } = undoSnapshot;
  ({ board, queue, score, lines, level, combo, b2bActive, dropInterval, nextPowerupAtLines, pendingPowerup, pendingReward } = state);
  current = piece;
  undoSnapshot = null;
  lockFlash = null;
  lastActionWasRotate = false;
  return true;
}

function tryHold() {
  const nextPiece = applyHold(hold, current, takeFromQueue, freshPiece);
  if (!nextPiece) return;
  current = nextPiece;
  lastActionWasRotate = false;
  if (collide(board, current.shape, current.x, current.y)) endGame();
  drawNext();
}

function swapCurrentPiece(type) {
  const candidate = pieceOfType(type);
  for (const [x, y] of [[current.x, current.y], [candidate.x, candidate.y]]) {
    if (!collide(board, candidate.shape, x, y)) {
      current = { ...candidate, x, y };
      lastActionWasRotate = false;
      return true;
    }
  }
  return false;
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX) return;
  abilityMenu = 'main';
  cancelAnimationFrame(animId);
  renderAbilityMenu();
  showOverlay('HABILIDAD', 'Elige una con su número', 'abilities');
}

function renderAbilityMenu() {
  const items = abilityMenu === 'swap'
    ? STANDARD_TYPES.map(type => ({ name: `Pieza ${PIECE_NAMES[type]}`, enabled: true }))
    : ABILITIES.map(ability => ({ name: ability.name, enabled: ability.isAvailable?.() ?? true }));
  abilityMenuEl.innerHTML = items
    .map((item, i) => `<div class="ability-item${item.enabled ? '' : ' disabled'}"><kbd>${i + 1}</kbd> ${item.name}</div>`)
    .join('') + `<div class="ability-hint"><kbd>Esc</kbd> ${abilityMenu === 'swap' ? 'volver' : 'cancelar'}</div>`;
}

function closeAbilityMenu() {
  abilityMenu = null;
  drawNext();
  updateHUD();
  if (gameOver) return;
  overlay.classList.add('hidden');
  lastTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function finishAbility() {
  energy = 0;
  closeAbilityMenu();
}

function handleAbilityMenuKey(e) {
  if (e.code === 'Escape' || e.code === 'KeyE') {
    if (abilityMenu === 'swap') {
      abilityMenu = 'main';
      renderAbilityMenu();
    } else {
      closeAbilityMenu();
    }
    return;
  }
  const index = Number(e.key) - 1;
  if (abilityMenu === 'swap') {
    if (STANDARD_TYPES[index] && swapCurrentPiece(STANDARD_TYPES[index])) finishAbility();
    return;
  }
  const ability = ABILITIES[index];
  if (!ability || ability.isAvailable?.() === false) return;
  if (ability.submenu) {
    abilityMenu = ability.submenu;
    renderAbilityMenu();
  } else if (ability.use()) {
    finishAbility();
  }
}

function lockPiece() {
  undoSnapshot = takeSnapshot();
  const tspin = !current.power && lastActionWasRotate && isTSpin(board, current);
  if (mode.hideLockedBlocks) lockFlash = { piece: { ...current }, remaining: LOCK_FLASH_MS };
  if (current.power) applyPowerup(current);
  else merge();
  clearLines(tspin);
  spawn();
  if (!gameOver && mode.isWon?.()) endGame(true);
}

function spawn() {
  current = takeFromQueue();
  lastActionWasRotate = false;
  resetHoldForNewPiece(hold);
  if (collide(board, current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  if (mode.progress) objectiveEl.textContent = mode.progress();
  comboEl.textContent = combo >= 2 ? `x${comboMultiplier(combo)}` : '—';
  if (freezeRemaining > 0) effectEl.textContent = `❄ ${(freezeRemaining / 1000).toFixed(1)}s`;
  else if (queue[0].power) effectEl.textContent = `¡${POWERUP_STYLES[queue[0].power].label}!`;
  else effectEl.textContent = `en ${nextPowerupAtLines - lines} líneas`;
  holdSection.classList.toggle('locked', hold.usesLeft <= 0);
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energyFill.classList.toggle('full', energy >= ENERGY_MAX);
  if (slowRemaining > 0) energyHint.textContent = `⏳ lento ${(slowRemaining / 1000).toFixed(1)}s`;
  else if (energy >= ENERGY_MAX) energyHint.textContent = '¡Pulsa E!';
  else energyHint.textContent = `${energy}/${ENERGY_MAX}`;
}

function wildGradient(context, px, py, size) {
  const gradient = context.createLinearGradient(px, py, px + size, py + size);
  ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'].forEach((color, i, all) =>
    gradient.addColorStop(i / (all.length - 1), color));
  return gradient;
}

// ---- Skins ----
// Each skin: `colors` indexed like COLORS, `background` (canvas fill, or null to show the theme's
// CSS background), optional `gridColor` (null uses the theme's --grid) and
// `drawCell(context, px, py, size, fill)`, where `fill` is a color string or the WILD gradient.

const SKIN_STORAGE_KEY = 'tetris.skin';
const DEFAULT_SKIN_ID = 'retro';
const PIXEL_TEXTURE = [
  'LLLLD',
  'L.L.D',
  'LL..D',
  'L...D',
  'DDDDD',
];

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    background: null,
    gridColor: null,
    drawCell: drawRetroCell,
  },
  neon: {
    name: 'Neón',
    colors: [
      null, '#00f0ff', '#fff200', '#d000ff', '#39ff14', '#ff073a', '#1f6bff', '#ff8c00',
      '#ffffff', '#ff10f0', '#00ffc8', '#b4ff00', '#ffff66', '#8899ff', '#4a4f6a',
    ],
    background: '#05050a',
    gridColor: '#15152a',
    drawCell: drawNeonCell,
  },
  pastel: {
    name: 'Pastel',
    colors: [
      null, '#a8e6f0', '#fdeca0', '#d9b8e8', '#b9e4c0', '#f6b8b8', '#bcd4f6', '#fbd3a8',
      '#ffffff', '#f7bcd6', '#a8ddd5', '#d4ebb0', '#fff5b8', '#c3ccd6', '#9aa0ab',
    ],
    background: null,
    gridColor: null,
    drawCell: drawPastelCell,
  },
  pixel: {
    name: 'Pixel',
    colors: [
      null, '#00bcd4', '#ffeb3b', '#9c27b0', '#4caf50', '#f44336', '#3f51b5', '#ff9800',
      '#ffffff', '#e91e63', '#009688', '#8bc34a', '#ffee58', '#78909c', '#555a66',
    ],
    background: null,
    gridColor: null,
    drawCell: drawPixelCell,
  },
};

let activeSkin = SKINS[DEFAULT_SKIN_ID];

function drawRetroCell(context, px, py, size, fill) {
  context.fillStyle = fill;
  context.fillRect(px, py, size, size);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, size, 4);
}

function drawNeonCell(context, px, py, size, fill) {
  const baseAlpha = context.globalAlpha;
  context.globalAlpha = baseAlpha * 0.25;
  context.fillStyle = fill;
  context.fillRect(px, py, size, size);
  context.globalAlpha = baseAlpha;
  context.shadowColor = typeof fill === 'string' ? fill : '#ffffff';
  context.shadowBlur = Math.max(4, size * 0.4);
  context.strokeStyle = fill;
  context.lineWidth = 2;
  context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  context.shadowBlur = 0;
}

function traceRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, radius);
    return;
  }
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawPastelCell(context, px, py, size, fill) {
  const radius = Math.max(2, size * 0.25);
  traceRoundedRect(context, px, py, size, size, radius);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.2)';
  context.lineWidth = 1;
  context.stroke();
  traceRoundedRect(context, px + size * 0.2, py + size * 0.15, size * 0.6, size * 0.2, size * 0.1);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
}

function drawPixelCell(context, px, py, size, fill) {
  context.fillStyle = fill;
  context.fillRect(px, py, size, size);
  const cells = PIXEL_TEXTURE.length;
  const edge = i => Math.round(i * size / cells);
  for (let r = 0; r < cells; r++)
    for (let c = 0; c < cells; c++) {
      const texel = PIXEL_TEXTURE[r][c];
      if (texel === '.') continue;
      context.fillStyle = texel === 'L' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
      context.fillRect(px + edge(c), py + edge(r), edge(c + 1) - edge(c), edge(r + 1) - edge(r));
    }
}

function paintSkinBackground(context) {
  const { width, height } = context.canvas;
  if (activeSkin.background) {
    context.fillStyle = activeSkin.background;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }
}

function buildSkinSelect() {
  for (const [id, skin] of Object.entries(SKINS)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = skin.name;
    skinSelect.appendChild(option);
  }
}

function loadStoredSkinId() {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeSkinId(skinId) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, skinId);
  } catch {
    // Storage may be unavailable (private mode); the skin still applies for this session.
  }
}

// Applies the skin and returns the id actually used (unknown ids fall back to the default).
function setSkin(id) {
  const skinId = resolveSkinId(id, Object.keys(SKINS), DEFAULT_SKIN_ID);
  activeSkin = SKINS[skinId];
  skinSelect.value = skinId;
  // Before the first game there is no piece to draw yet.
  if (current) {
    draw();
    drawNext();
  }
  return skinId;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size + 1, py = y * size + 1;
  context.globalAlpha = alpha ?? 1;
  const fill = colorIndex === WILD ? wildGradient(context, px, py, size) : activeSkin.colors[colorIndex];
  activeSkin.drawCell(context, px, py, size - 2, fill);
  context.globalAlpha = 1;
}

function drawPowerupBlock(context, x, y, power, size, alpha) {
  const style = POWERUP_STYLES[power];
  const px = x * size + 1, py = y * size + 1;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = '#12121c';
  context.fillRect(px, py, size - 2, size - 2);
  context.strokeStyle = style.color;
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, size - 4, size - 4);
  context.fillStyle = style.color;
  context.font = `bold ${Math.floor(size * 0.6)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(style.symbol, px + (size - 2) / 2, py + (size - 2) / 2 + 1);
  context.globalAlpha = 1;
}

function drawPiece(context, piece, ox, oy, size, alpha) {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      if (piece.power) drawPowerupBlock(context, ox + c, oy + r, piece.power, size, alpha);
      else drawBlock(context, ox + c, oy + r, piece.shape[r][c], size, alpha);
    }
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.gridColor || gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  paintSkinBackground(ctx);
  drawGrid();

  if (mode.hideLockedBlocks) {
    if (lockFlash) drawPiece(ctx, lockFlash.piece, lockFlash.piece.x, lockFlash.piece.y, BLOCK, lockFlash.remaining / LOCK_FLASH_MS);
  } else {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK);
    drawPiece(ctx, current, current.x, ghostY(), BLOCK, 0.2);
  }
  drawPiece(ctx, current, current.x, current.y, BLOCK);

  if (freezeRemaining > 0) {
    ctx.fillStyle = 'rgba(128, 216, 255, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawEffects();
}

function drawEffects() {
  if (flashRemaining > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 * flashRemaining / FLASH_MS})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px system-ui, sans-serif';
  for (const popup of popups) {
    const progress = 1 - popup.remaining / POPUP_MS;
    ctx.globalAlpha = Math.min(1, 2 * (1 - progress));
    ctx.fillStyle = '#ffd740';
    ctx.strokeStyle = '#0f0f17';
    ctx.lineWidth = 4;
    const y = canvas.height * 0.4 + popup.row * 34 - progress * 40;
    ctx.strokeText(popup.text, canvas.width / 2, y);
    ctx.fillText(popup.text, canvas.width / 2, y);
  }
  ctx.globalAlpha = 1;
}

function updateEffects(dt) {
  flashRemaining = Math.max(0, flashRemaining - dt);
  for (const popup of popups) popup.remaining -= dt;
  popups = popups.filter(popup => popup.remaining > 0);
}

// Draws a piece centered in a box of `cells` x `cells`, whose top starts at cell row `topCell`.
function drawPieceCentered(context, piece, size, cells, topCell = 0) {
  const offX = (cells - piece.shape[0].length) / 2;
  const offY = topCell + (4 - piece.shape.length) / 2;
  drawPiece(context, piece, offX, offY, size);
}

function drawNext() {
  paintSkinBackground(nextCtx);
  drawPieceCentered(nextCtx, queue[0], 30, 4);
  queueSection.classList.toggle('hidden', previewRemaining <= 0);
  if (previewRemaining > 0) {
    paintSkinBackground(queueCtx);
    queue.slice(0, 5).forEach((piece, i) => drawPieceCentered(queueCtx, piece, 15, 8, i * 4));
  }
  drawHold();
}

function drawHold() {
  paintSkinBackground(holdCtx);
  if (hold.piece) drawPieceCentered(holdCtx, hold.piece, 30, 4);
}

function showOverlay(title, subtitle, view) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', view === 'win');
  overlayScore.textContent = subtitle;
  modeMenu.classList.toggle('hidden', view !== 'menu');
  abilityMenuEl.classList.toggle('hidden', view !== 'abilities');
  endActions.classList.toggle('hidden', view !== 'end' && view !== 'win');
  overlay.classList.remove('hidden');
}

function endGame(won = false) {
  gameOver = true;
  cancelAnimationFrame(animId);
  showOverlay(won ? '¡OBJETIVO CUMPLIDO!' : 'GAME OVER', `Puntuación: ${score.toLocaleString()}`, won ? 'win' : 'end');
}

function showModeMenu() {
  gameOver = true;
  cancelAnimationFrame(animId);
  showOverlay('TETRIS', 'Elige modo de juego', 'menu');
}

function buildModeMenu() {
  for (const [id, { name, description }] of Object.entries(MODES)) {
    const button = document.createElement('button');
    button.className = 'mode-btn';
    button.innerHTML = `<strong>${name}</strong><span>${description}</span>`;
    button.addEventListener('click', () => init(id));
    modeMenu.appendChild(button);
  }
}

function riseGarbage() {
  const overflow = pushGarbageRow(board, Math.floor(Math.random() * COLS));
  playTone(110, 0.15);
  while (collide(board, current.shape, current.x, current.y) && current.y > -current.shape.length) current.y--;
  if (overflow || collide(board, current.shape, current.x, current.y)) endGame(false);
}

function updateChallenge(dt) {
  modeElapsed += dt;
  if (lockFlash) {
    lockFlash.remaining -= dt;
    if (lockFlash.remaining <= 0) lockFlash = null;
  }
  if (mode.garbageEveryMs) {
    garbageAccum += dt;
    if (garbageAccum >= mode.garbageEveryMs) {
      garbageAccum -= mode.garbageEveryMs;
      riseGarbage();
    }
  }
  if (!gameOver && mode.timeLimitMs && modeElapsed >= mode.timeLimitMs) endGame(mode.winOnTimeout);
}

function togglePause() {
  if (gameOver || abilityMenu) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showOverlay('PAUSA', '', 'pause');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  updateEffects(dt);
  updateChallenge(dt);
  if (previewRemaining > 0) {
    previewRemaining = Math.max(0, previewRemaining - dt);
    if (previewRemaining === 0) drawNext();
  }
  slowRemaining = Math.max(0, slowRemaining - dt);
  if (freezeRemaining > 0) {
    freezeRemaining = Math.max(0, freezeRemaining - dt);
  } else {
    dropAccum += dt;
  }
  if (!gameOver && dropAccum >= effectiveDropInterval(dropInterval, slowRemaining > 0)) {
    dropAccum = 0;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
      lastActionWasRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  updateHUD();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init(modeId = mode ? mode.id : 'classic') {
  mode = { id: modeId, ...MODES[modeId] };
  board = createBoard();
  mode.setup?.();
  startLevel = mode.startLevel ?? 1;
  modeElapsed = 0;
  garbageAccum = 0;
  lockFlash = null;
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalForLevel(level);
  dropAccum = 0;
  nextPowerupAtLines = POWERUP_EVERY_LINES;
  pendingPowerup = false;
  pendingReward = false;
  freezeRemaining = 0;
  combo = 0;
  b2bActive = false;
  lastActionWasRotate = false;
  popups = [];
  flashRemaining = 0;
  energy = 0;
  abilityMenu = null;
  previewRemaining = 0;
  slowRemaining = 0;
  undoSnapshot = null;
  hold = createHoldState();
  lastTime = performance.now();
  queue = [];
  refillQueue();
  spawn();
  modeNameEl.textContent = mode.name.toUpperCase();
  objectiveSection.classList.toggle('hidden', !mode.progress);
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { toggleSound(); return; }
  if (abilityMenu) { handleAbilityMenuKey(e); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      moveHorizontal(-1);
      break;
    case 'ArrowRight':
      moveHorizontal(1);
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      tryHold();
      break;
    case 'KeyE':
      openAbilityMenu();
      return;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => init());
menuBtn.addEventListener('click', showModeMenu);

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeBtn.textContent = t === 'light' ? '☀️' : '🌙';
  themeBtn.setAttribute('aria-label', t === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // Before the first game there is no piece to draw yet.
  if (current) {
    draw();
    drawNext();
  }
}

themeBtn.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur();
});

skinSelect.addEventListener('change', () => {
  storeSkinId(setSkin(skinSelect.value));
  skinSelect.blur();
});

// If the select keeps focus (e.g. closed with Esc), game keys must not step through skins mid-game.
skinSelect.addEventListener('keydown', e => {
  if (paused || gameOver) return;
  if (e.code.startsWith('Arrow') || e.code === 'Space') {
    e.preventDefault();
    skinSelect.blur();
  }
});

buildModeMenu();
buildSkinSelect();
setSkin(loadStoredSkinId());
setTheme('dark');
showModeMenu();
