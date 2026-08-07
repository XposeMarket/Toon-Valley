import { chromium } from 'playwright';

const url = process.env.BASE_URL || 'https://toon-valley.vercel.app';
const expectedCommit = process.env.EXPECTED_COMMIT || null;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  const swResponse = await page.request.get(`${url.replace(/\/$/, '')}/sw.js`);
  if (!swResponse.ok()) throw new Error(`Production service worker returned ${swResponse.status()}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyCentralPlaza && window.ToonValleyRoutines && window.ToonValleyTownActivities && window.ToonValleyWorldEvents && window.ToonValleyServices && window.ToonValleyPublicInteriors && window.ToonValleyTheater && window.ToonValleyOwnedHome && window.ToonValleyBluebellLake && window.ToonValleyInteractionFix && window.ToonValleyTransit && window.ToonValleyCommunityGarden, null, { timeout: 60000 });
  await page.waitForFunction(() => !document.getElementById('boot-status'), null, { timeout: 15000 });
  const state = await page.evaluate(() => ({
    deployedCommit: document.querySelector('meta[name="toon-valley-commit"]')?.content || null,
    plazaTables: window.ToonValleyCentralPlaza.picnicTables,
    publicInteriors: window.ToonValleyPublicInteriors.counts,
    theater: window.ToonValleyTheater.counts,
    ownedHome: window.ToonValleyOwnedHome.counts,
    lake: window.ToonValleyBluebellLake.counts,
    transit: window.ToonValleyTransit.counts,
    garden: window.ToonValleyCommunityGarden.counts,
    repairedInteractions: window.ToonValleyInteractionFix.repaired,
    bootVisible: Boolean(document.getElementById('boot-status')),
    interactables: window.ToonValley.interactables.length
  }));
  if (expectedCommit && state.deployedCommit !== expectedCommit) throw new Error(`Production commit mismatch: expected ${expectedCommit}, got ${state.deployedCommit || 'none'}`);
  if (state.plazaTables !== 4) throw new Error(`Central plaza missing: ${JSON.stringify(state)}`);
  if (state.publicInteriors.newInteriors !== 4 || state.publicInteriors.upgradedExisting !== 5) throw new Error(`Production public interiors missing: ${JSON.stringify(state)}`);
  if (state.theater.films !== 3 || state.theater.seats !== 28) throw new Error(`Production theater incomplete: ${JSON.stringify(state)}`);
  if (state.ownedHome.decorItems !== 10 || state.ownedHome.homeUpgraded !== 1) throw new Error(`Production owned-home systems incomplete: ${JSON.stringify(state)}`);
  if (state.lake.lakes !== 1 || state.lake.boats !== 1) throw new Error(`Production Bluebell Lake incomplete: ${JSON.stringify(state)}`);
  if (state.transit.stops !== 4 || state.transit.buses !== 1) throw new Error(`Production Valley Shuttle incomplete: ${JSON.stringify(state)}`);
  if (state.garden.beds !== 6 || state.garden.plants !== 36) throw new Error(`Production community garden incomplete: ${JSON.stringify(state)}`);
  if (state.repairedInteractions < 5) throw new Error(`Production nested interaction repair missing: ${JSON.stringify(state)}`);
  if (state.bootVisible) throw new Error('Production boot overlay never cleared');
  if (state.interactables < 42) throw new Error(`Production extension interaction count too low: ${state.interactables}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Production world extensions verified', state);
} finally {
  await browser.close();
}
