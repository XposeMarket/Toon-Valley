import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4197','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4197').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyBluebellShoreLife&&window.ToonValleyBluebellLake&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const S=window.ToonValleyBluebellShoreLife,TV=window.ToonValley,L=window.ToonValleyBluebellLake;
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    const initial=S.getState();
    let hunt=S.getState();
    for(let i=0;i<40&&hunt.heronHunts===initial.heronHunts;i++){S.advance(.1);hunt=S.getState()}
    const frogObj=TV.scene.getObjectByName('bluebell-frog-1');
    frogObj.position.x=-.5;frogObj.position.z=-.5;
    TV.player.position.set(0,frogObj.position.y,0);
    S.advance(.1);
    const afterAxisFrog=S.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    let landed=afterAxisFrog;
    for(let i=0;i<20;i++){S.advance(.1);landed=S.getState();if(landed.frogs[0].jump===0)break}
    const heron=landed.heron;
    TV.player.position.set(heron.x,heron.y,heron.z);S.advance(.1);
    const afterHeron=S.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    let settled=afterHeron;
    for(let i=0;i<60;i++){S.advance(.1);settled=S.getState();if(settled.heron.state==='wading'&&settled.heron.anchorIndex!==initial.heron.anchorIndex)break}
    const root=TV.scene.getObjectByName('bluebell-shore-life');
    return {flags:{active:S.active,frogs:S.reactiveLilyFrogs,jumps:S.visibleFrogJumps,ripples:S.frogWaterRipples,heron:S.wadingHeron,hunt:S.heronStalkAndStrike,flight:S.reactiveHeronFlight,budget:S.lowPopulationBudget},lake:L.lake,initial,hunt,afterAxisFrog,landed,afterHeron,settled,rootPresent:Boolean(root),childCount:root?.children.length||0};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell shore capability flags missing ${JSON.stringify(report.flags)}`);
  if(!report.rootPresent||report.childCount<16||report.initial.frogCount!==3)throw new Error(`Bluebell shore population did not initialize ${JSON.stringify(report)}`);
  if(report.hunt.heronHunts<=report.initial.heronHunts||report.hunt.heronStrikeRipples<=report.initial.heronStrikeRipples)throw new Error(`Heron stalk/strike feeding cycle did not complete ${JSON.stringify({before:report.initial,after:report.hunt})}`);
  const axisFrog=report.afterAxisFrog.frogs[0];
  if(axisFrog.jumpCount<1||axisFrog.jump<=0||axisFrog.lastEscapeX>=0||axisFrog.lastEscapeZ>=0)throw new Error(`Axis-zero frog escape direction regressed ${JSON.stringify(axisFrog)}`);
  if(report.afterAxisFrog.frogSplashRipples<=report.initial.frogSplashRipples||report.afterAxisFrog.activeRipples<1)throw new Error(`Frog launch ripple missing ${JSON.stringify(report.afterAxisFrog)}`);
  if(report.landed.frogSplashRipples<report.afterAxisFrog.frogSplashRipples+1)throw new Error(`Frog landing ripple missing ${JSON.stringify({jump:report.afterAxisFrog,landed:report.landed})}`);
  if(report.afterHeron.heronFlights<=report.landed.heronFlights||report.afterHeron.heron.state!=='flying')throw new Error(`Heron did not take flight from nearby player ${JSON.stringify({before:report.landed.heron,after:report.afterHeron.heron})}`);
  if(report.settled.heron.state!=='wading'||report.settled.heron.anchorIndex===report.initial.heron.anchorIndex)throw new Error(`Heron did not land at a new shoreline anchor ${JSON.stringify({initial:report.initial.heron,settled:report.settled.heron})}`);
  const lake=report.lake;
  if(report.settled.frogs.some(f=>!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.z)||Math.abs(f.x-lake.x)>lake.rx*1.1||Math.abs(f.z-lake.z)>lake.rz*1.1))throw new Error(`Frog left Bluebell shoreline bounds ${JSON.stringify(report.settled.frogs)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell shoreline ripples, frog escape, heron feeding and flight passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
