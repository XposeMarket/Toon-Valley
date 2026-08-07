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
  await page.waitForFunction(() => window.ToonValleyCentralPlaza && window.ToonValleyRoutines && window.ToonValleyTownActivities && window.ToonValleyWorldEvents && window.ToonValleyServices, null, { timeout: 30000 });
  const state = await page.evaluate(() => ({
    plazaTables: window.ToonValleyCentralPlaza.picnicTables,
    plazaVisible: window.ToonValleyCentralPlaza.root.visible,
    routines: Boolean(window.ToonValleyRoutines),
    activities: Boolean(window.ToonValleyTownActivities),
    events: Boolean(window.ToonValleyWorldEvents),
    services: Boolean(window.ToonValleyServices),
    interactables: window.ToonValley.interactables.length
  }));
  if (state.plazaTables !== 4 || !state.plazaVisible) throw new Error(`Central plaza did not initialize: ${JSON.stringify(state)}`);
  if (!state.routines || !state.activities || !state.events || !state.services) throw new Error(`World extension missing: ${JSON.stringify(state)}`);
  if (state.interactables < 20) throw new Error(`Suspiciously low interaction count: ${state.interactables}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Toon Valley extension runtime checks passed', state);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
