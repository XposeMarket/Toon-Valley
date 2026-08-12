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
    const duck=W.getState().ducks[0];
    TV.player.position.set(duck.x,duck.y,duck.z);
    W.advance(.1);P.advance(.13);
    const afterEscape=P.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<8;i++){W.advance(.1);P.advance(.1)}
    const afterRipple=P.getState();
    const root=TV.scene.getObjectByName('bluebell-wildlife-ripple-pool');
    return {flags:{active:P.active,ageMix:P.duckFamilyAgeMix,pool:P.pooledWaterRipples,dabble:P.dabbleWaterResponse,escape:P.escapeWaterResponse,perch:P.reactivePerchSway,lowAllocation:P.lowAllocationPool},before,afterCruise,afterEscape,afterRipple,rootPresent:Boolean(root),poolChildren:root?.children.length||0};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell wildlife polish capability flags missing ${JSON.stringify(report.flags)}`);
  if(!report.rootPresent||report.poolChildren!==12||report.before.ripplePoolSize!==12)throw new Error(`Pooled wildlife ripple system did not initialize ${JSON.stringify(report)}`);
  if(!report.before.duckFamilyAgeMix||report.before.duckScales.length!==3||Math.abs(report.before.duckScales[0]-1)>.01||report.before.duckScales[1]>=.8||report.before.duckScales[2]>=.8)throw new Error(`Duck family age/size hierarchy is missing ${JSON.stringify(report.before.duckScales)}`);
  if(report.afterCruise.dabbleRipples<1||report.afterCruise.ripplesEmitted<1)throw new Error(`Duck dabbling did not produce physical water ripples ${JSON.stringify(report.afterCruise)}`);
  if(report.afterEscape.escapeRipples<=report.afterCruise.escapeRipples||report.afterEscape.activeRippleCount<1)throw new Error(`Duck escape did not produce a visible water response ${JSON.stringify({before:report.afterCruise,after:report.afterEscape})}`);
  if(report.afterCruise.perchResponses<1||report.afterCruise.perchDeflections.every(v=>!Number.isFinite(v)||Math.abs(v)<.0001))throw new Error(`Dragonfly landings did not drive physical perch sway ${JSON.stringify(report.afterCruise)}`);
  if(report.afterRipple.activeRippleCount>=report.afterEscape.activeRippleCount&&report.afterRipple.activeRippleCount!==0)throw new Error(`Water ripple pool did not decay/recycle ${JSON.stringify({escape:report.afterEscape,after:report.afterRipple})}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell duckling age mix, pooled dabble/escape ripples, and reactive dragonfly perch sway passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
