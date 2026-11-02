'use strict';

// Runs the browser test suite in Node: `node tests/run-node.js`.
// Scripts are concatenated into one vm context to mimic sharing the page's global scope.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'tests.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const source = scripts.map(src => fs.readFileSync(path.join(root, src), 'utf8')).join('\n;\n')
  + '\nreportResults();';
vm.runInNewContext(source, { console, process, performance }, { filename: 'tests-bundle.js' });
