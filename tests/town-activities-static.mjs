import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../town-activities.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /makeFishingSpot/);
assert.match(source, /Fresh catch/);
assert.match(source, /curved-line-and-bobber/);
assert.match(source, /new THREE\.Line/);
assert.match(source, /Fish from shore/);
assert.match(source, /\[\[88,-68\],\[103,-60\],\[128,-62\],\[141,-82\]\]/);
assert.match(source, /makeCourierStop/);
assert.match(source, /courierReturning/);
assert.match(source, /Check courier desk/);
assert.match(source, /return to the Post Office for payment/);
assert.match(source, /pickup-deliver-return-signoff/);
assert.match(source, /fishingDay/);
assert.match(source, /courierDay/);
assert.match(source, /try\s*\{\s*localStorage\.setItem/);
assert.match(source, /ToonValleyTownActivities/);
assert.match(html, /town-activities\.js/);
assert.match(sw, /toon-valley-v\d+/);
assert.match(sw, /town-activities\.js/);
console.log('town activities static checks passed');
