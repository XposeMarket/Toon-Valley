import { chromium } from 'playwright';

const url = process.env.BASE_URL || 'https://toon-valley.vercel.app';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyCentralPlaza && window.ToonValleyRoutines && window.ToonValleyTownActivities && window.ToonValleyWorldEvents && window.ToonValleyServices, null, { timeout: 45000 });
  const state = await page.evaluate(() => ({
    plazaTables: window.ToonValleyCentralPlaza.picnicTables,
    routines: window.ToonValleyRoutines.counts,
    activities: window.ToonValleyTownActivities.counts,
    events: window.ToonValleyWorldEvents.counts,
    services: window.ToonValleyServices.counts,
    bootVisible: Boolean(document.getElementById('boot-status')),
    interactables: window.ToonValley.interactables.length
  }));
  if (state.plazaTables !== 4) throw new Error(`Central plaza missing: ${JSON.stringify(state)}`);
  if (state.bootVisible) throw new Error('Production boot overlay never cleared');
  if (state.interactables < 20) throw new Error(`Production extension interaction count too low: ${state.interactables}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Production world extensions verified', state);
} finally {
  await browser.close();
}
