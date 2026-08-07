import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../valley-routines.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /makeNoticeBoard/);
assert.match(source, /currentErrand/);
assert.match(source, /Library Book Return/);
assert.match(source, /Garden Seed Delivery/);
assert.match(source, /Fire Station Supply Run/);
assert.match(source, /state\.stage\s*=\s*1/);
assert.match(source, /state\.stage\s*=\s*2/);
assert.match(source, /state\.stage\s*=\s*3/);
assert.match(source, /Return to the notice board to finish the job/);
assert.match(source, /accept-pickup-deliver-return-signoff/);
assert.match(source, /makeStreetLamp/);
assert.match(source, /hour\s*>=\s*18\.5\s*\|\|\s*hour\s*<\s*6\.5/);
assert.match(source, /w\.weather\s*===\s*'foggy'/);
assert.match(source, /Life\.emitProgress\('help',\s*2/);
assert.match(source, /ToonValleyRoutines/);
assert.match(html, /valley-routines\.js/);
assert.match(sw, /const CACHE_NAME = 'toon-valley-v\d+'/);
assert.match(sw, /valley-routines\.js/);
console.log('valley routines static checks passed');
