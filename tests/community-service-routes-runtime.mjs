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
    const money0=Life.getState().player.money,initial=S.getSummaries();
    S.lakeKioskAction();S.refresh();const lakeStart=S.getState(),lakeStartTarget=S.getTargets().lake;
    S.collectLifeRing();S.refresh();const lakeRing=S.getState(),lakeRingTarget=S.getTargets().lake;
    for(let i=0;i<S.lakePosts.length;i++)S.inspectLakePost(i);
    S.refresh();const lakeReady=S.getState(),lakeReadyTarget=S.getTargets().lake,moneyBeforeLake=Life.getState().player.money;
    S.lakeKioskAction();S.refresh();const lakeDone=S.getState(),moneyAfterLake=Life.getState().player.money;
    S.lanternCartAction();S.refresh();const lanternStart=S.getState(),lanternStartTarget=S.getTargets().lantern;
    S.collectLanternCrate();S.refresh();const lanternCrate=S.getState(),lanternCrateTarget=S.getTargets().lantern;
    for(let i=0;i<S.lanterns.length;i++)S.serviceLantern(i);
    S.refresh();const lanternReady=S.getState(),lanternReadyTarget=S.getTargets().lantern,moneyBeforeLantern=Life.getState().player.money;
    S.lanternCartAction();S.refresh();const lanternDone=S.getState(),moneyAfterLantern=Life.getState().player.money;
    return {money0,initial,lakeStart,lakeStartTarget,lakeRing,lakeRingTarget,lakeReady,lakeReadyTarget,moneyBeforeLake,lakeDone,moneyAfterLake,lanternStart,lanternStartTarget,lanternCrate,lanternCrateTarget,lanternReady,lanternReadyTarget,moneyBeforeLantern,lanternDone,moneyAfterLantern,titles:UI.getSummaries().map(x=>x.title),markerCount:S.markerCount};
  });
  if(report.markerCount!==2||report.initial.length!==2)throw new Error(`Community service routes failed to initialize ${JSON.stringify(report)}`);
  if(!report.lakeStart.lakeStarted||report.lakeStart.lakeRingCollected||report.lakeStartTarget?.name!=='dock life-ring rack')throw new Error(`Lake route did not require explicit acceptance and pickup ${JSON.stringify(report)}`);
  if(!report.lakeRing.lakeRingCollected||report.lakeRingTarget?.name!=='north shore marker')throw new Error(`Lake route did not advance after physical ring pickup ${JSON.stringify(report)}`);
  if(report.lakeReady.lakeVisited.length!==3||!report.lakeReady.lakeAwaitingSignoff||report.moneyBeforeLake!==report.money0||report.lakeReadyTarget?.name!=='Bluebell Lake safety kiosk')throw new Error(`Lake route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.lakeDone.lakeDone||report.moneyAfterLake-report.money0!==140)throw new Error(`Lake route sign-off failed ${JSON.stringify(report)}`);
  if(!report.lanternStart.lanternStarted||report.lanternStart.lanternCrateCollected||report.lanternStartTarget?.name!=='replacement battery crate')throw new Error(`Lantern route did not require acceptance and crate pickup ${JSON.stringify(report)}`);
  if(!report.lanternCrate.lanternCrateCollected||report.lanternCrateTarget?.name!=='west path lantern')throw new Error(`Lantern route did not advance after crate pickup ${JSON.stringify(report)}`);
  if(report.lanternReady.lanternVisited.length!==4||!report.lanternReady.lanternAwaitingSignoff||report.moneyBeforeLantern!==report.moneyAfterLake||report.lanternReadyTarget?.name!=='Sunshine Park maintenance cart')throw new Error(`Lantern route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.lanternDone.lanternDone||report.moneyAfterLantern-report.moneyAfterLake!==135)throw new Error(`Lantern route sign-off failed ${JSON.stringify(report)}`);
  if(!report.titles.includes('Bluebell Lake Safety Round')||!report.titles.includes('Sunshine Park Lantern Round'))throw new Error(`New routes missing from ToonPhone Tasks ${JSON.stringify(report.titles)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Community lake safety and park lantern lifecycle checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
