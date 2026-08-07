import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../central-plaza.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /Make a wish at the fountain/);
assert.match(source, /Visit the farmers market/);
assert.match(source, /Market tasting survey/);
assert.match(source, /picnicTables: 4/);
assert.match(source, /ToonValleyCentralPlaza/);
assert.match(html, /central-plaza\.js/);
assert.match(sw, /central-plaza\.js/);
console.log('central plaza static checks passed');
