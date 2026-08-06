import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const server = spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await wait(900);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife, null, { timeout: 30000 });
  await page.waitForSelector('#life-hud');

  const initial = await page.evaluate(() => window.ToonValleyLife.getState());
  if (initial.version !== 4) throw new Error(`Unexpected save version ${initial.version}`);
  if (initial.player.money < 1) throw new Error('Player economy did not initialize');

  await page.click('#play-button');
  await page.waitForFunction(() => window.ToonValley.state.started);
  await page.click('#phone-button', { force: true });
  await page.waitForSelector('.life-overlay .life-window');
  await page.click('.life-close');

  await page.evaluate(() => window.ToonValley.enterInterior('home', { x: -64, z: 57 }));
  await page.evaluate(() => window.ToonValleyLife.startBuild('chairBlue'));
  await page.waitForSelector('#build-controls');
  await page.click('[data-build="place"]', { force: true });
  await page.waitForFunction(() => window.ToonValleyLife.getState().property.furniture.length >= 1);

  await page.evaluate(() => window.ToonValleyLife.openShop('grocery'));
  await page.waitForSelector('[data-buy-item="apple"]');
  await page.click('[data-buy-item="apple"]');
  await page.click('.life-close');

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
  console.log('Toon Valley browser smoke test passed.');
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
