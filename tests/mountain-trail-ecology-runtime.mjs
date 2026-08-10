import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4196','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4196').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyMountainTrailEcology&&window.ToonValleyMountainTrailLife&&window.ToonValleyCommunityLife&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);
  const report=await page.evaluate(()=>{
    const TV=window.ToonValley,E=window.ToonValleyMountainTrailEcology;
    TV.player.position.set(0,TV.terrainHeight(0,0),0);
    for(let i=0;i<180;i++)E.advance(.05);
    const foraging=E.getState();
    const squirrel=foraging.squirrels[0];
    TV.player.position.set(squirrel.x+.35,TV.terrainHeight(squirrel.x+.35,squirrel.z+.35),squirrel.z+.35);
    E.advance(.08);const startled=E.getState();
    TV.player.position.set(0,TV.terrainHeight(0,0),0);
    for(let i=0;i<150;i++)E.advance(.05);
    const climbed=E.getState();
    const bird=climbed.birds[0];
    TV.player.position.set(bird.x+.3,TV.terrainHeight(bird.x+.3,bird.z+.3),bird.z+.3);
    E.advance(.08);const flushed=E.getState();
    TV.player.position.set(0,TV.terrainHeight(0,0),0);
    for(let i=0;i<45;i++)E.advance(.05);
    const landed=E.getState();
    return{foraging,startled,climbed,flushed,landed};
  });
  if(report.foraging.habitatCount!==3||report.foraging.squirrelCount!==3||report.foraging.birdCount!==4)throw new Error(`Bounded trail ecology population missing ${JSON.stringify(report.foraging)}`);
  if(!report.foraging.squirrels.every(s=>s.distance>.1&&s.terrainError<.08&&Number.isFinite(s.x)&&Number.isFinite(s.z)))throw new Error(`Squirrels did not forage safely on terrain ${JSON.stringify(report.foraging.squirrels)}`);
  if(report.startled.totalSquirrelEscapes<1||!report.startled.squirrels.some(s=>s.escapeEvents>0&&s.mode!=='forage'))throw new Error(`Squirrel did not physically flee player ${JSON.stringify(report.startled)}`);
  if(report.climbed.totalTreeClimbs<1||!report.climbed.squirrels.some(s=>s.climbEvents>0))throw new Error(`Squirrel did not complete tree-climb escape lifecycle ${JSON.stringify(report.climbed)}`);
  if(report.flushed.totalBirdFlushes<1||!report.flushed.birds.some(b=>b.flushEvents>0&&b.mode==='flying'))throw new Error(`Songbird did not flush into flight ${JSON.stringify(report.flushed)}`);
  if(report.landed.totalBirdLandings<1||!report.landed.birds.some(b=>b.landingEvents>0&&b.mode==='perched'&&b.distance>1))throw new Error(`Songbird did not physically fly and land at another perch ${JSON.stringify(report.landed)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Mountain Trail squirrel escape/climb and songbird flush/landing checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
