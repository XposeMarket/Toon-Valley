import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';
const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4193','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4193').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyTownSquareStreetLife&&window.ToonValleyAmbientPedestrianLife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);
  const report=await page.evaluate(()=>{
    const A=window.ToonValleyAmbientPedestrianLife,S=window.ToonValleyTownSquareStreetLife,TV=window.ToonValley;
    const start=S.getState();
    TV.player.position.set(220,0,220);
    let delivered=false, signalSeen=false;
    for(let i=0;i<900;i++){
      A.advance(.25);S.advance(.25);
      const s=S.getState();
      if(s.activeSignals>0)signalSeen=true;
      if(s.recipientDeliveries.some(n=>n>0)&&s.recipientThanking.some(Boolean)&&s.recipientParcelVisible.some(Boolean)){delivered=true;break;}
    }
    const afterDelivery=S.getState();
    let square=A.getState().find(x=>x.kind==='square-errand'&&x.pause===0&&x.playerYield===0);
    for(let i=0;!square&&i<80;i++){
      A.advance(.25);S.advance(.25);
      square=A.getState().find(x=>x.kind==='square-errand'&&x.pause===0&&x.playerYield===0);
    }
    if(!square)return {start,afterDelivery,delivered,signalSeen,yielded:null,facingError:Infinity,afterYieldStreet:S.getState(),rootPresent:Boolean(TV.scene.getObjectByName('town-square-street-life'))};
    const walker=TV.scene.getObjectByName(square.name);
    TV.player.position.x=walker.position.x+.4;TV.player.position.z=walker.position.z+.3;
    A.advance(.1);const yielded=A.getState().find(x=>x.name===square.name);S.advance(.1);
    const afterYieldStreet=S.getState();
    const dx=TV.player.position.x-walker.position.x,dz=TV.player.position.z-walker.position.z;
    const desired=Math.atan2(dx,dz);const facingError=Math.abs(Math.atan2(Math.sin(walker.rotation.y-desired),Math.cos(walker.rotation.y-desired)));
    return {start,afterDelivery,delivered,signalSeen,yielded,facingError,afterYieldStreet,rootPresent:Boolean(TV.scene.getObjectByName('town-square-street-life'))};
  });
  if(!report.rootPresent||report.start.recipientCount!==3||report.start.crosswalkSignalCount!==6)throw new Error(`Street-life population failed ${JSON.stringify(report)}`);
  if(!report.start.finitePositions)throw new Error(`Recipient positions invalid ${JSON.stringify(report.start)}`);
  if(!report.delivered||!report.afterDelivery.recipientDeliveries.some(n=>n>0)||!report.afterDelivery.recipientParcelVisible.some(Boolean))throw new Error(`Physical parcel recipient handoff never occurred ${JSON.stringify(report)}`);
  if(!report.signalSeen||!report.afterDelivery.signalActivations.some(n=>n>0))throw new Error(`Reactive crosswalk signals never activated ${JSON.stringify(report)}`);
  if(!report.yielded||!(report.yielded.playerYield>0)||report.facingError>.12||report.afterYieldStreet.yieldFacingCorrections<=report.afterDelivery.yieldFacingCorrections)throw new Error(`Yield-facing repair failed ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Town Square recipient handoffs, crosswalk signals, and yield-facing repair passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
