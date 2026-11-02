'use strict';

const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerupAtLines, pendingPowerup, freezeRemaining, pendingReward;
let combo, b2bActive, lastActionWasRotate, popups, flashRemaining;

const POPUP_MS = 1200;
const FLASH_MS = 250;
const TSPIN_NAMES = ['T-SPIN', 'T-SPIN SINGLE', 'T-SPIN DOUBLE', 'T-SPIN TRIPLE'];

let mode = null, startLevel, modeElapsed, garbageAccum, lockFlash;

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
  if (pendingPowerup) {
    pendingPowerup = false;
    return powerupPiece(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]);
  }
  if (pendingReward) {
    pendingReward = false;
    return pieceOfType(SINGLE_TYPE);
  }
  return pieceOfType(pickPieceType(level));
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

function lockPiece() {
  const tspin = !current.power && lastActionWasRotate && isTSpin(board, current);
  if (mode.hideLockedBlocks) lockFlash = { piece: { ...current }, remaining: LOCK_FLASH_MS };
  if (current.power) applyPowerup(current);
  else merge();
  clearLines(tspin);
  spawn();
  if (!gameOver && mode.isWon?.()) endGame(true);
}

function spawn() {
  current = next;
  lastActionWasRotate = false;
  next = randomPiece();
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
  else if (next.power) effectEl.textContent = `¡${POWERUP_STYLES[next.power].label}!`;
  else effectEl.textContent = `en ${nextPowerupAtLines - lines} líneas`;
}

function wildGradient(context, px, py, size) {
  const gradient = context.createLinearGradient(px, py, px + size, py + size);
  ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'].forEach((color, i, all) =>
    gradient.addColorStop(i / (all.length - 1), color));
  return gradient;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const px = x * size + 1, py = y * size + 1;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = colorIndex === WILD ? wildGradient(context, px, py, size) : COLORS[colorIndex];
  context.fillRect(px, py, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px, py, size - 2, 4);
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
  ctx.strokeStyle = '#22222e';
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const offX = Math.floor((4 - next.shape[0].length) / 2);
  const offY = Math.floor((4 - next.shape.length) / 2);
  drawPiece(nextCtx, next, offX, offY, NB);
}

function showOverlay(title, subtitle, view) {
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', view === 'win');
  overlayScore.textContent = subtitle;
  modeMenu.classList.toggle('hidden', view !== 'menu');
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
  if (gameOver) return;
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
  if (freezeRemaining > 0) {
    freezeRemaining = Math.max(0, freezeRemaining - dt);
  } else {
    dropAccum += dt;
  }
  if (!gameOver && dropAccum >= dropInterval) {
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
  lastTime = performance.now();
  next = randomPiece();
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
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => init());
menuBtn.addEventListener('click', showModeMenu);

buildModeMenu();
showModeMenu();
