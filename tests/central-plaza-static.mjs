import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader = fs.readFileSync(new URL('../central-plaza.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../central-plaza-core.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(source, /Make a wish at the fountain/);
assert.match(source, /Visit the farmers market/);
assert.match(source, /Market tasting survey/);
assert.match(source, /picnicTables:4/);
assert.match(source, /Play on the swings/);
assert.match(source, /activity:'playground'/);
assert.match(source, /Toon Valley Dog Park/);
assert.match(source, /Biscuit/);
assert.match(source, /Scout/);
assert.match(source, /Noodle/);
assert.match(source, /dogs:dogs\.length/);
assert.match(source, /swingSeats:swingSeats\.length/);
assert.doesNotMatch(source, /addBoxCollider\(-25\.5,26\.5,8\.4,6\.4\)/);
assert.match(source, /ToonValleyCentralPlaza/);
assert.match(loader, /central-plaza-core\.js/);
assert.match(loader, /public-interiors\.js/);
assert.match(loader, /ToonValleyExpansionBootstrap/);
assert.match(html, /central-plaza\.js/);
assert.match(sw, /central-plaza\.js/);
console.log('central plaza static checks passed');
