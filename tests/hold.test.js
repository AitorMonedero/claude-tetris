'use strict';

const freshCopy = piece => ({ ...piece, x: 4, y: 0, shape: 'spawn' });

test('applyHold stores the current piece and takes the next one when empty', () => {
  const hold = createHoldState();
  const result = applyHold(hold, { type: 1, x: 7, y: 9 }, () => ({ type: 2 }), freshCopy);
  assertEqual(result, { type: 2 });
  assertEqual(hold.piece, { type: 1, x: 4, y: 0, shape: 'spawn' });
});

test('applyHold swaps with the held piece when the slot is occupied', () => {
  const hold = createHoldState();
  hold.piece = { type: 3 };
  const result = applyHold(hold, { type: 5 }, () => { throw new Error('queue must not be used'); }, freshCopy);
  assertEqual(result.type, 3);
  assertEqual(hold.piece.type, 5);
});

test('applyHold can only be used once per piece', () => {
  const hold = createHoldState();
  applyHold(hold, { type: 1 }, () => ({ type: 2 }), freshCopy);
  assertEqual(applyHold(hold, { type: 2 }, () => ({ type: 3 }), freshCopy), null);
  assertEqual(hold.piece.type, 1);
  resetHoldForNewPiece(hold);
  assertTrue(applyHold(hold, { type: 4 }, () => ({ type: 5 }), freshCopy) !== null, 'unlocked for the new piece');
});

test('grantExtraHold allows one more hold in the same turn', () => {
  const hold = createHoldState();
  applyHold(hold, { type: 1 }, () => ({ type: 2 }), freshCopy);
  grantExtraHold(hold);
  assertEqual(applyHold(hold, { type: 2 }, () => ({ type: 9 }), freshCopy).type, 1);
  assertEqual(hold.usesLeft, 0);
});
