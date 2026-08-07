import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4185','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4185').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyCivicQuests&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,C=window.ToonValleyCivicQuests,U=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),find=p=>TV.interactables.find(i=>i.prompt===p),enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const until=async(fn,label,timeout=6000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
    const money0=Life.getState().player.money;

    TV.enterInterior('fireStation',{x:-51.8,z:-25});const startHydrant=find('Ask Sam about hydrant inspections');if(!enabled(startHydrant))throw new Error('Hydrant quest start unavailable');startHydrant.action();await until(()=>C.getState().hydrants.started,'hydrant start');TV.exitInterior();
    for(const [index,name] of ['Maple Avenue hydrant','Sunshine Park hydrant','East Market hydrant'].entries()){const action=find(`Inspect ${name}`);if(!enabled(action))throw new Error(`Hydrant action unavailable: ${name}`);action.action();await until(()=>C.getState().hydrants.checked.length===index+1,`hydrant ${index+1} inspection`)}
    const hydrantsReady=C.getState().hydrants;
    TV.enterInterior('fireStation',{x:-51.8,z:-25});const reportHydrant=find('Report hydrant round to Sam');if(!enabled(reportHydrant))throw new Error('Hydrant report unavailable');reportHydrant.action();await until(()=>C.getState().hydrants.done,'hydrant completion');TV.exitInterior();

    TV.enterInterior('postOffice',{x:52.6,z:-25});const parcelStart=find('Ask Cal for neighborhood parcel route');if(!enabled(parcelStart))throw new Error('Parcel route start unavailable');parcelStart.action();await until(()=>C.getState().parcels.stage==='load','parcel accept');const load=find('Load neighborhood parcel satchel');if(!enabled(load))throw new Error('Parcel load unavailable');load.action();await until(()=>C.getState().parcels.stage==='deliver','parcel load');TV.exitInterior();
    for(const [index,name] of ['Mrs. Juniper','Mr. Maple','Jamie'].entries()){const action=find(`Deliver parcel to ${name}`);if(!enabled(action))throw new Error(`Parcel delivery unavailable: ${name}`);action.action();await until(()=>C.getState().parcels.delivered.length===index+1,`parcel ${index+1} delivery`)}
    const parcelsReady=C.getState().parcels;
    TV.enterInterior('postOffice',{x:52.6,z:-25});const returnSatchel=find('Return delivery satchel to Cal');if(!enabled(returnSatchel))throw new Error('Satchel return unavailable');returnSatchel.action();await until(()=>C.getState().parcels.done,'parcel completion');TV.exitInterior();

    const summaries=U.getSummaries();
    return{hydrantsReady,hydrants:C.getState().hydrants,parcelsReady,parcels:C.getState().parcels,moneyGain:Life.getState().player.money-money0,summaryCount:summaries.length,hydrantSummary:summaries.find(x=>x.title==='Hydrant Safety Round'),parcelSummary:summaries.find(x=>x.title==='Neighborhood Parcel Route')};
  });
  if(report.hydrantsReady.checked.length!==3||!report.hydrantsReady.ready||!report.hydrants.done)throw new Error(`Hydrant route incomplete ${JSON.stringify(report.hydrants)}`);
  if(report.parcelsReady.delivered.length!==3||report.parcelsReady.stage!=='return'||!report.parcels.done)throw new Error(`Parcel route incomplete ${JSON.stringify(report.parcels)}`);
  if(report.moneyGain!==265)throw new Error(`Unexpected civic quest rewards ${report.moneyGain}`);
  if(report.summaryCount<11||!report.hydrantSummary?.done||!report.parcelSummary?.done)throw new Error(`ToonPhone tracker missing civic quests ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Civic multi-step quest checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
