import fs from 'node:fs';
const community=fs.readFileSync(new URL('../valley-community-life.js',import.meta.url),'utf8');
const transit=fs.readFileSync(new URL('../valley-transit.js',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../central-plaza.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const checks=[
  ['community export',community,/window\.ToonValleyCommunityLife/],
  ['four trail stops',community,/trailStops:trail\.length/],
  ['trail explicit start',community,/trailStarted=true/],
  ['trail final sign-off',community,/trailAwaitingSignoff=true/],
  ['trail reward only at ranger',community,/Mountain trail ranger sign-off/],
  ['ordered trail stamps',community,/state\.trailVisited\.length===index/],
  ['lookout telescope',community,/Cloud Lookout telescope/],
  ['daily errand rotation',community,/state\.errandIndex=d%errands\.length/],
  ['errand explicit acceptance',community,/errandStarted=true/],
  ['errand board sign-off',community,/Community errand sign-off/],
  ['errand return stage',community,/errandAwaitingSignoff=true/],
  ['ordered errand stops',community,/state\.errandVisited\.length===stopIndex/],
  ['three errand routes',community,/Valley Explorer/],
  ['persistent community state',community,/toon-valley-community-life-v1/],
  ['physical shuttle waiting',transit,/Waiting at .*automatically when it arrives/],
  ['bench seating state',transit,/shuttle bench/],
  ['automatic boarding',transit,/if\(distTo\(waiting\)<7&&dwell>0\)board\(waiting\)/],
  ['board guards dwell',transit,/riding\|\|dwell<=0/],
  ['production bootstrap',bootstrap,/valley-community-life\.js/],
  ['local bootstrap',index,/valley-community-life\.js/],
  ['offline cache',sw,/valley-community-life\.js/],
  ['network first release cache',sw,/if \(sameOrigin\)[\s\S]*fetch\(event\.request\)/]
];
for(const [name,src,re] of checks) if(!re.test(src)) throw new Error(`Missing ${name}`);
console.log('Community life and shuttle regression checks passed');
