import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4198','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4198').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyBluebellWildlifePolish&&window.ToonValleyBluebellWildlife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const P=window.ToonValleyBluebellWildlifePolish,W=window.ToonValleyBluebellWildlife,TV=window.ToonValley;
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    const before=P.getState();
    for(let i=0;i<55;i++){W.advance(.2);P.advance(.2)}
    const afterCruise=P.getState();

    const root=TV.scene.getObjectByName('bluebell-wildlife');
    const duck2=root?.getObjectByName('bluebell-duck-2');
    const duck1=root?.getObjectByName('bluebell-duck-1');
    if(duck2&&duck1) duck2.position.set(duck1.position.x+5,duck2.position.y,duck1.position.z+5);
    W.advance(.12);
    const beforeRegroup=duck2&&duck1?Math.hypot(duck2.position.x-duck1.position.x,duck2.position.z-duck1.position.z):null;
    for(let i=0;i<5;i++)P.advance(.12);
    const afterRegroup=duck2&&duck1?Math.hypot(duck2.position.x-duck1.position.x,duck2.position.z-duck1.position.z):null;
    const afterRegroupState=P.getState();

    const duck=W.getState().ducks[0];
    const adult=root?.getObjectByName('bluebell-duck-1');
    TV.player.position.set(duck.x+6.2,duck.y,duck.z);
    const watchYawBefore=adult?.rotation.y??null;
    for(let i=0;i<8;i++)P.advance(.1);
    const afterWatch=P.getState();
    const watchYawAfter=adult?.rotation.y??null;

    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    const chaseBefore=P.getState();
    for(let i=0;i<38;i++){W.advance(.1);P.advance(.1)}
    const afterChase=P.getState();

    const currentDuck=W.getState().ducks[0];
    TV.player.position.set(currentDuck.x,currentDuck.y,currentDuck.z);
    W.advance(.1);P.advance(.13);
    const afterEscape=P.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<8;i++){W.advance(.1);P.advance(.1)}
    const afterRipple=P.getState();
    const rippleRoot=TV.scene.getObjectByName('bluebell-wildlife-ripple-pool');
    return {flags:{active:P.active,ageMix:P.duckFamilyAgeMix,pool:P.pooledWaterRipples,dabble:P.dabbleWaterResponse,escape:P.escapeWaterResponse,familyEscape:P.familyEscapeWaterResponse,wakes:P.continuousSwimWakeTrails,regroup:P.ducklingRegroupAssist,watch:P.familyWatchfulness,chases:P.dragonflyPairChases,perch:P.reactivePerchSway,lowAllocation:P.lowAllocationPool},before,afterCruise,beforeRegroup,afterRegroup,afterRegroupState,watchYawBefore,watchYawAfter,afterWatch,chaseBefore,afterChase,afterEscape,afterRipple,rootPresent:Boolean(rippleRoot),poolChildren:rippleRoot?.children.length||0};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell wildlife polish capability flags missing ${JSON.stringify(report.flags)}`);
  if(!report.rootPresent||report.poolChildren!==12||report.before.ripplePoolSize!==12)throw new Error(`Pooled wildlife ripple system did not initialize ${JSON.stringify(report)}`);
  if(!report.before.duckFamilyAgeMix||report.before.duckScales.length!==3||Math.abs(report.before.duckScales[0]-1)>.01||report.before.duckScales[1]>=.8||report.before.duckScales[2]>=.8)throw new Error(`Duck family age/size hierarchy is missing ${JSON.stringify(report.before.duckScales)}`);
  if(report.afterCruise.dabbleRipples<1||report.afterCruise.ripplesEmitted<1)throw new Error(`Duck dabbling did not produce physical water ripples ${JSON.stringify(report.afterCruise)}`);
  if(report.afterCruise.wakeRipples<2)throw new Error(`Swimming ducks did not leave continuous pooled wake trails ${JSON.stringify(report.afterCruise)}`);
  if(!Number.isFinite(report.beforeRegroup)||!Number.isFinite(report.afterRegroup)||report.afterRegroup>=report.beforeRegroup||report.afterRegroupState.regroupCorrections<1)throw new Error(`Lagging duckling did not receive physical regroup assistance ${JSON.stringify({before:report.beforeRegroup,after:report.afterRegroup,state:report.afterRegroupState})}`);
  if(!Number.isFinite(report.watchYawBefore)||!Number.isFinite(report.watchYawAfter)||report.afterWatch.familyWatchResponses<1||report.afterWatch.watchCorrections<=report.afterRegroupState.watchCorrections||Math.abs(report.watchYawAfter-report.watchYawBefore)<.02)throw new Error(`Duck family did not visibly watch a nearby player before fleeing ${JSON.stringify({before:report.watchYawBefore,after:report.watchYawAfter,state:report.afterWatch})}`);
  if(report.afterCruise.dragonflyPairChases<1||report.afterCruise.chaseCorrections<1)throw new Error(`Airborne dragonflies did not perform paired chase behavior ${JSON.stringify(report.afterCruise)}`);
  if(report.afterEscape.familyEscapeBursts<1||report.afterEscape.escapeRipples-report.afterChase.escapeRipples<3||report.afterEscape.activeRippleCount<1)throw new Error(`Duck family escape did not produce a whole-family water response ${JSON.stringify({before:report.afterChase,after:report.afterEscape})}`);
  if(report.afterCruise.perchResponses<1||report.afterCruise.perchDeflections.every(v=>!Number.isFinite(v)||Math.abs(v)<.0001))throw new Error(`Dragonfly landings did not drive physical perch sway ${JSON.stringify(report.afterCruise)}`);
  if(report.afterRipple.activeRippleCount>=report.afterEscape.activeRippleCount&&report.afterRipple.activeRippleCount!==0)throw new Error(`Water ripple pool did not decay/recycle ${JSON.stringify({escape:report.afterEscape,after:report.afterRipple})}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell family watchfulness, dragonfly pair chases, regroup assistance, continuous wakes, escape ripples, age mix, and reactive perch sway passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
