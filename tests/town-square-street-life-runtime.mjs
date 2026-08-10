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
    let pickupSeen=false,delivered=false,walkSeen=false,cautionSeen=false,stockDepleted=false,supplyCrateSeen=false,storedSeen=false,restockSeen=false;
    for(let i=0;i<1500;i++){
      A.advance(.25);S.advance(.25);
      const s=S.getState();
      if(s.pickupHandoffs.some(n=>n>0)&&s.pickupParcelVisible.some(Boolean))pickupSeen=true;
      if(s.pickupStock.some(n=>n===0))stockDepleted=true;
      if(s.pickupSupplyCrateVisible.some(Boolean))supplyCrateSeen=true;
      if(s.pickupRestocks.some(n=>n>0))restockSeen=true;
      if(s.recipientStoredDeliveries.some(n=>n>0)&&s.recipientStoredParcelVisible.some(Boolean))storedSeen=true;
      if(s.activeSignals>0)walkSeen=true;
      if(s.cautionSignals>0)cautionSeen=true;
      if(s.recipientDeliveries.some(n=>n>0)&&pickupSeen)delivered=true;
      if(delivered&&walkSeen&&cautionSeen&&stockDepleted&&supplyCrateSeen&&storedSeen&&restockSeen)break;
    }
    const afterDelivery=S.getState();
    let square=A.getState().find(x=>x.kind==='square-errand'&&x.pause===0&&x.playerYield===0);
    for(let i=0;!square&&i<80;i++){
      A.advance(.25);S.advance(.25);
      square=A.getState().find(x=>x.kind==='square-errand'&&x.pause===0&&x.playerYield===0);
    }
    if(!square)return {start,afterDelivery,pickupSeen,delivered,walkSeen,cautionSeen,stockDepleted,supplyCrateSeen,storedSeen,restockSeen,yielded:null,facingError:Infinity,afterYieldStreet:S.getState(),rootPresent:Boolean(TV.scene.getObjectByName('town-square-street-life'))};
    const walker=TV.scene.getObjectByName(square.name);
    TV.player.position.x=walker.position.x+.4;TV.player.position.z=walker.position.z+.3;
    A.advance(.1);const yielded=A.getState().find(x=>x.name===square.name);S.advance(.1);
    const afterYieldStreet=S.getState();
    const dx=TV.player.position.x-walker.position.x,dz=TV.player.position.z-walker.position.z;
    const desired=Math.atan2(dx,dz);const facingError=Math.abs(Math.atan2(Math.sin(walker.rotation.y-desired),Math.cos(walker.rotation.y-desired)));
    return {start,afterDelivery,pickupSeen,delivered,walkSeen,cautionSeen,stockDepleted,supplyCrateSeen,storedSeen,restockSeen,yielded,facingError,afterYieldStreet,rootPresent:Boolean(TV.scene.getObjectByName('town-square-street-life'))};
  });
  if(!report.rootPresent||report.start.recipientCount!==3||report.start.receivingBasketCount!==3||report.start.pickupStationCount!==5||report.start.crosswalkSignalCount!==6)throw new Error(`Street-life population failed ${JSON.stringify(report)}`);
  if(!report.start.finitePositions)throw new Error(`Street-life positions invalid ${JSON.stringify(report.start)}`);
  if(!report.pickupSeen||!report.afterDelivery.pickupHandoffs.some(n=>n>0))throw new Error(`Physical parcel pickup handoff never occurred ${JSON.stringify(report)}`);
  if(!report.stockDepleted||!report.supplyCrateSeen||!report.restockSeen||!report.afterDelivery.pickupRestocks.some(n=>n>0))throw new Error(`Parcel shelf depletion/restock lifecycle failed ${JSON.stringify(report)}`);
  if(!report.delivered||!report.afterDelivery.recipientDeliveries.some(n=>n>0))throw new Error(`Physical parcel recipient handoff never occurred ${JSON.stringify(report)}`);
  if(!report.storedSeen||!report.afterDelivery.recipientStoredDeliveries.some(n=>n>0))throw new Error(`Recipient basket set-down lifecycle failed ${JSON.stringify(report)}`);
  if(!report.walkSeen||!report.cautionSeen||!report.afterDelivery.signalActivations.some(n=>n>0)||!report.afterDelivery.signalPhaseTransitions.some(n=>n>=2))throw new Error(`Timed crosswalk phases never completed ${JSON.stringify(report)}`);
  if(!report.yielded||!(report.yielded.playerYield>0)||report.facingError>.12)throw new Error(`Yield-facing behavior failed ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Town Square stocked pickup, recipient basket delivery, timed crosswalk phases, and yield-facing behavior passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
