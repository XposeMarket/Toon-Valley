import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external = process.env.BASE_URL;
let server = null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!external) {
  server = spawn('python3', ['-m', 'http.server', '4178', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(900);
}
const base = (external || 'http://127.0.0.1:4178').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyPublicInteriors && window.ToonValleyTheater && window.ToonValleyOwnedHome && window.ToonValleyBluebellLake, null, { timeout: 45000 });
  const state = await page.evaluate(() => {
    const TV = window.ToonValley;
    const prompts = (area) => TV.interactables.filter((item) => item.area === area).map((item) => item.prompt);
    return {
      interiors: window.ToonValleyPublicInteriors.counts,
      theater: window.ToonValleyTheater.counts,
      films: window.ToonValleyTheater.films.map(({ title, duration }) => ({ title, duration })),
      home: window.ToonValleyOwnedHome.counts,
      homeLot: window.ToonValleyOwnedHome.houseLot,
      lake: window.ToonValleyBluebellLake.counts,
      legacyPondMoved: window.ToonValleyBluebellLake.legacyPondMoved,
      areas: ['clinic','fireStation','postOffice','school','theater','home'].map((area) => ({ area, bounds: Boolean(TV.areaBounds[area]), group: Boolean(TV.interiorGroups[area]) })),
      worldPrompts: prompts('world'),
      clinicPrompts: prompts('clinic'),
      homePrompts: prompts('home'),
      furniturePrompts: prompts('furnitureStore'),
      cityHallPrompts: prompts('cityHall')
    };
  });

  if (state.interiors.newInteriors !== 4 || state.interiors.upgradedExisting !== 5) throw new Error(`Interior counts wrong: ${JSON.stringify(state.interiors)}`);
  if (state.theater.films !== 3 || state.theater.seats !== 28 || state.films.some((film) => film.duration !== 120)) throw new Error(`Theater system wrong: ${JSON.stringify(state.theater)}`);
  if (state.home.decorItems !== 10 || state.home.homeUpgraded !== 1 || state.homeLot.x !== -51 || state.homeLot.z !== 66) throw new Error(`Owned home system wrong: ${JSON.stringify(state.home)}`);
  if (state.lake.lakes !== 1 || state.lake.boats !== 1 || !state.legacyPondMoved) throw new Error(`Bluebell Lake system wrong: ${JSON.stringify(state.lake)}`);
  if (state.areas.some((entry) => !entry.bounds || !entry.group)) throw new Error(`Expansion area missing: ${JSON.stringify(state.areas)}`);

  const requiredWorld = ['Enter Toon Valley Clinic','Enter Fire Station','Enter Post Office','Enter Rainbow Elementary','Buy ticket / see a film','Visit Bluebell Lake dock','Board wooden rowboat'];
  for (const prompt of requiredWorld) if (!state.worldPrompts.includes(prompt)) throw new Error(`Missing world interaction: ${prompt}`);
  if (!state.clinicPrompts.includes('Visit the pet adoption corner')) throw new Error('Missing clinic pet adoption interaction');
  if (!state.homePrompts.includes('Arrange paintings & decor')) throw new Error('Missing home decor interaction');
  if (!state.furniturePrompts.includes('Browse paintings & decor')) throw new Error('Missing decor shop interaction');
  if (!state.cityHallPrompts.includes('Browse homes & property')) throw new Error('Missing City Hall property interaction');
  if (errors.length) throw new Error(errors.join('\n'));

  console.log('major valley expansion runtime checks passed', state);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
