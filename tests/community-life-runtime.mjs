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
  await page.waitForFunction(()=>window.ToonValleyCommunityLife&&window.ToonValleyCommunityObjectives&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const TV=window.ToonValley,C=window.ToonValleyCommunityLife,O=window.ToonValleyCommunityObjectives,UI=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const money0=Life.getState().player.money;
    const initialSummaries=O.getSummaries();

    C.handleTrailGate();O.refresh();
    const trailAccepted=C.getState(),trailAcceptedTargets=O.getTargets(),trailAcceptedSummary=O.getSummaries()[0];
    C.visitTrail(0);O.refresh();
    const trailAfterFirst=C.getState(),trailAfterFirstTargets=O.getTargets(),trailAfterFirstSummary=O.getSummaries()[0];
    for(let i=1;i<C.trail.length;i++)C.visitTrail(i);
    O.refresh();
    const trailReady=C.getState(),trailReadyTargets=O.getTargets(),trailReadySummary=O.getSummaries()[0],moneyBeforeTrailSignoff=Life.getState().player.money;
    C.handleTrailGate();O.refresh();
    const trailDone=C.getState(),trailDoneTargets=O.getTargets(),trailDoneSummary=O.getSummaries()[0],moneyAfterTrail=Life.getState().player.money;

    C.showErrand();O.refresh();
    const errandAccepted=C.getState(),route=C.errands[errandAccepted.errandIndex],errandAcceptedTargets=O.getTargets(),errandAcceptedSummary=O.getSummaries()[1];
    for(const stop of route.stops){
      const interaction=TV.interactables.find(i=>i.prompt===`Community errand: ${stop.name}`&&(!i.enabled||i.enabled()));
      if(!interaction)throw new Error(`Missing enabled errand interaction for ${stop.name}`);
      interaction.action();O.refresh();
    }
    const errandReady=C.getState(),errandReadyTargets=O.getTargets(),errandReadySummary=O.getSummaries()[1],moneyBeforeErrandSignoff=Life.getState().player.money;
    C.showErrand();O.refresh();
    const errandDone=C.getState(),errandDoneTargets=O.getTargets(),errandDoneSummary=O.getSummaries()[1],moneyAfterErrand=Life.getState().player.money;
    const phoneTitles=UI?.getSummaries?.().map(item=>item.title)||[];
    return{money0,initialSummaries,trailAccepted,trailAcceptedTargets,trailAcceptedSummary,trailAfterFirst,trailAfterFirstTargets,trailAfterFirstSummary,trailReady,trailReadyTargets,trailReadySummary,trailDone,trailDoneTargets,trailDoneSummary,moneyBeforeTrailSignoff,moneyAfterTrail,errandAccepted,errandAcceptedTargets,errandAcceptedSummary,errandReady,errandReadyTargets,errandReadySummary,errandDone,errandDoneTargets,errandDoneSummary,moneyBeforeErrandSignoff,moneyAfterErrand,route:route.title,phoneTitles,markerCount:O.markerCount};
  });
  if(report.markerCount!==2)throw new Error(`Expected two community objective beacons ${JSON.stringify(report)}`);
  if(report.initialSummaries.length!==2||report.initialSummaries[0].status!=='START'||report.initialSummaries[1].status!=='START')throw new Error(`Community summaries did not initialize cleanly ${JSON.stringify(report.initialSummaries)}`);
  if(!report.trailAccepted.trailStarted||report.trailAccepted.trailVisited.length!==0)throw new Error(`Trail did not require explicit start ${JSON.stringify(report.trailAccepted)}`);
  if(report.trailAcceptedTargets.trail?.name!=='Pine Gate'||report.trailAcceptedSummary.status!=='0/4')throw new Error(`Trail objective did not point at Pine Gate ${JSON.stringify(report)}`);
  if(report.trailAfterFirstTargets.trail?.name!=='Foxglove Bend'||report.trailAfterFirstSummary.status!=='1/4')throw new Error(`Trail objective did not advance to Foxglove Bend ${JSON.stringify(report)}`);
  if(report.trailReady.trailVisited.length!==4||!report.trailReady.trailAwaitingSignoff||report.moneyBeforeTrailSignoff!==report.money0)throw new Error(`Trail rewarded before ranger sign-off ${JSON.stringify(report)}`);
  if(report.trailReadyTargets.trail?.name!=='Mountain Trail ranger station'||report.trailReadySummary.status!=='SIGN OFF')throw new Error(`Trail objective did not return to ranger sign-off ${JSON.stringify(report)}`);
  if(!report.trailDone.trailDone||report.trailDone.trailAwaitingSignoff||report.moneyAfterTrail-report.money0!==120||report.trailDoneTargets.trail!==null||report.trailDoneSummary.status!=='DONE')throw new Error(`Trail sign-off failed ${JSON.stringify(report)}`);
  if(!report.errandAccepted.errandStarted||report.errandAccepted.errandVisited.length!==0)throw new Error(`Errand did not require board acceptance ${JSON.stringify(report.errandAccepted)}`);
  if(report.errandAcceptedTargets.errand?.name!==report.errandAcceptedSummary.text.match(/to ([^·]+?)(?: and| ·)/)?.[1]&&report.errandAcceptedTargets.errand==null)throw new Error(`Errand objective missing after acceptance ${JSON.stringify(report)}`);
  if(report.errandReady.errandVisited.length!==3||!report.errandReady.errandAwaitingSignoff||report.moneyBeforeErrandSignoff!==report.moneyAfterTrail)throw new Error(`Errand rewarded before board sign-off ${JSON.stringify(report)}`);
  if(report.errandReadyTargets.errand?.name!=='Community errand board'||report.errandReadySummary.status!=='SIGN OFF')throw new Error(`Errand objective did not return to board ${JSON.stringify(report)}`);
  if(!report.errandDone.errandDone||report.errandDone.errandAwaitingSignoff||report.moneyAfterErrand-report.moneyAfterTrail!==165||report.errandDoneTargets.errand!==null||report.errandDoneSummary.status!=='DONE')throw new Error(`Errand board sign-off failed ${JSON.stringify(report)}`);
  if(!report.phoneTitles.includes('Mountain Trail Card')||!report.phoneTitles.includes(report.route))throw new Error(`Community activities missing from ToonPhone Tasks ${JSON.stringify(report.phoneTitles)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Community wayfinding trail errand and task UI lifecycle checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
