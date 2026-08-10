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
    const A=window.ToonValleyMountainTrailAmenities;
    const initial=A.getState();
    A.startPump(); A.advance(.08); const pumping=A.getState();
    for(let i=0;i<32;i++)A.advance(.08); const pumpDone=A.getState();
    for(let i=0;i<900;i++)A.advance(.08); const maintained=A.getState();
    return{initial,pumping,pumpDone,maintained};
  });
  if(report.initial.shelterCount!==1||report.initial.pumpCount!==1||report.initial.maintenanceCount!==1||report.initial.debrisCount!==2)throw new Error(`Trail amenity population missing ${JSON.stringify(report.initial)}`);
  if(report.pumping.pumpUses<1||report.pumping.pumping<=0||!report.pumping.streamVisible)throw new Error(`Water pump did not begin physical pumping ${JSON.stringify(report.pumping)}`);
  if(report.pumpDone.pumping!==0||report.pumpDone.streamVisible)throw new Error(`Water pump did not finish/reset ${JSON.stringify(report.pumpDone)}`);
  if(report.maintained.maintenance.distance<8||report.maintained.maintenance.terrainError>.08)throw new Error(`Maintenance volunteer did not patrol terrain safely ${JSON.stringify(report.maintained.maintenance)}`);
  if(report.maintained.maintenanceClears<1||!report.maintained.debris.some(d=>d.clears>0))throw new Error(`Maintenance volunteer never completed physical cleanup ${JSON.stringify(report.maintained)}`);
  if(![report.maintained.maintenance.x,report.maintained.maintenance.y,report.maintained.maintenance.z].every(Number.isFinite))throw new Error('Maintenance volunteer position became non-finite');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Mountain Trail water-pump and maintenance-patrol checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
