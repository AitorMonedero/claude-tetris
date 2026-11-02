'use strict';

// Minimal dependency-free test runner. Works in the browser (tests.html) and in Node.

const testResults = [];

function test(name, fn) {
  try {
    fn();
    testResults.push({ name, passed: true });
  } catch (err) {
    testResults.push({ name, passed: false, message: err.message });
  }
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'assertEqual'}: expected ${e}, got ${a}`);
}

function assertTrue(value, message) {
  if (!value) throw new Error(message || 'expected truthy value');
}

function boardFromRows(rows) {
  // Builds a full board where the given rows (strings of '.'/digits) sit at the bottom.
  const board = createBoard();
  const offset = ROWS - rows.length;
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => { board[offset + r][c] = ch === '.' ? 0 : Number(ch); });
  });
  return board;
}

function reportResults() {
  const failed = testResults.filter(t => !t.passed);
  if (typeof document !== 'undefined') {
    const summary = document.getElementById('summary');
    summary.textContent = `${testResults.length - failed.length}/${testResults.length} tests OK`;
    summary.className = failed.length ? 'fail' : 'pass';
    const list = document.getElementById('results');
    for (const t of testResults) {
      const li = document.createElement('li');
      li.className = t.passed ? 'pass' : 'fail';
      li.textContent = t.passed ? `✔ ${t.name}` : `✘ ${t.name} — ${t.message}`;
      list.appendChild(li);
    }
  } else {
    for (const t of testResults) console.log(t.passed ? `ok   ${t.name}` : `FAIL ${t.name} — ${t.message}`);
    console.log(`${testResults.length - failed.length}/${testResults.length} tests OK`);
    if (failed.length) process.exitCode = 1;
  }
}
