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
    for(let i=0;i<20;i++)S.advance(.2);
    const calm=S.getState();
    const frog=calm.frogs[0];
    TV.player.position.set(frog.x,frog.y,frog.z);
    S.advance(.1);
    const afterFrog=S.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<25;i++)S.advance(.2);
    const recovered=S.getState();
    const heron=recovered.heron;
    TV.player.position.set(heron.x,heron.y,heron.z);
    S.advance(.1);
    const afterHeron=S.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<28;i++)S.advance(.2);
    const settled=S.getState();
    const root=TV.scene.getObjectByName('bluebell-shore-life');
    return {flags:{active:S.active,frogs:S.reactiveLilyFrogs,jumps:S.visibleFrogJumps,heron:S.wadingHeron,flight:S.reactiveHeronFlight,budget:S.lowPopulationBudget},lake:L.lake,initial,calm,afterFrog,recovered,afterHeron,settled,rootPresent:Boolean(root),childCount:root?.children.length||0};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell shore capability flags missing ${JSON.stringify(report.flags)}`);
  if(!report.rootPresent||report.childCount!==7||report.initial.frogCount!==3)throw new Error(`Bluebell shore population did not initialize ${JSON.stringify(report)}`);
  if(report.afterFrog.frogJumps<=report.calm.frogJumps||!report.afterFrog.frogs.some((f,i)=>f.jumpCount>report.calm.frogs[i].jumpCount&&f.jump>0))throw new Error(`Lily frog did not physically jump from nearby player ${JSON.stringify({before:report.calm,after:report.afterFrog})}`);
  const frogRecovered=report.recovered.frogs.some((f,i)=>report.afterFrog.frogs[i].jumpCount>0&&f.jump===0&&Number.isFinite(f.x)&&Number.isFinite(f.y)&&Number.isFinite(f.z));
  if(!frogRecovered)throw new Error(`Lily frog did not recover after jump ${JSON.stringify(report.recovered.frogs)}`);
  if(report.afterHeron.heronFlights<=report.recovered.heronFlights||report.afterHeron.heron.flightCount<=report.recovered.heron.flightCount||report.afterHeron.heron.state!=='flying')throw new Error(`Heron did not take flight from nearby player ${JSON.stringify({before:report.recovered.heron,after:report.afterHeron.heron})}`);
  if(report.settled.heron.state!=='wading'||report.settled.heron.anchorIndex===report.initial.heron.anchorIndex)throw new Error(`Heron did not land at a new shoreline anchor ${JSON.stringify({initial:report.initial.heron,settled:report.settled.heron})}`);
  const lake=report.lake;
  if(report.settled.frogs.some(f=>!Number.isFinite(f.x)||!Number.isFinite(f.y)||!Number.isFinite(f.z)||Math.abs(f.x-lake.x)>lake.rx*1.1||Math.abs(f.z-lake.z)>lake.rz*1.1))throw new Error(`Frog left Bluebell shoreline bounds ${JSON.stringify(report.settled.frogs)}`);
  if(!Number.isFinite(report.settled.heron.x)||!Number.isFinite(report.settled.heron.y)||!Number.isFinite(report.settled.heron.z)||report.settled.heron.y<0)throw new Error(`Heron terrain state became invalid ${JSON.stringify(report.settled.heron)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell lily frogs and shoreline heron passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
