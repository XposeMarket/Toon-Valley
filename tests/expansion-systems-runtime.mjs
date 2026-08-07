import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external = process.env.BASE_URL;
let server = null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (!external) {
  server = spawn('python3', ['-m', 'http.server', '4177', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(900);
}
const base = (external || 'http://127.0.0.1:4177').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyPublicInteriors && window.ToonValleyTheater && window.ToonValleyBluebellLake, null, { timeout: 45000 });
  const state = await page.evaluate(() => {
    const TV = window.ToonValley;
    const servicePrompts = ['Enter Toon Valley Clinic','Enter Fire Station','Enter Post Office','Enter Rainbow Elementary'];
    return {
      interiors: window.ToonValleyPublicInteriors.counts,
      theater: window.ToonValleyTheater.counts,
      films: window.ToonValleyTheater.films.map((film) => ({ title: film.title, duration: film.duration })),
      lake: window.ToonValleyBluebellLake.counts,
      legacyPondMoved: window.ToonValleyBluebellLake.legacyPondMoved,
      areas: ['clinic','fireStation','postOffice','school','theater'].map((area) => ({ area, bounds: Boolean(TV.areaBounds[area]), group: Boolean(TV.interiorGroups[area]) })),
      serviceEntrances: servicePrompts.map((prompt) => TV.interactables.some((item) => item.area === 'world' && item.prompt === prompt)),
      theaterEntrance: TV.interactables.some((item) => item.area === 'world' && item.prompt === 'Buy ticket / see a film'),
      theaterSeats: TV.interactables.filter((item) => item.area === 'theater' && item.prompt === 'Sit for the movie').length,
      lakeDock: TV.interactables.some((item) => item.area === 'world' && item.prompt === 'Visit Bluebell Lake dock'),
      rowboat: TV.interactables.some((item) => item.area === 'world' && item.prompt === 'Board wooden rowboat')
    };
  });
  if (state.interiors.newInteriors !== 4 || state.interiors.upgradedExisting !== 5) throw new Error(`Interior counts wrong: ${JSON.stringify(state)}`);
  if (state.theater.films !== 3 || state.theater.seats !== 28) throw new Error(`Theater counts wrong: ${JSON.stringify(state)}`);
  if (state.films.some((film) => film.duration !== 120)) throw new Error(`Film duration wrong: ${JSON.stringify(state.films)}`);
  if (state.lake.lakes !== 1 || state.lake.boats !== 1 || !state.legacyPondMoved) throw new Error(`Lake system wrong: ${JSON.stringify(state)}`);
  if (state.areas.some((entry) => !entry.bounds || !entry.group)) throw new Error(`Interior area missing: ${JSON.stringify(state.areas)}`);
  if (state.serviceEntrances.some((wired) => !wired)) throw new Error(`Service entrance not wired: ${JSON.stringify(state.serviceEntrances)}`);
  if (!state.theaterEntrance || state.theaterSeats < 8 || !state.lakeDock || !state.rowboat) throw new Error(`Expansion interactions missing: ${JSON.stringify(state)}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('expansion systems runtime checks passed', state);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
