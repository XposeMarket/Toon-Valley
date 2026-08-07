import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../town-activities.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /makeFishingSpot/);
assert.match(source, /Fresh catch/);
assert.match(source, /makeCourierStop/);
assert.match(source, /Courier route bonus/);
assert.match(source, /fishingDay/);
assert.match(source, /courierDay/);
assert.match(source, /try \{ localStorage\.setItem/);
assert.match(source, /ToonValleyTownActivities/);
assert.match(html, /town-activities\.js/);
assert.match(sw, /toon-valley-v8/);
assert.match(sw, /town-activities\.js/);
console.log('town activities static checks passed');
