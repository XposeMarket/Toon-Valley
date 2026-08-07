import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../valley-routines.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /makeNoticeBoard/);
assert.match(source, /currentErrand/);
assert.match(source, /Library book drop/);
assert.match(source, /Garden seed delivery/);
assert.match(source, /Fire station supply check/);
assert.match(source, /makeStreetLamp/);
assert.match(source, /hour >= 18\.5 \|\| hour < 6\.5/);
assert.match(source, /w\.weather === 'foggy'/);
assert.match(source, /Life\.emitProgress\('help', 2/);
assert.match(source, /ToonValleyRoutines/);
assert.match(html, /valley-routines\.js/);
assert.match(sw, /const CACHE_NAME = 'toon-valley-v\d+'/);
assert.match(sw, /valley-routines\.js/);
console.log('valley routines static checks passed');
