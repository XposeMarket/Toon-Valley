import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4192','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4192').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyCommunityLife&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const TV=window.ToonValley,C=window.ToonValleyCommunityLife,Life=window.ToonValleyLife;
    const money0=Life.getState().player.money;

    C.handleTrailGate();
    const trailAccepted=C.getState();
    for(let i=0;i<C.trail.length;i++)C.visitTrail(i);
    const trailReady=C.getState(),moneyBeforeTrailSignoff=Life.getState().player.money;
    C.handleTrailGate();
    const trailDone=C.getState(),moneyAfterTrail=Life.getState().player.money;

    C.showErrand();
    const errandAccepted=C.getState(),route=C.errands[errandAccepted.errandIndex];
    for(const stop of route.stops){
      const interaction=TV.interactables.find(i=>i.prompt===`Community errand: ${stop.name}`&&(!i.enabled||i.enabled()));
      if(!interaction)throw new Error(`Missing enabled errand interaction for ${stop.name}`);
      interaction.action();
    }
    const errandReady=C.getState(),moneyBeforeErrandSignoff=Life.getState().player.money;
    C.showErrand();
    const errandDone=C.getState(),moneyAfterErrand=Life.getState().player.money;
    return{money0,trailAccepted,trailReady,trailDone,moneyBeforeTrailSignoff,moneyAfterTrail,errandAccepted,errandReady,errandDone,moneyBeforeErrandSignoff,moneyAfterErrand,route:route.title};
  });
  if(!report.trailAccepted.trailStarted||report.trailAccepted.trailVisited.length!==0)throw new Error(`Trail did not require explicit start ${JSON.stringify(report.trailAccepted)}`);
  if(report.trailReady.trailVisited.length!==4||!report.trailReady.trailAwaitingSignoff||report.moneyBeforeTrailSignoff!==report.money0)throw new Error(`Trail rewarded before ranger sign-off ${JSON.stringify(report)}`);
  if(!report.trailDone.trailDone||report.trailDone.trailAwaitingSignoff||report.moneyAfterTrail-report.money0!==120)throw new Error(`Trail sign-off failed ${JSON.stringify(report)}`);
  if(!report.errandAccepted.errandStarted||report.errandAccepted.errandVisited.length!==0)throw new Error(`Errand did not require board acceptance ${JSON.stringify(report.errandAccepted)}`);
  if(report.errandReady.errandVisited.length!==3||!report.errandReady.errandAwaitingSignoff||report.moneyBeforeErrandSignoff!==report.moneyAfterTrail)throw new Error(`Errand rewarded before board sign-off ${JSON.stringify(report)}`);
  if(!report.errandDone.errandDone||report.errandDone.errandAwaitingSignoff||report.moneyAfterErrand-report.moneyAfterTrail!==165)throw new Error(`Errand board sign-off failed ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Community trail and errand lifecycle checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
