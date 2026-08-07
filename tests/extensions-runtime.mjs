import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await wait(900);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyCentralPlaza && window.ToonValleyRoutines && window.ToonValleyTownActivities && window.ToonValleyWorldEvents && window.ToonValleyServices && window.ToonValleyPublicInteriors && window.ToonValleyTheater && window.ToonValleyOwnedHome && window.ToonValleyBluebellLake && window.ToonValleyInteractionFix && window.ToonValleyTransit && window.ToonValleyCommunityGarden, null, { timeout: 30000 });
  const state = await page.evaluate(() => {
    const TV = window.ToonValley;
    const interiorResults = {};
    for (const area of ['cityHall','generalStore','library','cafe','furnitureStore','clinic','fireStation','postOffice','school','theater','home']) {
      TV.enterInterior(area, { x: 0, z: 10 });
      interiorResults[area] = { area: TV.state.area, visible: Boolean(TV.interiorGroups[area]?.visible), blocked: TV.isBlocked(TV.player.position.x, TV.player.position.z) };
      TV.exitInterior();
    }
    const nested = TV.interactables.filter((item) => item._worldProxy).length;
    return {
      plazaTables: window.ToonValleyCentralPlaza.picnicTables,
      publicInteriors: window.ToonValleyPublicInteriors.counts,
      theater: window.ToonValleyTheater.counts,
      ownedHome: window.ToonValleyOwnedHome.counts,
      lake: window.ToonValleyBluebellLake.counts,
      transit: window.ToonValleyTransit.counts,
      garden: window.ToonValleyCommunityGarden.counts,
      repairedInteractions: window.ToonValleyInteractionFix.repaired,
      nested,
      interiors: interiorResults,
      interactables: TV.interactables.length
    };
  });
  if (state.publicInteriors.newInteriors !== 4 || state.publicInteriors.upgradedExisting !== 5) throw new Error(`Public interiors missing: ${JSON.stringify(state)}`);
  if (state.theater.films !== 3 || state.theater.seats !== 28) throw new Error(`Moonbeam Theater incomplete: ${JSON.stringify(state)}`);
  if (state.ownedHome.decorItems !== 10 || state.ownedHome.homeUpgraded !== 1) throw new Error(`Owned-home systems incomplete: ${JSON.stringify(state)}`);
  if (state.lake.lakes !== 1 || state.lake.boats !== 1) throw new Error(`Bluebell Lake incomplete: ${JSON.stringify(state)}`);
  if (state.transit.stops !== 4 || state.transit.buses !== 1) throw new Error(`Valley Shuttle incomplete: ${JSON.stringify(state)}`);
  if (state.garden.beds !== 6 || state.garden.plants !== 36) throw new Error(`Community garden incomplete: ${JSON.stringify(state)}`);
  if (state.repairedInteractions < 5 || state.nested !== state.repairedInteractions) throw new Error(`Nested interaction repair did not initialize: ${JSON.stringify(state)}`);
  const badInterior = Object.entries(state.interiors).find(([, value]) => value.area === 'world' || !value.visible || value.blocked);
  if (badInterior) throw new Error(`Interior traversal regression: ${JSON.stringify(badInterior)}`);
  if (state.interactables < 42) throw new Error(`Suspiciously low interaction count: ${state.interactables}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley extension runtime checks passed', state);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
