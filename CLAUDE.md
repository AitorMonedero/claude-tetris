# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

No hay build, linter, gestor de paquetes ni suite de tests. No existe `package.json`. Para ejecutar el juego:

- Abrir `index.html` directamente en el navegador, o
- `npx serve .` (o `python3 -m http.server 8000`) y visitar el puerto correspondiente.

Al no haber tests, la verificación de cambios se hace jugando en el navegador.

## Arquitectura

Tetris en HTML5 Canvas (tablero de 10×20 celdas, canvas de 300×600) con JavaScript plano, sin dependencias ni bundler. `index.html` define el DOM y carga `game.js` al final del `body`; `style.css` solo aporta el tema visual.

- **Estado global**: `board` (matriz `ROWS × COLS` con `0` o un índice de color 1–7), `current` y `next` (objetos `{ type, shape, x, y }`), `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`. Todo se reinicia en `init()`, que también se ejecuta al cargar el script y desde el botón de reinicio.
- **Piezas**: `PIECES` y `COLORS` están indexados por el mismo `type`. El color de cada celda sale del valor guardado en la matriz, así que el índice de color y el tipo de pieza son el mismo número.
- **Loop**: `loop(ts)` se encarga de la caída por tiempo (`dropAccum` contra `dropInterval`), llama a `draw()` y se reprograma con `requestAnimationFrame`. Pausa y reanudación se gestionan en `togglePause()`, que cancela o relanza el loop.
- **Colisiones**: `collide(shape, ox, oy)` es el único punto de verdad: fuera de límites por los lados o por abajo y solapamiento con `board` son colisión. Las filas por encima del tablero (`ny < 0`) se permiten para que las piezas puedan aparecer parcialmente fuera.
- **Rotación**: `rotateCW` gira la matriz; `tryRotate` prueba desplazamientos `[0, -1, 1, -2, 2]` en X antes de descartar el giro.
- **Bloqueo de pieza**: `lockPiece()` encadena `merge()` → `clearLines()` → `spawn()`. `spawn()` promueve `next` a `current`, genera una nueva `next` y, si la pieza ya colisiona, llama a `endGame()`.
- **Puntuación y progresión**: `clearLines()` aplica `LINE_SCORES[n] × level`, recalcula el nivel (`floor(lines / 10) + 1`) y la velocidad (`max(100, 1000 − (level − 1) × 90)` ms). Hard drop suma 2 puntos por celda recorrida y soft drop 1 por fila.
- **Render**: `draw()` repinta en este orden: rejilla, tablero fijado, pieza fantasma (`ghostY()`, alfa 0.2) y pieza actual. La vista previa se dibuja aparte en `drawNext()`, sobre `#next-canvas`.
- **Input**: un único listener de `keydown` en `document`. `KeyP` alterna la pausa y funciona siempre; el resto de teclas se ignoran mientras `paused` o `gameOver` estén activos. Tras cada tecla se llama a `updateHUD()`.

## Gotchas

- `loop()` no reprograma el frame si `gameOver` es true tras la caída. Cualquier cambio en el flujo de fin de partida debe mantener esa comprobación.
- Los tamaños del canvas en `index.html` (`width`/`height`) deben coincidir con `COLS × BLOCK` y `ROWS × BLOCK` si se cambian las constantes de `game.js`.
- Las constantes (`COLS`, `ROWS`, `BLOCK`, `LINE_SCORES`, velocidades) son `const` globales de `game.js`, no hay módulos.
- El idioma de la UI es español; el texto del overlay de game over está en inglés (`GAME OVER`).
