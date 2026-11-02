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
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const effectEl = document.getElementById('effect');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerupAtLines, pendingPowerup, freezeRemaining;

function pieceAtSpawn(type, shape) {
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  if (pendingPowerup) {
    pendingPowerup = false;
    return powerupPiece(POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]);
  }
  const type = Math.floor(Math.random() * 7) + 1;
  return pieceAtSpawn(type, PIECES[type].map(row => [...row]));
}

function powerupPiece(power) {
  return { ...pieceAtSpawn(0, [[1]]), power };
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(board, rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
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

function clearLines() {
  const wildCleared = countWildInFullRows(board);
  const cleared = clearFullRows(board);
  if (cleared) {
    lines += cleared;
    score += lineClearScore(cleared, level) + wildCleared * WILD_BONUS * level;
    level = levelForLines(lines);
    dropInterval = dropIntervalForLevel(level);
    if (lines >= nextPowerupAtLines) {
      pendingPowerup = true;
      nextPowerupAtLines += POWERUP_EVERY_LINES;
    }
    updateHUD();
  }
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

function ghostY() {
  let gy = current.y;
  while (!collide(board, current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(board, current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.power) applyPowerup(current);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
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

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  drawPiece(ctx, current, current.x, ghostY(), BLOCK, 0.2);
  drawPiece(ctx, current, current.x, current.y, BLOCK);

  if (freezeRemaining > 0) {
    ctx.fillStyle = 'rgba(128, 216, 255, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const offX = Math.floor((4 - next.shape[0].length) / 2);
  const offY = Math.floor((4 - next.shape.length) / 2);
  drawPiece(nextCtx, next, offX, offY, NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
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
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeRemaining > 0) {
    freezeRemaining = Math.max(0, freezeRemaining - dt);
    updateHUD();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(board, current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  nextPowerupAtLines = POWERUP_EVERY_LINES;
  pendingPowerup = false;
  freezeRemaining = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(board, current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(board, current.shape, current.x + 1, current.y)) current.x++;
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

restartBtn.addEventListener('click', init);

init();
