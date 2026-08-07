import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../ui-layer-fix.js',import.meta.url),'utf8');
const nav=fs.readFileSync(new URL('../navigation-polish.js',import.meta.url),'utf8');
const community=fs.readFileSync(new URL('../valley-community-life.js',import.meta.url),'utf8');
const transit=fs.readFileSync(new URL('../valley-transit.js',import.meta.url),'utf8');
const lake=fs.readFileSync(new URL('../bluebell-lake.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(ui,/KeyP:'home'/);
assert.match(ui,/KeyT:'tasks'/);
assert.match(ui,/KeyI:'inventory'/);
assert.match(ui,/document\.exitPointerLock/);
assert.match(ui,/TV\.setModalOpen\(true\)/);
assert.match(ui,/requestAnimationFrame\(\(\)=>Life\.openPhone\(tab\)\)/);
assert.match(ui,/pause-screen/);
assert.match(ui,/desktopShortcuts:\{phone:'P',inventory:'I',tasks:'T'\}/);
assert.match(html,/<b>P<\/b> phone/);
assert.match(html,/<b>T<\/b> tasks/);
assert.match(html,/<b>I<\/b> bag/);

assert.match(nav,/rotation\.y=Math\.PI/);
assert.match(nav,/beacons:2,signs:2/);
assert.match(community,/Pine Gate',x:-126,z:78/);
assert.match(community,/Cloud Lookout',x:-172,z:137/);
assert.match(community,/trailMaxRadius/);
assert.match(transit,/stopDwellSeconds=4\.8/);
assert.match(lake,/rod-curved-line-bobber/);
console.log('navigation, desktop controls, and fishing static checks passed');
