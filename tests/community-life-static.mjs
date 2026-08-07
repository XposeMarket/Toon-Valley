import fs from 'node:fs';
const community=fs.readFileSync(new URL('../valley-community-life.js',import.meta.url),'utf8');
const transit=fs.readFileSync(new URL('../valley-transit.js',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../central-plaza.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const checks=[
  ['community export',community,/window\.ToonValleyCommunityLife/],
  ['four trail stops',community,/trailStops:trail\.length/],
  ['trail completion reward',community,/Mountain trail completion/],
  ['lookout telescope',community,/Cloud Lookout telescope/],
  ['daily errand rotation',community,/state\.errandIndex=d%errands\.length/],
  ['three errand routes',community,/Valley Explorer/],
  ['persistent community state',community,/toon-valley-community-life-v1/],
  ['physical shuttle waiting',transit,/Waiting at .*automatically when it arrives/],
  ['bench seating state',transit,/shuttle bench/],
  ['automatic boarding',transit,/if\(distTo\(waiting\)<7&&dwell>0\)board\(waiting\)/],
  ['board guards dwell',transit,/riding\|\|dwell<=0/],
  ['production bootstrap',bootstrap,/valley-community-life\.js/],
  ['local bootstrap',index,/valley-community-life\.js/],
  ['offline cache',sw,/valley-community-life\.js/]
];
for(const [name,src,re] of checks) if(!re.test(src)) throw new Error(`Missing ${name}`);
console.log('Community life and shuttle regression checks passed');
