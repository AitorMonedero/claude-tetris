'use strict';

const recordWithScore = (score, name = 'AAA') =>
  ({ name, score, lines: 10, maxCombo: 2, mode: 'Clásico', date: '2026-01-01' });

test('qualifiesForTop accepts any positive score while the table is not full', () => {
  assertTrue(qualifiesForTop([], 1), 'empty table');
  assertTrue(qualifiesForTop([recordWithScore(900)], 10, 5), 'below the only record but table not full');
  assertTrue(!qualifiesForTop([], 0), 'zero never qualifies');
});

test('qualifiesForTop requires beating the last record when the table is full', () => {
  const full = [500, 400, 300, 200, 100].map(score => recordWithScore(score));
  assertTrue(qualifiesForTop(full, 101), 'beats the last one');
  assertTrue(!qualifiesForTop(full, 100), 'a tie does not qualify');
  assertTrue(!qualifiesForTop(full, 50), 'below the last one');
});

test('insertRecord places the entry by score and returns its index', () => {
  const records = [300, 100].map(score => recordWithScore(score));
  const { records: updated, index } = insertRecord(records, recordWithScore(200, 'NEW'));
  assertEqual(updated.map(r => r.score), [300, 200, 100]);
  assertEqual(index, 1);
  assertEqual(records.length, 2, 'the original list is not mutated');
});

test('insertRecord keeps older records ahead on ties and trims to the limit', () => {
  const full = [500, 400, 300, 200, 100].map(score => recordWithScore(score));
  const tie = insertRecord(full, recordWithScore(300, 'NEW'));
  assertEqual(tie.index, 3);
  assertEqual(tie.records.map(r => r.score), [500, 400, 300, 300, 200]);
  const tooLow = insertRecord(full, recordWithScore(100, 'NEW'));
  assertEqual(tooLow.index, -1);
  assertEqual(tooLow.records.map(r => r.name), ['AAA', 'AAA', 'AAA', 'AAA', 'AAA']);
});

test('insertRecord appends at the end when the table has room', () => {
  const { records, index } = insertRecord([recordWithScore(300)], recordWithScore(10, 'NEW'));
  assertEqual(index, 1);
  assertEqual(records[1].name, 'NEW');
});

test('sanitizeRecords discards malformed input and entries', () => {
  assertEqual(sanitizeRecords(null), []);
  assertEqual(sanitizeRecords('oops'), []);
  assertEqual(sanitizeRecords({ score: 5 }), []);
  const raw = [
    recordWithScore(100),
    { name: 'BAD', score: 'lots', lines: 1, maxCombo: 0, mode: 'x', date: 'y' },
    { name: 'NEG', score: -5, lines: 1, maxCombo: 0, mode: 'x', date: 'y' },
    null,
    { score: 50 },
  ];
  assertEqual(sanitizeRecords(raw).map(r => r.score), [100]);
});

test('sanitizeRecords sorts, trims to the limit and normalizes names', () => {
  const raw = [10, 60, 30, 50, 20, 40].map(score => recordWithScore(score, '  a very long player name '));
  const result = sanitizeRecords(raw);
  assertEqual(result.map(r => r.score), [60, 50, 40, 30, 20]);
  assertEqual(result[0].name, 'a very long ');
  assertEqual(sanitizeRecords([{ ...recordWithScore(5), extra: 'drop me' }])[0].extra, undefined);
});

test('normalizeRecordName trims, caps the length and falls back to a default', () => {
  assertEqual(normalizeRecordName('  Ana  '), 'Ana');
  assertEqual(normalizeRecordName('ABCDEFGHIJKLMNOP').length, RECORD_NAME_MAX);
  assertEqual(normalizeRecordName('   '), RECORD_DEFAULT_NAME);
  assertEqual(normalizeRecordName(undefined), RECORD_DEFAULT_NAME);
});

test('updateBests keeps the all-time maximum of each stat', () => {
  assertEqual(updateBests({ lines: 30, maxCombo: 2 }, { lines: 12, maxCombo: 5 }), { lines: 30, maxCombo: 5 });
  assertEqual(updateBests(null, { lines: 4, maxCombo: 1 }), { lines: 4, maxCombo: 1 });
  assertEqual(updateBests({ lines: 'x', maxCombo: -3 }, { lines: 0, maxCombo: 0 }), { lines: 0, maxCombo: 0 });
});

test('sanitizeBests defaults missing or invalid values to zero', () => {
  assertEqual(sanitizeBests(undefined), { lines: 0, maxCombo: 0 });
  assertEqual(sanitizeBests({ lines: 7, maxCombo: Infinity }), { lines: 7, maxCombo: 0 });
});
