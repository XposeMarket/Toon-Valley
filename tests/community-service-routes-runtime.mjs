import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';
const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4194','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4194').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyCommunityServiceRoutes&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const S=window.ToonValleyCommunityServiceRoutes,UI=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const money0=Life.getState().player.money,initial=S.getSummaries(),initialVisual=S.getVisualState();
    S.lakeKioskAction();S.refresh();const lakeStart=S.getState(),lakeStartTarget=S.getTargets().lake,lakeStartVisual=S.getVisualState();
    S.collectLifeRing();S.refresh();const lakeRing=S.getState(),lakeRingTarget=S.getTargets().lake,lakeRingVisual=S.getVisualState();
    const lakeStepVisuals=[];
    for(let i=0;i<S.lakePosts.length;i++){S.inspectLakePost(i);S.refresh();lakeStepVisuals.push(S.getVisualState())}
    const lakeReady=S.getState(),lakeReadyTarget=S.getTargets().lake,moneyBeforeLake=Life.getState().player.money,lakeReadyVisual=S.getVisualState();
    S.lakeKioskAction();S.refresh();const lakeDone=S.getState(),moneyAfterLake=Life.getState().player.money,lakeDoneVisual=S.getVisualState();
    S.lanternCartAction();S.refresh();const lanternStart=S.getState(),lanternStartTarget=S.getTargets().lantern,lanternStartVisual=S.getVisualState();
    S.collectLanternCrate();S.refresh();const lanternCrate=S.getState(),lanternCrateTarget=S.getTargets().lantern,lanternCrateVisual=S.getVisualState();
    const lanternStepVisuals=[];
    for(let i=0;i<S.lanterns.length;i++){S.serviceLantern(i);S.refresh();lanternStepVisuals.push(S.getVisualState())}
    const lanternReady=S.getState(),lanternReadyTarget=S.getTargets().lantern,moneyBeforeLantern=Life.getState().player.money,lanternReadyVisual=S.getVisualState();
    S.lanternCartAction();S.refresh();const lanternDone=S.getState(),moneyAfterLantern=Life.getState().player.money,lanternDoneVisual=S.getVisualState();
    return {money0,initial,initialVisual,lakeStart,lakeStartTarget,lakeStartVisual,lakeRing,lakeRingTarget,lakeRingVisual,lakeStepVisuals,lakeReady,lakeReadyTarget,lakeReadyVisual,moneyBeforeLake,lakeDone,lakeDoneVisual,moneyAfterLake,lanternStart,lanternStartTarget,lanternStartVisual,lanternCrate,lanternCrateTarget,lanternCrateVisual,lanternStepVisuals,lanternReady,lanternReadyTarget,lanternReadyVisual,moneyBeforeLantern,lanternDone,lanternDoneVisual,moneyAfterLantern,titles:UI.getSummaries().map(x=>x.title),markerCount:S.markerCount,physicalCarryProps:S.physicalCarryProps,persistentServiceVisuals:S.persistentServiceVisuals,stateNormalization:S.stateNormalization};
  });
  if(report.markerCount!==2||report.initial.length!==2||!report.physicalCarryProps||!report.persistentServiceVisuals||!report.stateNormalization)throw new Error(`Community service routes failed to initialize ${JSON.stringify(report)}`);
  if(!report.initialVisual.rackRingVisible||!report.initialVisual.sourceCrateVisible||report.initialVisual.carriedRing||report.initialVisual.carriedCrate||report.initialVisual.checkedLakeMarkers||report.initialVisual.litLanterns)throw new Error(`Community service source visuals started in an invalid state ${JSON.stringify(report.initialVisual)}`);
  if(!report.lakeStart.lakeStarted||report.lakeStart.lakeRingCollected||report.lakeStartTarget?.name!=='dock life-ring rack'||!report.lakeStartVisual.rackRingVisible)throw new Error(`Lake route did not require explicit acceptance and pickup ${JSON.stringify(report)}`);
  if(!report.lakeRing.lakeRingCollected||report.lakeRingTarget?.name!=='north shore marker'||!report.lakeRingVisual.carriedRing||report.lakeRingVisual.rackRingVisible)throw new Error(`Lake route did not physically transfer the life ring to the player ${JSON.stringify(report)}`);
  report.lakeStepVisuals.forEach((visual,i)=>{if(visual.checkedLakeMarkers!==i+1||!visual.carriedRing)throw new Error(`Lake inspection did not leave persistent physical feedback at step ${i+1}: ${JSON.stringify(visual)}`)});
  if(report.lakeReady.lakeVisited.length!==3||!report.lakeReady.lakeAwaitingSignoff||report.moneyBeforeLake!==report.money0||report.lakeReadyTarget?.name!=='Bluebell Lake safety kiosk'||!report.lakeReadyVisual.carriedRing||report.lakeReadyVisual.checkedLakeMarkers!==3)throw new Error(`Lake route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.lakeDone.lakeDone||report.moneyAfterLake-report.money0!==140||report.lakeDoneVisual.carriedRing||report.lakeDoneVisual.checkedLakeMarkers!==3)throw new Error(`Lake route sign-off or physical cleanup failed ${JSON.stringify(report)}`);
  if(!report.lanternStart.lanternStarted||report.lanternStart.lanternCrateCollected||report.lanternStartTarget?.name!=='replacement battery crate'||!report.lanternStartVisual.sourceCrateVisible)throw new Error(`Lantern route did not require acceptance and crate pickup ${JSON.stringify(report)}`);
  if(!report.lanternCrate.lanternCrateCollected||report.lanternCrateTarget?.name!=='west path lantern'||!report.lanternCrateVisual.carriedCrate||report.lanternCrateVisual.sourceCrateVisible)throw new Error(`Lantern route did not physically transfer the battery crate to the player ${JSON.stringify(report)}`);
  report.lanternStepVisuals.forEach((visual,i)=>{if(visual.litLanterns!==i+1||!visual.carriedCrate)throw new Error(`Lantern service did not visibly restore light at step ${i+1}: ${JSON.stringify(visual)}`)});
  if(report.lanternReady.lanternVisited.length!==4||!report.lanternReady.lanternAwaitingSignoff||report.moneyBeforeLantern!==report.moneyAfterLake||report.lanternReadyTarget?.name!=='Sunshine Park maintenance cart'||!report.lanternReadyVisual.carriedCrate||report.lanternReadyVisual.litLanterns!==4)throw new Error(`Lantern route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.lanternDone.lanternDone||report.moneyAfterLantern-report.moneyAfterLake!==135||report.lanternDoneVisual.carriedCrate||report.lanternDoneVisual.litLanterns!==4)throw new Error(`Lantern route sign-off or world feedback failed ${JSON.stringify(report)}`);
  if(!report.titles.includes('Bluebell Lake Safety Round')||!report.titles.includes('Sunshine Park Lantern Round'))throw new Error(`New routes missing from ToonPhone Tasks ${JSON.stringify(report.titles)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Community lake safety and park lantern physical lifecycle checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
