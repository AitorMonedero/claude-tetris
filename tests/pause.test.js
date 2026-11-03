'use strict';

test('clampStartLevel keeps valid levels and rounds', () => {
  assertEqual(clampStartLevel(1), 1);
  assertEqual(clampStartLevel(7), 7);
  assertEqual(clampStartLevel(START_LEVEL_MAX), START_LEVEL_MAX);
  assertEqual(clampStartLevel(3.6), 4);
  assertEqual(clampStartLevel('9'), 9);
});

test('clampStartLevel bounds out-of-range and invalid values', () => {
  assertEqual(clampStartLevel(0), START_LEVEL_MIN);
  assertEqual(clampStartLevel(-4), START_LEVEL_MIN);
  assertEqual(clampStartLevel(99), START_LEVEL_MAX);
  assertEqual(clampStartLevel(NaN), START_LEVEL_MIN);
  assertEqual(clampStartLevel(undefined), START_LEVEL_MIN);
  assertEqual(clampStartLevel(null), START_LEVEL_MIN);
  assertEqual(clampStartLevel('abc'), START_LEVEL_MIN);
  assertEqual(clampStartLevel(Infinity), START_LEVEL_MAX);
  assertEqual(clampStartLevel(-Infinity), START_LEVEL_MIN);
});

test('startLevelForMode uses the higher of mode minimum and preference', () => {
  assertEqual(startLevelForMode(undefined, 1), 1);
  assertEqual(startLevelForMode(undefined, 8), 8);
  assertEqual(startLevelForMode(4, 1), 4);
  assertEqual(startLevelForMode(4, 10), 10);
  assertEqual(startLevelForMode(undefined, 40), START_LEVEL_MAX);
  assertEqual(startLevelForMode(4, 'garbage'), 4);
});

test('wrapMenuIndex cycles in both directions', () => {
  assertEqual(wrapMenuIndex(0, 1, 4), 1);
  assertEqual(wrapMenuIndex(3, 1, 4), 0);
  assertEqual(wrapMenuIndex(0, -1, 4), 3);
  assertEqual(wrapMenuIndex(2, -1, 4), 1);
});
