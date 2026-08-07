import assert from 'node:assert/strict';
import fs from 'node:fs';
const interaction=fs.readFileSync(new URL('../interaction-world-fix.js',import.meta.url),'utf8');
const transit=fs.readFileSync(new URL('../valley-transit.js',import.meta.url),'utf8');
const garden=fs.readFileSync(new URL('../community-garden.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(interaction,/getWorldPosition/);assert.match(interaction,/ToonValleyInteractionFix/);
assert.match(transit,/Valley Shuttle/);assert.match(transit,/stops:stops\.length,buses:1/);assert.match(transit,/Riding from/);assert.match(transit,/Bluebell Lake/);
assert.match(garden,/Community Garden/);assert.match(garden,/beds:beds\.length,plants:beds\.length\*6/);assert.match(garden,/garden-harvest/);assert.match(garden,/lastTendedDay/);
for(const file of ['interaction-world-fix.js','valley-transit.js','community-garden.js']){assert.match(html,new RegExp(file.replace('.','\\.')));assert.match(sw,new RegExp(file.replace('.','\\.')));}
console.log('daily build static checks passed');
