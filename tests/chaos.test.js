'use strict';

// Deterministic pseudo-random sequence (LCG) so chaos tests are reproducible.
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function shapeCells(shape) {
  const cells = [];
  shape.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([r, c]); }));
  return cells;
}

function isConnected(cells) {
  const key = ([r, c]) => `${r},${c}`;
  const remaining = new Set(cells.map(key));
  const stack = [cells[0]];
  remaining.delete(key(cells[0]));
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const next of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
      if (remaining.delete(key(next))) stack.push(next);
    }
  }
  return remaining.size === 0;
}

test('generateRandomPolyomino builds connected 3 or 5 cell shapes that fit the 4x4 preview', () => {
  const random = seededRandom(42);
  for (let i = 0; i < 200; i++) {
    const shape = generateRandomPolyomino(random);
    const cells = shapeCells(shape);
    assertTrue(CHAOS_SHAPE_SIZES.includes(cells.length), `cell count ${cells.length}`);
    assertTrue(shape.length <= 4 && shape[0].length <= 4, 'fits in 4x4');
    assertTrue(isConnected(cells), 'cells are connected');
  }
});

test('generateRandomPolyomino trims empty edges and uses a single valid color', () => {
  const random = seededRandom(7);
  for (let i = 0; i < 100; i++) {
    const shape = generateRandomPolyomino(random);
    assertTrue(shape[0].some(v => v) && shape[shape.length - 1].some(v => v), 'no empty top/bottom row');
    assertTrue(shape.some(row => row[0]) && shape.some(row => row[row.length - 1]), 'no empty left/right column');
    const colors = new Set(shape.flat().filter(v => v));
    assertEqual(colors.size, 1, 'one color');
    assertTrue(CHAOS_COLOR_TYPES.includes([...colors][0]), 'known color');
  }
});

test('rollChaosTraits picks a listed speed and a bounded auto-rotation', () => {
  const random = seededRandom(3);
  let sawAutoRotate = false, sawRandomShape = false;
  for (let i = 0; i < 200; i++) {
    const { speedFactor, autoRotateMs, randomShape } = rollChaosTraits(random);
    assertTrue(CHAOS_SPEED_FACTORS.includes(speedFactor), 'listed speed');
    assertTrue(autoRotateMs === 0
      || (autoRotateMs >= CHAOS_AUTO_ROTATE_MIN_MS && autoRotateMs < CHAOS_AUTO_ROTATE_MIN_MS + CHAOS_AUTO_ROTATE_SPREAD_MS),
      `auto-rotate ${autoRotateMs}`);
    sawAutoRotate ||= autoRotateMs > 0;
    sawRandomShape ||= randomShape;
  }
  assertTrue(sawAutoRotate && sawRandomShape, 'both traits appear');
});

test('rollChaosTraits honours the chances at the extremes', () => {
  assertEqual(rollChaosTraits(() => 0), { speedFactor: CHAOS_SPEED_FACTORS[0], autoRotateMs: CHAOS_AUTO_ROTATE_MIN_MS, randomShape: true });
  assertEqual(rollChaosTraits(() => 0.99).autoRotateMs, 0);
  assertEqual(rollChaosTraits(() => 0.99).randomShape, false);
});

test('chaosDropInterval scales the interval with a floor', () => {
  assertEqual(chaosDropInterval(1000, 0.4), 400);
  assertEqual(chaosDropInterval(1000, 2.5), 2500);
  assertEqual(chaosDropInterval(100, 0.4), CHAOS_MIN_DROP_MS);
  assertEqual(chaosDropInterval(800), 800);
});

test('pickChaosEvent never repeats the previous event', () => {
  const random = seededRandom(11);
  let previous = null;
  for (let i = 0; i < 100; i++) {
    const event = pickChaosEvent(random, previous);
    assertTrue(CHAOS_EVENTS.includes(event), 'known event');
    assertTrue(event !== previous, 'different from previous');
    previous = event;
  }
});

test('applyControlInversion flips the direction only when inverted', () => {
  assertEqual(applyControlInversion(-1, false), -1);
  assertEqual(applyControlInversion(-1, true), 1);
  assertEqual(applyControlInversion(1, true), -1);
});
