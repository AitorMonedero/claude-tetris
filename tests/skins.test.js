'use strict';

// Block scope keeps the fixture out of the global scope shared by all test scripts.
{
  const skinIds = ['retro', 'neon', 'pastel', 'pixel'];

  test('resolveSkinId keeps a stored skin that is available', () => {
    assertEqual(resolveSkinId('neon', skinIds, 'retro'), 'neon');
    assertEqual(resolveSkinId('pixel', skinIds, 'retro'), 'pixel');
  });

  test('resolveSkinId falls back when nothing is stored', () => {
    assertEqual(resolveSkinId(null, skinIds, 'retro'), 'retro');
    assertEqual(resolveSkinId(undefined, skinIds, 'retro'), 'retro');
    assertEqual(resolveSkinId('', skinIds, 'retro'), 'retro');
  });

  test('resolveSkinId falls back for unknown or differently cased skins', () => {
    assertEqual(resolveSkinId('vaporwave', skinIds, 'retro'), 'retro');
    assertEqual(resolveSkinId('NEON', skinIds, 'retro'), 'retro');
  });

  test('resolveSkinId ignores non-string values', () => {
    assertEqual(resolveSkinId(42, skinIds, 'retro'), 'retro');
    assertEqual(resolveSkinId(['neon'], skinIds, 'retro'), 'retro');
  });
}
