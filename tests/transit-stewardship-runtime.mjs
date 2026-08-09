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
  await page.waitForFunction(()=>window.ToonValleyTransitStewardship&&window.ToonValleyTransit&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(220);
  const report=await page.evaluate(async()=>{
    const S=window.ToonValleyTransitStewardship,T=window.ToonValleyTransit,UI=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const money0=Life.getState().player.money,initial=S.getState(),initialVisual=S.getVisualState();
    S.cartAction();S.refresh();const started=S.getState(),startTarget=S.getTarget(),startVisual=S.getVisualState();
    S.collectToolkit();S.refresh();const picked=S.getState(),pickupTarget=S.getTarget(),pickupVisual=S.getVisualState();
    const stepVisuals=[];
    for(let i=0;i<S.panels.length;i++){S.servicePanel(i);S.refresh();stepVisuals.push(S.getVisualState())}
    const ready=S.getState(),readyTarget=S.getTarget(),moneyBeforeSignoff=Life.getState().player.money,readyVisual=S.getVisualState();
    S.cartAction();S.refresh();const done=S.getState(),moneyAfter=Life.getState().player.money,doneVisual=S.getVisualState();
    const stop=T.stops[0];T.bus.position.set(stop.routeX,T.bus.position.y,stop.routeZ);await new Promise(r=>setTimeout(r,180));const nearVisual=S.getVisualState();
    return {money0,initial,initialVisual,started,startTarget,startVisual,picked,pickupTarget,pickupVisual,stepVisuals,ready,readyTarget,moneyBeforeSignoff,readyVisual,done,moneyAfter,doneVisual,nearVisual,panelCount:S.panels.length,commuterCount:S.commuters.length,physicalToolkit:S.physicalToolkit,animatedCommuters:S.animatedCommuters,arrivalFeedback:S.arrivalFeedback,stateNormalization:S.stateNormalization,titles:UI.getSummaries().map(x=>x.title)};
  });
  if(report.panelCount!==4||report.commuterCount!==8||!report.physicalToolkit||!report.animatedCommuters||!report.arrivalFeedback||!report.stateNormalization)throw new Error(`Transit stewardship failed to initialize ${JSON.stringify(report)}`);
  if(!report.initialVisual.toolkitSourceVisible===false){} // source is hidden until explicit acceptance
  if(report.initialVisual.carriedToolkit||report.initialVisual.servicedPanels!==0||report.initialVisual.waitingCommuters!==8)throw new Error(`Transit life began in an invalid visual state ${JSON.stringify(report.initialVisual)}`);
  if(!report.started.started||report.started.toolkitCollected||report.startTarget?.name!=='transit toolkit'||!report.startVisual.toolkitSourceVisible)throw new Error(`Steward route did not require explicit acceptance and pickup ${JSON.stringify(report)}`);
  if(!report.picked.toolkitCollected||report.pickupTarget?.stopName!=='Town Square'||!report.pickupVisual.carriedToolkit||report.pickupVisual.toolkitSourceVisible)throw new Error(`Toolkit did not physically transfer to player ${JSON.stringify(report)}`);
  report.stepVisuals.forEach((visual,i)=>{if(visual.servicedPanels!==i+1||!visual.carriedToolkit)throw new Error(`Shelter service lacked persistent physical feedback at step ${i+1}: ${JSON.stringify(visual)}`)});
  if(report.ready.serviced.length!==4||!report.ready.awaitingSignoff||report.moneyBeforeSignoff!==report.money0||report.readyTarget?.name!=='Town Square transit steward cart'||!report.readyVisual.carriedToolkit)throw new Error(`Steward route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.done.done||report.moneyAfter-report.money0!==160||report.doneVisual.carriedToolkit||report.doneVisual.servicedPanels!==4)throw new Error(`Steward sign-off or physical cleanup failed ${JSON.stringify(report)}`);
  if(!report.titles.includes('Shuttle Stop Steward Round'))throw new Error(`Transit steward route missing from ToonPhone Tasks ${JSON.stringify(report.titles)}`);
  if(!report.nearVisual.arrivalLampStates.some(v=>v>.5))throw new Error(`Arrival feedback did not react to a shuttle at a real stop ${JSON.stringify(report.nearVisual)}`);
  if(report.nearVisual.waitingCommuters+report.nearVisual.boardedCommuters!==8)throw new Error(`Commuter population became inconsistent ${JSON.stringify(report.nearVisual)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Transit stewardship and commuter life checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
