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
  await page.waitForFunction(()=>window.ToonValleyMountainTrailAmenities&&window.ToonValleyMountainTrailLife&&window.ToonValleyCommunityLife&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);
  const report=await page.evaluate(()=>{
    const A=window.ToonValleyMountainTrailAmenities,C=window.ToonValleyCommunityLife;
    const initial=A.getState();
    A.startPump(); A.advance(.08); const pumping=A.getState();
    for(let i=0;i<32;i++)A.advance(.08); const pumpDone=A.getState();
    C.handleTrailGate(); A.advance(.08); const accepted=A.getState();
    C.visitTrail(0); A.advance(.08); const stamped=A.getState();
    for(let i=0;i<1200;i++)A.advance(.08); const maintained=A.getState();
    return{initial,pumping,pumpDone,accepted,stamped,maintained};
  });
  if(report.initial.shelterCount!==1||report.initial.pumpCount!==1||report.initial.progressBoardCount!==1||report.initial.wasteStationCount!==1||report.initial.maintenanceCount!==1||report.initial.debrisCount!==2)throw new Error(`Trail amenity population missing ${JSON.stringify(report.initial)}`);
  if(report.pumping.pumpUses<1||report.pumping.pumping<=0||!report.pumping.streamVisible)throw new Error(`Water pump did not begin physical pumping ${JSON.stringify(report.pumping)}`);
  if(report.pumpDone.pumping!==0||report.pumpDone.streamVisible)throw new Error(`Water pump did not finish/reset ${JSON.stringify(report.pumpDone)}`);
  if(report.accepted.progressBoard.stage!=='active'||report.accepted.progressBoard.visited!==0)throw new Error(`Progress board did not reflect accepted canonical trail state ${JSON.stringify(report.accepted.progressBoard)}`);
  if(report.stamped.progressBoard.stage!=='active'||report.stamped.progressBoard.visited!==1||report.stamped.progressBoard.litStamps!==1)throw new Error(`Progress board did not reflect canonical trail stamp ${JSON.stringify(report.stamped.progressBoard)}`);
  if(report.maintained.maintenance.distance<12||report.maintained.maintenance.terrainError>.08)throw new Error(`Maintenance volunteer did not patrol terrain safely ${JSON.stringify(report.maintained.maintenance)}`);
  if(report.maintained.maintenanceClears<1||!report.maintained.debris.some(d=>d.clears>0))throw new Error(`Maintenance volunteer never completed physical cleanup ${JSON.stringify(report.maintained)}`);
  if(report.maintained.maintenanceDisposals<1||report.maintained.maintenance.wasteCarryDistance<2)throw new Error(`Maintenance volunteer never carried swept debris to the physical waste station ${JSON.stringify(report.maintained)}`);
  if(![report.maintained.maintenance.x,report.maintained.maintenance.y,report.maintained.maintenance.z,report.maintained.wasteStation.x,report.maintained.wasteStation.y,report.maintained.wasteStation.z].every(Number.isFinite))throw new Error('Trail amenity position became non-finite');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Mountain Trail progress-board, water-pump, and maintenance disposal checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
