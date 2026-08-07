import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const remoteURL = process.env.BASE_URL?.replace(/\/$/, '');
const server = remoteURL ? null : spawn('python3', ['-m', 'http.server', '4173', '--bind', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
if (server) await wait(900);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(45000);
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
let stage='boot';const checkpoint=(name)=>{stage=name;console.log(`[smoke] ${name}`)};const watchdog=setTimeout(()=>{console.error(`[smoke] HARD TIMEOUT at ${stage}`);process.exit(124)},90000);
const waitModalClosed=()=>page.waitForFunction(()=>{const el=document.querySelector('.life-overlay');return !el||getComputedStyle(el).display==='none'||el.classList.contains('hidden')});

try {
  checkpoint('navigate');
  await page.goto(remoteURL || 'http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ToonValley && window.ToonValleyLife && window.ToonValleyUILayerFix);
  await page.waitForSelector('#life-hud');
  checkpoint('core ready');
  const initial = await page.evaluate(() => window.ToonValleyLife.getState());
  if (initial.version !== 4) throw new Error(`Unexpected save version ${initial.version}`);
  if (initial.player.money < 1) throw new Error('Player economy did not initialize');
  await page.click('#play-button'); await page.waitForFunction(() => window.ToonValley.state.started);
  checkpoint('entered game');
  await page.keyboard.press('KeyP');
  await page.waitForSelector('.life-overlay .life-window', { state: 'visible' });
  await page.click('.life-close');
  await waitModalClosed();
  checkpoint('phone modal');

  const coreRegression = await page.evaluate(() => {
    const TV=window.ToonValley; TV.state.modalOpen=true; TV.player.position.set(0,TV.terrainHeight(0,10),10);TV.state.area='world';TV.state.grounded=true;TV.state.jumpVelocity=0;
    document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));const queuedJump=TV.state.jumpQueued;TV.updatePlayer(.016);const jumped=!TV.state.grounded&&TV.state.jumpVelocity>0;
    document.getElementById('mobile-sprint').click();const sprintEnabled=TV.state.mobileSprint;TV.state.mobileMoveY=1;TV.playerVelocity.set(0,0,0);TV.updatePlayer(.2);const sprintSpeed=Math.hypot(TV.playerVelocity.x,TV.playerVelocity.z);TV.setMobileSprint(false);TV.state.mobileMoveY=0;
    TV.sitOnBench(TV.benchSeats[0]);const seated=TV.state.seated,stood=TV.standUpFromSeat(false),overlaps=[];
    for(const building of TV.townBuildings){const bx1=building.x-building.halfW,bx2=building.x+building.halfW,bz1=building.z-building.halfD,bz2=building.z+building.halfD;for(const road of TV.roadSegments){const horizontal=Math.abs(road.z1-road.z2)<.001,vertical=Math.abs(road.x1-road.x2)<.001;if(!horizontal&&!vertical)continue;const rx1=Math.min(road.x1,road.x2)-(vertical?road.width*.5:0),rx2=Math.max(road.x1,road.x2)+(vertical?road.width*.5:0),rz1=Math.min(road.z1,road.z2)-(horizontal?road.width*.5:0),rz2=Math.max(road.z1,road.z2)+(horizontal?road.width*.5:0);if(bx1<rx2&&bx2>rx1&&bz1<rz2&&bz2>rz1)overlaps.push({building:building.label,road})}}
    TV.state.modalOpen=false;return{queuedJump,jumped,sprintEnabled,sprintSpeed,seated,stood,overlaps};
  });
  if(!coreRegression.queuedJump||!coreRegression.jumped)throw new Error(`Jump input regression: ${JSON.stringify(coreRegression)}`);
  if(!coreRegression.sprintEnabled||coreRegression.sprintSpeed<5.2)throw new Error(`Sprint input regression: ${JSON.stringify(coreRegression)}`);
  if(!coreRegression.seated||!coreRegression.stood)throw new Error(`Bench sitting regression: ${JSON.stringify(coreRegression)}`);
  if(coreRegression.overlaps.length)throw new Error(`Buildings overlap roads: ${JSON.stringify(coreRegression.overlaps)}`);
  checkpoint('core interactions');

  await page.evaluate(()=>{window.ToonValleyLife.openOutdoorMarket();return true;});await page.waitForSelector('[data-market-buy]',{state:'visible'});const marketCount=await page.locator('[data-market-buy]').count();if(marketCount<4)throw new Error(`Outdoor market only exposed ${marketCount} purchasable items`);await page.evaluate(()=>{document.querySelector('.life-close')?.click();return true;});await waitModalClosed();
  checkpoint('market');
  const supportsInteriorRecovery=await page.evaluate(()=>typeof window.ToonValley.ensurePlayerSafePosition==='function');
  if(!remoteURL||supportsInteriorRecovery){const storeState=await page.evaluate(()=>{const TV=window.ToonValley;TV.enterInterior('generalStore',{x:26,z:-18});const entered={x:TV.player.position.x,z:TV.player.position.z},enteredBlocked=TV.isBlocked(entered.x,entered.z),movementSpace={forward:!TV.isBlocked(entered.x,entered.z-.5),backward:!TV.isBlocked(entered.x,entered.z+.5),left:!TV.isBlocked(entered.x-.5,entered.z),right:!TV.isBlocked(entered.x+.5,entered.z)};TV.player.position.set(TV.areaBounds.generalStore.cx,0,TV.areaBounds.generalStore.cz+5);const rescued=TV.ensurePlayerSafePosition(),rescuedPosition={x:TV.player.position.x,z:TV.player.position.z},rescuedBlocked=TV.isBlocked(rescuedPosition.x,rescuedPosition.z);TV.exitInterior();return{entered,enteredBlocked,movementSpace,rescued,rescuedPosition,rescuedBlocked,exited:TV.state.area==='world'}});if(storeState.enteredBlocked)throw new Error(`General Store entry spawn is blocked: ${JSON.stringify(storeState.entered)}`);if(!Object.values(storeState.movementSpace).some(Boolean))throw new Error(`General Store has no traversable movement direction: ${JSON.stringify(storeState)}`);if(!storeState.rescued||storeState.rescuedBlocked)throw new Error(`General Store recovery failed: ${JSON.stringify(storeState)}`);if(!storeState.exited)throw new Error(`General Store exit failed: ${JSON.stringify(storeState)}`)}
  checkpoint('interior recovery');
  await page.evaluate(()=>window.ToonValley.enterInterior('home',{x:-64,z:57}));await page.evaluate(()=>window.ToonValleyLife.startBuild('chairBlue'));await page.waitForSelector('#build-controls',{state:'visible'});await page.evaluate(()=>document.querySelector('[data-build="place"]')?.click());await page.waitForFunction(()=>window.ToonValleyLife.getState().property.furniture.length>=1);
  checkpoint('furniture placed');
  await page.evaluate(()=>{window.ToonValleyLife.openShop('grocery');return true;});await page.waitForSelector('[data-buy-item="apple"]',{state:'visible'});await page.evaluate(()=>{document.querySelector('[data-buy-item="apple"]')?.click();document.querySelector('.life-close')?.click();return true;});await waitModalClosed();
  checkpoint('saving');
  await page.evaluate(async()=>{window.ToonValleyLife.addMoney(77);await window.ToonValleyLife.saveGame('test')});const moneyBeforeReload=await page.evaluate(()=>window.ToonValleyLife.getState().player.money);
  checkpoint('saved');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(expected=>window.ToonValleyLife&&window.ToonValleyLife.getState().player.money===expected,moneyBeforeReload,{timeout:30000});
  checkpoint('reload persisted');
  const finalState=await page.evaluate(()=>window.ToonValleyLife.getState());if(!finalState.property.furniture.length)throw new Error('Furniture placement did not persist');if((finalState.player.inventory.apple||0)<3)throw new Error('Shop purchase did not persist');if(errors.length)throw new Error(errors.join('\n'));console.log(`Toon Valley browser smoke test passed: ${remoteURL||'localhost'}`);
} finally { clearTimeout(watchdog); await browser.close(); server?.kill('SIGTERM'); }
