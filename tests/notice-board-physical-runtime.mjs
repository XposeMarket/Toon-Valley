import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4191','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4191').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyRoutines&&window.ToonValleySideQuestRoutineBridge&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,R=window.ToonValleyRoutines,Bridge=window.ToonValleySideQuestRoutineBridge;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const until=async(fn,label,timeout=4000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await sleep(80)}throw new Error(`Timed out waiting for ${label}`)};
    const byPrompt=p=>TV.interactables.find(i=>i.prompt===p);
    const board=byPrompt('Check community notice board'),pickup=byPrompt('Pick up errand item'),delivery=byPrompt('Make errand delivery');
    if(!board||!pickup||!delivery)throw new Error('Canonical notice-board interactions missing');
    const initial={state:R.getState(),visual:R.getVisualState()};
    R.handleNoticeBoard();await until(()=>R.getState().stage===1,'acceptance');const accepted={state:R.getState(),visual:R.getVisualState()};
    if(!R.pickupErrandItem())throw new Error(`Canonical pickup API rejected stage ${JSON.stringify(R.getState())}`);await until(()=>R.getState().stage===2,'physical pickup');const loaded={state:R.getState(),visual:R.getVisualState()};
    if(!R.deliverErrandItem())throw new Error(`Canonical delivery API rejected stage ${JSON.stringify(R.getState())}`);await until(()=>R.getState().stage===3,'delivery handoff');const returning={state:R.getState(),visual:R.getVisualState()};
    R.handleNoticeBoard();await until(()=>R.getState().completed&&R.getState().stage===4,'final sign-off');const complete={state:R.getState(),visual:R.getVisualState()};
    const duplicatePrompts=/^(Collect returned books from Cal|Collect seed packet from Nina|Collect fire-station supplies from Cal|Hand book bundle to Mabel|Deliver seed packet to community garden|Hand supplies to Sam)$/;
    const duplicateEnabled=TV.interactables.filter(i=>duplicatePrompts.test(i.prompt||'')).some(i=>!i.enabled||i.enabled());
    return{initial,accepted,loaded,returning,complete,bridge:Bridge,physicalFeedback:R.physicalFeedback,duplicateEnabled,canonicalInteractionsPresent:Boolean(board&&pickup&&delivery)};
  });
  if(!report.canonicalInteractionsPresent)throw new Error(`Canonical interactions missing ${JSON.stringify(report)}`);
  if(report.physicalFeedback!=='task-specific-cargo-and-return-marker')throw new Error(`Physical feedback contract missing ${JSON.stringify(report)}`);
  if(report.bridge.canonicalStyle!=='accept-pickup-deliver-return-signoff'||report.duplicateEnabled)throw new Error(`Canonical bridge regressed ${JSON.stringify(report.bridge)}`);
  if(report.initial.visual.cargoVisible||report.initial.visual.returnMarkerVisible)throw new Error(`Idle errand visuals leaked ${JSON.stringify(report.initial)}`);
  if(report.accepted.visual.cargoVisible||report.accepted.visual.returnMarkerVisible)throw new Error(`Acceptance should show route pickup only ${JSON.stringify(report.accepted)}`);
  if(!report.loaded.visual.cargoVisible||report.loaded.visual.cargoIndex<0||report.loaded.visual.returnMarkerVisible)throw new Error(`Task-specific carried cargo missing ${JSON.stringify(report.loaded)}`);
  if(report.returning.visual.cargoVisible||!report.returning.visual.returnMarkerVisible)throw new Error(`Final board-return marker missing after delivery ${JSON.stringify(report.returning)}`);
  if(report.complete.visual.cargoVisible||report.complete.visual.returnMarkerVisible||!report.complete.visual.signoffStampVisible)throw new Error(`Sign-off visuals did not settle ${JSON.stringify(report.complete)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Notice-board physical lifecycle checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
