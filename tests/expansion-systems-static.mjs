import assert from 'node:assert/strict';
import fs from 'node:fs';

const interiors = fs.readFileSync(new URL('../public-interiors.js', import.meta.url), 'utf8');
const theater = fs.readFileSync(new URL('../moonbeam-theater.js', import.meta.url), 'utf8');
const lake = fs.readFileSync(new URL('../bluebell-lake.js', import.meta.url), 'utf8');

for (const area of ['clinic','fireStation','postOffice','school']) {
  assert.match(interiors, new RegExp(`ensure\\('${area}'`), `${area} interior is missing`);
}
assert.match(interiors, /Inspect Engine 1/);
assert.match(interiors, /Mail a postcard/);
assert.match(interiors, /Draw on the chalkboard/);
assert.match(interiors, /Browse homes & property/);
assert.match(interiors, /upgradedExisting:5/);

assert.match(theater, /Moon Rabbit Express/);
assert.match(theater, /The Great Berry Bake/);
assert.match(theater, /Boat Day at Bluebell Lake/);
assert.equal((theater.match(/duration:120/g) || []).length, 3, 'Expected three two-minute shorts');
assert.match(theater, /new THREE\.CanvasTexture/);
assert.match(theater, /Sit for the movie/);
assert.match(theater, /BUY TICKET & ENTER/);
assert.match(theater, /seats:seats\.length/);

assert.match(lake, /LAKE=\{x:126,z:-100,rx:25,rz:18\}/);
assert.match(lake, /old\.position\.set\(-99/);
assert.match(lake, /Visit Bluebell Lake dock/);
assert.match(lake, /Board wooden rowboat/);
assert.match(lake, /boat-fishing/);
assert.match(lake, /ToonValleyBluebellLake/);
console.log('expansion systems static checks passed');
