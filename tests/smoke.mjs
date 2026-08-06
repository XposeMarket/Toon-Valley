import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife, null, { timeout: 30000 });
  await page.waitForSelector('#life-hud');

  const initial = await page.evaluate(() => window.ToonValleyLife.getState());
  if (initial.version !== 4) throw new Error(`Unexpected save version ${initial.version}`);
  if (initial.player.money < 1) throw new Error('Player economy did not initialize');

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started);
  await page.evaluate(() => window.ToonValleyLife.openPhone('home'));
  await page.waitForSelector('.life-overlay .life-window', { state: 'visible' });
  await page.evaluate(() => document.querySelector('.life-close')?.click());
  await page.waitForSelector('.life-overlay', { state: 'detached' });

  const supportsInteriorRecovery = await page.evaluate(() => typeof window.ToonValley.ensurePlayerSafePosition === 'function');
  if (!remoteURL || supportsInteriorRecovery) {
    const storeState = await page.evaluate(() => {
      const TV = window.ToonValley;
      TV.enterInterior('generalStore', { x: 26, z: -18 });
      const entered = { x: TV.player.position.x, z: TV.player.position.z };
      const enteredBlocked = TV.isBlocked(entered.x, entered.z);
      const movementSpace = {
        forward: !TV.isBlocked(entered.x, entered.z - 0.5),
        backward: !TV.isBlocked(entered.x, entered.zex + 0.5),
        left: !TV.isBlocked(entered.x - 0.5, entered.z),
        right: !TV.isBlocked(entered.x + 0.5, entered.z)
      };

      // Reproduce the old broken save/spawn location and verify automatic rescue.
      TV.player.position.set(TV.areaBounds.generalStore.cx, 0, TV.areaBounds.generalStore.cz + 5.0);
      const rescued = TV.ensurePlayerSafePosition();
      const rescuedPosition = { x: TV.player.position.x, z: TV.player.position.z };
      const rescuedBlocked = TV.isBlocked(rescuedPosition.x, rescuedPosition.z);
      TV.exitInterior();
      return {
        entered,
        enteredBlocked,
        movementSpace,
        rescued,
        rescuedPosition,
        rescuedBlocked,
        exited: TV.state.area === 'world'
      };
    });
    if (storeState.enteredBlocked) throw new Error(`General Store entry spawn is blocked: ${JSON.stringify(storeState.entered)}`);
    if (!Object.values(storeState.movementSpace).some(Boolean)) throw new Error(`General Store has no traversable movement direction: ${JSON.stringify(storeState)}`);
    if (!storeState.rescued || storeState.rescuedBlocked) throw new Error(`General Store recovery failed: ${JSON.stringify(storeState)}`);
    if (!storeState.exited) throw new Error(`General Store exit failed: ${JSON.stringify(storeState)}`);
  }

  await page.evaluate(() => window.ToonValley.enterInterior('home', { x: -64, z: 57 }));
  await page.evaluate(() => window.ToonValleyLife.startBuild('chairBlue'));
  await page.waitForSelector('#build-controls', { state: 'visible' });
  await page.evaluate(() => document.querySelector('[data-build="place"]')?.click());
  await page.waitForFunction(() => window.ToonValleyLife.getState().property.furniture.length >= 1);

  await page.evaluate(() => window.ToonValleyLife.openShop('grocery'));
  await page.waitForSelector('[data-buy-item="apple"]', { state: 'visible' });
  await page.evaluate(() => document.querySelector('[data-buy-item="apple"]')?.click());
  await page.evaluate(() => document.querySelector('.life-close')?.click());

  await page.evaluate(async () => {
    window.ToonValleyLife.addMoney(77);
    await window.ToonValleyLife.saveGame('test');
  });
  const moneyBeforeReload = await page.evaluate(() => window.ToonValleyLife.getState().player.money);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction((expected) => window.ToonValleyLife && window.ToonValleyLife.getState().player.money === expected, moneyBeforeReload, { timeout: 30000 });

  const finalState = await page.evaluate(() => window.ToonValleyLife.getState());
  if (!finalState.property.furniture.length) throw new Error('Furniture placement did not persist');
  if ((finalState.player.inventory.apple || 0) < 3) throw new Error('Shop purchase did not persist');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Toon Valley browser smoke test passed: ${remoteURL || 'localhost'}`);
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
