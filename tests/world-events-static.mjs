import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../world-events.js', import.meta.url), 'utf8');
new vm.Script(source, { filename: 'world-events.js' });

for (const required of [
  "prompt:'Pick up litter'",
  'Cleanup bag is full',
  'Turn in the cleanup bag',
  'Sell gathered berry basket',
  'Basket full! Take the berries',
  'collect-then-market-hand-in',
  'collect-then-recycling-hand-in',
  'Valley bird survey',
  'resetDailyCleanup',
  'resetDailyBirdwatching',
  'LEGACY_STORAGE_KEYS',
  'window.ToonValleyWorldEvents'
]) {
  assert.ok(source.includes(required), `Missing expected world-event behavior: ${required}`);
}

const litterLocations = source.match(/makeLitter\(p\[0\],p\[1\],i\)/g) || [];
const birdLocations = source.match(/makeBirdSpot\(p\[0\],p\[1\],i,p\[2\]\)/g) || [];
assert.equal(litterLocations.length, 1, 'Cleanup location initializer should exist once');
assert.equal(birdLocations.length, 1, 'Birdwatching location initializer should exist once');

console.log('World events static checks passed');
