import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external = process.env.BASE_URL;
let server = null;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
if (!external) {
  server = spawn('python3', ['-m', 'http.server', '4202', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await wait(900);
}
const base = (external || 'http://127.0.0.1:4202').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', error => errors.push(error.stack || error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.ToonValleyBluebellMarshSocial && window.ToonValleyBluebellWildlife && window.ToonValleyBluebellMarshLife && window.ToonValley?.player, null, { timeout: 45000 });
  await page.click('#play-button');
  await wait(180);

  const report = await page.evaluate(() => {
    const S = window.ToonValleyBluebellMarshSocial;
    const TV = window.ToonValley;
    const wildlifeRoot = TV.scene.getObjectByName('bluebell-wildlife');
    const marshRoot = TV.scene.getObjectByName('bluebell-marsh-life');
    const socialRoot = TV.scene.getObjectByName('bluebell-marsh-social');

    TV.player.position.set(220, TV.terrainHeight(220, 220), 220);

    const turtle = marshRoot?.getObjectByName('bluebell-turtle-1');
    const duck = wildlifeRoot?.getObjectByName('bluebell-duck-1');
    const turtleYawBefore = turtle?.rotation.y || 0;
    if (turtle && duck) {
      duck.position.set(turtle.position.x + 1.45, duck.position.y, turtle.position.z + .75);
      for (let i = 0; i < 18; i++) S.advance(.1);
    }
    const watchedState = S.getState();
    const turtleYawShift = turtle ? Math.abs(Math.atan2(Math.sin(turtle.rotation.y - turtleYawBefore), Math.cos(turtle.rotation.y - turtleYawBefore))) : 0;
    const turtleLean = turtle ? Math.abs(turtle.rotation.z) : 0;

    if (duck) duck.position.set(220, duck.position.y, 220);
    for (let i = 0; i < 30; i++) S.advance(.1);
    const returnedState = S.getState();
    const turtleReturnLean = turtle ? Math.abs(turtle.rotation.z) : Infinity;

    for (let i = 0; i < 105; i++) S.advance(.1);
    const chorusState = S.getState();
    const throatCount = [1, 2, 3].filter(index => marshRoot?.getObjectByName(`bluebell-frog-${index}`)?.getObjectByName(`bluebell-frog-throat-${index}`)).length;

    return {
      flags: {
        active: S.active,
        chorus: S.frogCallAndResponse,
        throatPulse: S.physicalThroatPulse,
        fixedThroat: S.fixedThroatGeometry,
        turtleWatch: S.turtleDuckWatch,
        turtleLean: S.turtleAlertLean,
        smoothReturn: S.smoothTurtleReturn,
        existing: S.existingWildlifeOnly,
        low: S.lowAllocationBehavior
      },
      socialRootPresent: Boolean(socialRoot),
      turtleYawShift,
      turtleLean,
      turtleReturnLean,
      watchedState,
      returnedState,
      chorusState,
      throatCount
    };
  });

  if (!Object.values(report.flags).every(Boolean)) throw new Error(`Bluebell marsh social capability flags missing ${JSON.stringify(report.flags)}`);
  if (!report.socialRootPresent) throw new Error(`Bluebell marsh social root missing ${JSON.stringify(report)}`);
  if (report.watchedState.turtleDuckWatchTurns < 1 || report.watchedState.turtleAlertTicks < 1 || report.watchedState.turtleAlertPeakLean < .02 || report.turtleYawShift < .02 || report.turtleLean < .02) {
    throw new Error(`Turtle duck-watch/alert posture regression ${JSON.stringify(report)}`);
  }
  if (report.returnedState.turtleReturnTurns < 1 || report.turtleReturnLean > .025) {
    throw new Error(`Turtle smooth return regression ${JSON.stringify(report)}`);
  }
  if (report.throatCount !== 3 || report.chorusState.throatCount !== 3 || report.chorusState.chorusCycles < 1 || report.chorusState.frogChorusCalls < 2 || report.chorusState.frogChorusResponses < 1 || report.chorusState.throatPeakScale < 1) {
    throw new Error(`Frog chorus call-and-response regression ${JSON.stringify(report)}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Bluebell marsh social interactions passed runtime checks', report);
} finally {
  await browser.close();
  if (server) server.kill('SIGTERM');
}
