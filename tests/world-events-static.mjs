import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../world-events.js', import.meta.url), 'utf8');
new vm.Script(source, { filename: 'world-events.js' });

for (const required of [
  "prompt: 'Pick up litter'",
  'Clean Valley bonus',
  'Valley bird survey',
  'resetDailyCleanup',
  'resetDailyBirdwatching',
  'LEGACY_STORAGE_KEY',
  'window.ToonValleyWorldEvents'
]) {
  assert.ok(source.includes(required), `Missing expected world-event behavior: ${required}`);
}

const litterLocations = source.match(/makeLitter\(p\[0\], p\[1\], i\)/g) || [];
const birdLocations = source.match(/makeBirdSpot\(p\[0\], p\[1\], i, p\[2\]\)/g) || [];
assert.equal(litterLocations.length, 1, 'Cleanup location initializer should exist once');
assert.equal(birdLocations.length, 1, 'Birdwatching location initializer should exist once');

console.log('World events static checks passed');
