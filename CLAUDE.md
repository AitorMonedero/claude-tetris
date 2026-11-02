# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

No hay build, linter ni gestor de paquetes. No existe `package.json`. Para ejecutar el juego:

- Abrir `index.html` directamente en el navegador, o
- `npx serve .` (o `python3 -m http.server 8000`) y visitar el puerto correspondiente.

Tests (sin dependencias) de la lógica pura de `logic.js`:

- Navegador: abrir `tests.html`.
- Terminal: `node tests/run-node.js` (ejecuta los mismos scripts que carga `tests.html`).

Los tests nuevos van en `tests/*.test.js` y deben añadirse como `<script>` en `tests.html`. El resto (render, input) se verifica jugando en el navegador.

## Arquitectura

Tetris en HTML5 Canvas (tablero de 10×20 celdas, canvas de 300×600) con JavaScript plano, sin dependencias ni bundler. `index.html` define el DOM y carga `logic.js` y `game.js` al final del `body`; `style.css` solo aporta el tema visual.

- **`logic.js`**: reglas puras sin DOM ni estado global (`COLS`, `ROWS`, `LINE_SCORES`, `createBoard`, `collide`, `rotateCW`, `clearFullRows`, `levelForLines`, `dropIntervalForLevel`, `lineClearScore`). Reciben el tablero como parámetro. Toda lógica de negocio nueva debería ir aquí, con su test.
- **`game.js`**: estado global, loop, render e input; usa las funciones de `logic.js`.

- **Estado global**: `board` (matriz `ROWS × COLS` con `0` o un índice de color, ver **Piezas**), `current` y `next` (objetos `{ type, shape, x, y }`), `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`. Todo se reinicia en `init()`, que también se ejecuta al cargar el script y desde el botón de reinicio.
- **Piezas**: `PIECES` y `COLORS` están indexados por el mismo `type`. El color de cada celda sale del valor guardado en la matriz, así que el índice de color y el tipo de pieza son el mismo número. Índices: 1–7 tetrominós estándar, 8 `WILD` (solo color, `PIECES[8]` es `null`), 9–11 pentominós +/U/Y, 12 single, 13 hueca 3×3. `randomPiece()` prioriza `pendingPowerup`, luego `pendingReward` (single tras un Tetris) y si no usa `pickPieceType(level)` de `logic.js` (`PENTOMINO_CHANCE`, `HOLLOW_CHANCE` desde `HOLLOW_MIN_LEVEL`). El preview es de 4×4: ninguna pieza puede ser mayor.
- **Loop**: `loop(ts)` se encarga de la caída por tiempo (`dropAccum` contra `dropInterval`), llama a `draw()` y se reprograma con `requestAnimationFrame`. Pausa y reanudación se gestionan en `togglePause()`, que cancela o relanza el loop.
- **Colisiones**: `collide(board, shape, ox, oy)` es el único punto de verdad: fuera de límites por los lados o por abajo y solapamiento con `board` son colisión. Las filas por encima del tablero (`ny < 0`) se permiten para que las piezas puedan aparecer parcialmente fuera.
- **Rotación**: `rotateCW` gira la matriz; `tryRotate` prueba desplazamientos `[0, -1, 1, -2, 2]` en X antes de descartar el giro.
- **Bloqueo de pieza**: `lockPiece()` encadena `merge()` → `clearLines()` → `spawn()`. `spawn()` promueve `next` a `current`, genera una nueva `next` y, si la pieza ya colisiona, llama a `endGame()`.
- **Puntuación y progresión**: `clearLines()` usa `clearFullRows()` y aplica `lineClearScore()` (`LINE_SCORES[n] × level`), recalcula el nivel con `levelForLines()` (`floor(lines / 10) + 1`) y la velocidad con `dropIntervalForLevel()` (`max(100, 1000 − (level − 1) × 90)` ms). Hard drop suma 2 puntos por celda recorrida y soft drop 1 por fila.
- **Combos y bonus**: `lockPiece()` calcula `isTSpin()` (regla de 3 esquinas, solo si `lastActionWasRotate`) *antes* de fusionar la pieza y lo pasa a `clearLines(tspin)`. `combo` cuenta bloqueos consecutivos que limpian líneas (se pone a 0 al bloquear sin limpiar); `b2bActive` recuerda si la última limpieza fue "difícil" (`isDifficultClear`). Toda la puntuación de una limpieza sale de `computeClearScore()` en `logic.js` (combo ×N con tope `COMBO_MAX_MULTIPLIER`, B2B ×1.5, Perfect Clear, comodines). Cualquier movimiento lateral, caída o spawn pone `lastActionWasRotate = false`.
- **Efectos**: `announce()` añade textos a `popups` (dibujados en `drawEffects()` al final de `draw()`), activa `flashRemaining` y suena con `playTone()` (Web Audio, sin assets; el `AudioContext` se crea en el primer sonido). `updateEffects(dt)` los envejece desde `loop()`. `KeyM` alterna el sonido.
- **Power-ups**: cada `POWERUP_EVERY_LINES` líneas (`nextPowerupAtLines`), `clearLines()` activa `pendingPowerup` y `randomPiece()` genera una pieza 1×1 con campo `power` (`bomb`, `lightning`, `tint`, `gravity`, `freeze`). Esa pieza nunca se fusiona en `board`: `lockPiece()` llama a `applyPowerup()` (funciones `applyBomb`, `applyLightning`, `applyTint`, `applyGravity` de `logic.js`) y después a `clearLines()`. `freeze` usa `freezeRemaining`, que `loop()` descuenta en lugar de acumular `dropAccum`. El tinte convierte un color en `WILD` (índice 8): cuenta como bloque normal y da `WILD_BONUS × level` por celda al limpiarse.
- **Render**: `draw()` repinta en este orden: rejilla, tablero fijado, pieza fantasma (`ghostY()`, alfa 0.2) y pieza actual. Las piezas se pintan con `drawPiece()`, que delega en `drawBlock()` o `drawPowerupBlock()` (símbolos de `POWERUP_STYLES`). La vista previa se dibuja aparte en `drawNext()`, sobre `#next-canvas`.
- **Input**: un único listener de `keydown` en `document`. `KeyP` (pausa) y `KeyM` (sonido) funcionan siempre; el resto de teclas se ignoran mientras `paused` o `gameOver` estén activos. Tras cada tecla se llama a `updateHUD()`.

## Gotchas

- `loop()` no reprograma el frame si `gameOver` es true tras la caída. Cualquier cambio en el flujo de fin de partida debe mantener esa comprobación.
- Los tamaños del canvas en `index.html` (`width`/`height`) deben coincidir con `COLS × BLOCK` y `ROWS × BLOCK` si se cambian las constantes de `game.js`.
- No hay módulos: las constantes y funciones de `logic.js` y `game.js` comparten el ámbito global del navegador (`COLS`, `ROWS`, `LINE_SCORES` en `logic.js`; `BLOCK`, `COLORS`, `PIECES` en `game.js`). No redeclarar un `const` en ambos ficheros. `logic.js` debe cargarse antes que `game.js`.
- El idioma de la UI es español; el texto del overlay de game over está en inglés (`GAME OVER`).
