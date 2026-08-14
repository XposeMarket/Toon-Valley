import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external = process.env.BASE_URL;
let server = null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
if (!external) {
  server = spawn('python3', ['-m', 'http.server', '4201', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(900);
}
const base = (external || 'http://127.0.0.1:4201').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyBluebellEcosystemLinks && window.ToonValleyBluebellWildlife && window.ToonValleyBluebellMarshLife && window.ToonValley?.player, null, { timeout: 45000 });
  await page.click('#play-button');
  await wait(180);

  const report = await page.evaluate(() => {
    const E = window.ToonValleyBluebellEcosystemLinks;
    const W = window.ToonValleyBluebellWildlife;
    const M = window.ToonValleyBluebellMarshLife;
    const TV = window.ToonValley;
    const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
    const marshRoot = TV.scene.getObjectByName('bluebell-marsh-life');

    TV.player.position.set(220, TV.terrainHeight(220, 220), 220);
    for (let i = 0; i < 14; i++) E.advance(.1);

    const adult = wildlifeRoot?.getObjectByName('bluebell-duck-1');
    const minnow = marshRoot?.getObjectByName('bluebell-minnow-1');
    let minnowBefore = null;
    if (adult && minnow) {
      adult.position.x += .22;
      adult.position.z += .09;
      minnow.position.x = adult.position.x + .34;
      minnow.position.z = adult.position.z + .13;
      minnowBefore = { x: minnow.position.x, z: minnow.position.z };
      for (let i = 0; i < 7; i++) E.advance(.1);
    }
    const minnowShift = minnow && minnowBefore
      ? Math.hypot(minnow.position.x - minnowBefore.x, minnow.position.z - minnowBefore.z)
      : 0;

    for (let i = 0; i < 50 && !W.getState().dragonflies.some(dragon => dragon.perch <= 0 && dragon.dodge <= 0); i++) W.advance(.1);
    const wildlifeState = W.getState();
    const activeDragonIndex = wildlifeState.dragonflies.findIndex(dragon => dragon.perch <= 0 && dragon.dodge <= 0);
    const frog = marshRoot?.getObjectByName('bluebell-frog-1');
    const dragon = activeDragonIndex >= 0 ? wildlifeRoot?.getObjectByName(`bluebell-dragonfly-${activeDragonIndex + 1}`) : null;
    let dragonBefore = null;
    if (frog && dragon) {
      dragon.position.set(frog.position.x + .35, frog.position.y + 1.05, frog.position.z + 1.55);
      dragonBefore = { x: dragon.position.x, y: dragon.position.y, z: dragon.position.z };
      for (let i = 0; i < 12; i++) E.advance(.05);
    }
    const dragonShift = dragon && dragonBefore
      ? Math.hypot(dragon.position.x - dragonBefore.x, dragon.position.y - dragonBefore.y, dragon.position.z - dragonBefore.z)
      : 0;
    const tongueCount = [1, 2, 3].filter(index => marshRoot?.getObjectByName(`bluebell-frog-${index}`)?.getObjectByName(`bluebell-frog-tongue-${index}`)).length;

    return {
      flags: {
        active: E.active,
        duckMinnow: E.duckWakeMinnowDisturbance,
        frogDragonfly: E.frogDragonflyTongueFlick,
        physical: E.physicalPredatorResponse,
        fixed: E.fixedTongueGeometry,
        bounded: E.boundedMinnowResponses,
        population: E.existingPopulationOnly,
        low: E.lowAllocationBehavior
      },
      minnowShift,
      dragonShift,
      tongueCount,
      activeDragonReady: Boolean(dragon),
      state: E.getState()
    };
  });

  if (!Object.values(report.flags).every(Boolean)) throw new Error(`Bluebell ecosystem capability flags missing ${JSON.stringify(report.flags)}`);
  if (report.state.duckMinnowDisturbances < 1 || report.state.duckMinnowResponses < 1 || report.state.minnowImpulseCorrections < 2 || report.state.minnowPeakShift <= .001 || report.minnowShift <= .02) {
    throw new Error(`Duck/minnow ecosystem disturbance regression ${JSON.stringify(report)}`);
  }
  if (!report.activeDragonReady) throw new Error(`Could not prepare airborne dragonfly for frog interaction ${JSON.stringify(report)}`);
  if (report.tongueCount !== 3 || report.state.tongueCount !== 3 || report.state.frogTongueFlicks < 1 || report.state.frogTonguePeakReach <= .2 || report.state.frogWatchTurns < 1) {
    throw new Error(`Physical frog tongue interaction regression ${JSON.stringify(report)}`);
  }
  if (report.state.dragonflyEvasions < 1 || report.state.evasionPeakShift <= .1 || report.dragonShift <= .1) {
    throw new Error(`Dragonfly predator-evasion regression ${JSON.stringify(report)}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Bluebell cross-species ecosystem interactions passed runtime checks', report);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
