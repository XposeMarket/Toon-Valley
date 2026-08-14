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
    const TV = window.ToonValley;
    const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
    const marshRoot = TV.scene.getObjectByName('bluebell-marsh-life');
    const ecosystemRoot = TV.scene.getObjectByName('bluebell-ecosystem-links');

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

    let forageObserved = false;
    for (let i = 0; i < 75 && !forageObserved; i++) {
      if (adult && minnow) {
        minnow.position.x = adult.position.x + .28;
        minnow.position.z = adult.position.z + .12;
      }
      W.advance(.1);
      E.advance(.1);
      const state = E.getState();
      forageObserved = state.forageRippleBursts > 0 && state.forageMinnowResponses > 0;
    }

    for (let i = 0; i < 70 && W.getState().dragonflies.filter(dragon => dragon.perch <= 0 && dragon.dodge <= 0).length < 2; i++) W.advance(.1);
    const wildlifeState = W.getState();
    const activeDragonIndices = wildlifeState.dragonflies
      .map((dragon, index) => ({ dragon, index }))
      .filter(item => item.dragon.perch <= 0 && item.dragon.dodge <= 0)
      .map(item => item.index);
    const frog = marshRoot?.getObjectByName('bluebell-frog-1');
    const dragon = activeDragonIndices.length ? wildlifeRoot?.getObjectByName(`bluebell-dragonfly-${activeDragonIndices[0] + 1}`) : null;
    const companion = activeDragonIndices.length > 1 ? wildlifeRoot?.getObjectByName(`bluebell-dragonfly-${activeDragonIndices[1] + 1}`) : null;
    let dragonBefore = null;
    let companionBefore = null;
    if (frog && dragon && companion) {
      dragon.position.set(frog.position.x + .35, frog.position.y + 1.05, frog.position.z + 1.55);
      companion.position.set(frog.position.x - .55, frog.position.y + 1.18, frog.position.z + 1.9);
      dragonBefore = { x: dragon.position.x, y: dragon.position.y, z: dragon.position.z };
      companionBefore = { x: companion.position.x, y: companion.position.y, z: companion.position.z };
      for (let i = 0; i < 12; i++) E.advance(.05);
    }
    const dragonShift = dragon && dragonBefore
      ? Math.hypot(dragon.position.x - dragonBefore.x, dragon.position.y - dragonBefore.y, dragon.position.z - dragonBefore.z)
      : 0;
    const companionShift = companion && companionBefore
      ? Math.hypot(companion.position.x - companionBefore.x, companion.position.y - companionBefore.y, companion.position.z - companionBefore.z)
      : 0;

    let forcedCorrection = 0;
    if (dragon) {
      const forced = { x: dragon.position.x + 24, y: dragon.position.y + 8, z: dragon.position.z - 19 };
      dragon.position.set(forced.x, forced.y, forced.z);
      E.advance(.05);
      forcedCorrection = Math.hypot(dragon.position.x - forced.x, dragon.position.y - forced.y, dragon.position.z - forced.z);
    }

    const tongueCount = [1, 2, 3].filter(index => marshRoot?.getObjectByName(`bluebell-frog-${index}`)?.getObjectByName(`bluebell-frog-tongue-${index}`)).length;
    const forageRippleCount = [1, 2, 3, 4, 5, 6].filter(index => ecosystemRoot?.getObjectByName(`bluebell-forage-ripple-${index}`)).length;

    return {
      flags: {
        active: E.active,
        duckMinnow: E.duckWakeMinnowDisturbance,
        forage: E.duckForageWaterResponse,
        pooledForage: E.pooledForageRipples,
        forageMinnow: E.forageMinnowReaction,
        frogDragonfly: E.frogDragonflyTongueFlick,
        physical: E.physicalPredatorResponse,
        coordinatedAlarm: E.coordinatedDragonflyAlarm,
        boundedDragonfly: E.boundedDragonflyHabitat,
        fixed: E.fixedTongueGeometry,
        bounded: E.boundedMinnowResponses,
        population: E.existingPopulationOnly,
        low: E.lowAllocationBehavior
      },
      ecosystemRootPresent: Boolean(ecosystemRoot),
      minnowShift,
      forageObserved,
      forageRippleCount,
      dragonShift,
      companionShift,
      forcedCorrection,
      tongueCount,
      activeDragonReady: Boolean(dragon && companion),
      state: E.getState()
    };
  });

  if (!Object.values(report.flags).every(Boolean)) throw new Error(`Bluebell ecosystem capability flags missing ${JSON.stringify(report.flags)}`);
  if (report.state.duckMinnowDisturbances < 1 || report.state.duckMinnowResponses < 1 || report.state.minnowImpulseCorrections < 2 || report.state.minnowPeakShift <= .001 || report.minnowShift <= .02) {
    throw new Error(`Duck/minnow ecosystem disturbance regression ${JSON.stringify(report)}`);
  }
  if (!report.ecosystemRootPresent || !report.forageObserved || report.forageRippleCount !== 6 || report.state.forageRipplePoolSize !== 6 || report.state.forageRippleBursts < 1 || report.state.forageMinnowResponses < 1) {
    throw new Error(`Duck forage water/minnow response regression ${JSON.stringify(report)}`);
  }
  if (!report.activeDragonReady) throw new Error(`Could not prepare airborne dragonfly pair for frog interaction ${JSON.stringify(report)}`);
  if (report.tongueCount !== 3 || report.state.tongueCount !== 3 || report.state.frogTongueFlicks < 1 || report.state.frogTonguePeakReach <= .2 || report.state.frogWatchTurns < 1) {
    throw new Error(`Physical frog tongue interaction regression ${JSON.stringify(report)}`);
  }
  if (report.state.dragonflyEvasions < 1 || report.state.evasionPeakShift <= .1 || report.dragonShift <= .1) {
    throw new Error(`Dragonfly predator-evasion regression ${JSON.stringify(report)}`);
  }
  if (report.state.companionAlarms < 1 || report.state.companionAlarmPeakShift <= .1 || report.companionShift <= .1) {
    throw new Error(`Dragonfly companion alarm regression ${JSON.stringify(report)}`);
  }
  if (report.state.boundedDragonflyCorrections < 1 || report.forcedCorrection < 10) {
    throw new Error(`Dragonfly habitat-bounds regression ${JSON.stringify(report)}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Bluebell cross-species ecosystem interactions passed runtime checks', report);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
