import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4194','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4194').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.addInitScript(()=>localStorage.setItem('toon-valley-community-life-v1',JSON.stringify({
  trailDay:'bad',trailStarted:false,trailVisited:null,trailAwaitingSignoff:true,trailDone:false,
  errandDay:null,errandIndex:99,errandStarted:false,errandVisited:'bad',errandAwaitingSignoff:true,errandDone:false
})));
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyCommunityStateSafety&&window.ToonValleyCommunityLife&&window.ToonValleyMountainTrailLife&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,C=window.ToonValleyCommunityLife,M=window.ToonValleyMountainTrailLife,S=window.ToonValleyCommunityStateSafety;
    const initialCommunity=C.getState(),safety=S.getState(),before=M.getState();
    if(!Array.isArray(initialCommunity.trailVisited)||!Array.isArray(initialCommunity.errandVisited))throw new Error('Community state arrays were not repaired');
    if(initialCommunity.errandIndex<0||initialCommunity.errandIndex>=C.errands.length)throw new Error('Errand index was not repaired');
    for(let i=0;i<180;i++)M.advance(.05);
    const moved=M.getState();
    const first=moved.hikers[0];
    TV.player.position.x=first.x+.5;TV.player.position.z=first.z+.5;
    M.advance(.08);const yielded=M.getState();
    TV.player.position.set(-107,TV.terrainHeight(-107,46),46);
    C.handleTrailGate();M.advance(.08);const active=M.getState();
    for(let i=0;i<C.trail.length;i++)C.visitTrail(i);
    M.advance(.08);const signoff=M.getState();
    C.handleTrailGate();M.advance(.08);const complete=M.getState();
    return{repaired:S.repaired,parseFailed:S.parseFailed,safety,initialCommunity,before,moved,yielded,active,signoff,complete};
  });
  if(!report.repaired||report.parseFailed)throw new Error(`Stale community save was not safely normalized ${JSON.stringify(report.safety)}`);
  if(report.before.hikerCount!==2||report.before.pathPoints<10)throw new Error(`Bounded trail hiker population missing ${JSON.stringify(report.before)}`);
  if(!report.moved.hikers.every(h=>h.distance>0&&h.terrainError<.08&&Number.isFinite(h.x)&&Number.isFinite(h.z)))throw new Error(`Hikers did not traverse terrain safely ${JSON.stringify(report.moved)}`);
  if(report.yielded.totalYieldEvents<1||!report.yielded.hikers.some(h=>h.yielding>0))throw new Error(`Hikers did not yield to the player ${JSON.stringify(report.yielded)}`);
  if(report.active.ranger.mode!=='card-active'||!report.active.ranger.clipboardVisible||report.active.ranger.stampVisible)throw new Error(`Ranger did not react to trail acceptance ${JSON.stringify(report.active.ranger)}`);
  if(report.signoff.ranger.mode!=='signoff-ready'||!report.signoff.ranger.clipboardVisible||!report.signoff.ranger.stampVisible||report.signoff.ranger.signoffGestures<1)throw new Error(`Ranger sign-off response missing ${JSON.stringify(report.signoff.ranger)}`);
  if(report.complete.ranger.mode!=='complete'||report.complete.ranger.clipboardVisible||report.complete.ranger.stampVisible)throw new Error(`Ranger did not settle after sign-off ${JSON.stringify(report.complete.ranger)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Mountain Trail living hikers ranger response and save-safety checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
