'use strict';

function sequence(...values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('pickPieceType returns a standard piece on a normal roll', () => {
  assertEqual(pickPieceType(1, sequence(0.5, 0)), 1);
  assertEqual(pickPieceType(1, sequence(0.99, 0.99)), 7);
});

test('pickPieceType returns a pentomino on a low roll', () => {
  assertEqual(pickPieceType(1, sequence(0.05, 0)), 9);
  assertEqual(pickPieceType(1, sequence(0.05, 0.99)), 11);
});

test('pickPieceType only returns the hollow piece from its minimum level', () => {
  assertEqual(PENTOMINO_TYPES.includes(pickPieceType(HOLLOW_MIN_LEVEL - 1, sequence(0.01, 0))), true);
  assertEqual(pickPieceType(HOLLOW_MIN_LEVEL, sequence(0.01, 0)), HOLLOW_TYPE);
});

test('pickPieceType never returns the reward-only single piece', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(pickPieceType(10));
  assertEqual(seen.has(SINGLE_TYPE), false);
  assertEqual(seen.has(WILD), false);
});
