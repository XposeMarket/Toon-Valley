import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4174', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  screen: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack || error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4174', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyMobilePolish, null, { timeout: 30000 });
  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started);

  const state = await page.evaluate(() => {
    const TV = window.ToonValley;
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, display: getComputedStyle(el).display };
    };
    return {
      quality: TV.state.quality,
      rendererPixelRatio: TV.renderer.getPixelRatio(),
      configuredPixelRatio: TV.CONFIG.mobile.pixelRatio,
      minPixelRatio: TV.CONFIG.mobile.minPixelRatio,
      polish: window.ToonValleyMobilePolish,
      desktopIdentity: rect('#hud .top-left'),
      location: rect('#hud .location'),
      fps: rect('#hud .top-right'),
      lifeTop: rect('#life-hud .life-top'),
      actions: rect('#life-hud .life-actions'),
      joystick: rect('#joystick-zone'),
      use: rect('#mobile-interact'),
      jump: rect('#mobile-jump'),
      run: rect('#mobile-sprint'),
      viewport: { width: innerWidth, height: innerHeight }
    };
  });

  if (!state.polish.active) throw new Error(`Mobile polish did not activate: ${JSON.stringify(state)}`);
  if (state.configuredPixelRatio < 1.3 || state.minPixelRatio < 1) throw new Error(`Mobile render preset still too low resolution: ${JSON.stringify(state)}`);
  if (state.rendererPixelRatio < 1) throw new Error(`Renderer dropped below sharp mobile floor: ${JSON.stringify(state)}`);
  if (state.desktopIdentity?.display !== 'none') throw new Error(`Desktop identity HUD is still visible on phone: ${JSON.stringify(state.desktopIdentity)}`);
  if (state.location?.display !== 'none') throw new Error(`Desktop location card is still visible on phone: ${JSON.stringify(state.location)}`);
  if (!state.lifeTop || !state.actions || !state.fps) throw new Error(`Mobile HUD pieces missing: ${JSON.stringify(state)}`);
  if (overlaps(state.lifeTop, state.actions) || overlaps(state.lifeTop, state.fps) || overlaps(state.actions, state.fps)) throw new Error(`Mobile top HUD overlaps: ${JSON.stringify(state)}`);

  for (const [name, box] of Object.entries({ joystick: state.joystick, use: state.use, jump: state.jump, run: state.run })) {
    if (!box) throw new Error(`${name} control missing`);
    if (box.left < 0 || box.top < 0 || box.right > state.viewport.width + 1 || box.bottom > state.viewport.height + 1) throw new Error(`${name} control leaves viewport: ${JSON.stringify(box)}`);
  }
  if (overlaps(state.joystick, state.jump) || overlaps(state.joystick, state.run)) throw new Error(`Mobile movement controls overlap: ${JSON.stringify(state)}`);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley mobile smoke passed: ${remoteURL || 'localhost'}`, state);
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
