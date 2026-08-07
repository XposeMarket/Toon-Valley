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
    const until=async(fn,label,timeout=7000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
    const run=async(prompt,condition,label)=>{const action=find(prompt);if(!enabled(action))throw new Error(`Interaction unavailable: ${prompt}`);action.action();await until(condition,label||prompt)};
    const money0=Life.getState().player.money;

    TV.enterInterior('fireStation',{x:-51.8,z:-25});await run('Ask Sam about hydrant inspections',()=>C.getState().hydrants.started,'hydrant start');TV.exitInterior();
    for(const [index,name] of ['Maple Avenue hydrant','Sunshine Park hydrant','East Market hydrant'].entries())await run(`Inspect ${name}`,()=>C.getState().hydrants.checked.length===index+1,`hydrant ${index+1}`);
    const hydrantsReady=C.getState().hydrants;
    TV.enterInterior('fireStation',{x:-51.8,z:-25});await run('Report hydrant round to Sam',()=>C.getState().hydrants.done,'hydrant completion');TV.exitInterior();

    TV.enterInterior('postOffice',{x:52.6,z:-25});await run('Ask Cal for neighborhood parcel route',()=>C.getState().parcels.stage==='load','parcel accept');await run('Load neighborhood parcel satchel',()=>C.getState().parcels.stage==='deliver','parcel load');TV.exitInterior();
    for(const [index,name] of ['Mrs. Juniper','Mr. Maple','Jamie'].entries())await run(`Deliver parcel to ${name}`,()=>C.getState().parcels.delivered.length===index+1,`parcel ${index+1}`);
    const parcelsReady=C.getState().parcels;
    TV.enterInterior('postOffice',{x:52.6,z:-25});await run('Return delivery satchel to Cal',()=>C.getState().parcels.done,'parcel completion');TV.exitInterior();

    TV.enterInterior('cityHall',{x:-3.5,z:-27});await run('Ask June about streetlight maintenance',()=>C.getState().lights.stage==='toolkit','streetlight accept');await run('Collect streetlight maintenance toolkit',()=>C.getState().lights.stage==='inspect','streetlight toolkit');TV.exitInterior();
    for(const [index,name] of ['Central Plaza lamp','Maple Avenue lamp','East Neighborhood lamp'].entries())await run(`Inspect ${name}`,()=>C.getState().lights.checked.length===index+1,`streetlight ${index+1}`);
    const lightsReady=C.getState().lights;
    TV.enterInterior('cityHall',{x:-3.5,z:-27});await run('Return streetlight toolkit and report to June',()=>C.getState().lights.done,'streetlight completion');TV.exitInterior();

    TV.enterInterior('generalStore',{x:26,z:-19.6});await run('Ask Nina about the school supply order',()=>C.getState().school.stage==='load','school order accept');await run('Load Rainbow Elementary supply crate',()=>C.getState().school.stage==='deliver','school crate load');TV.exitInterior();
    TV.enterInterior('school',{x:-33.5,z:43});await run('Hand school supplies to Ms. Maple',()=>C.getState().school.stage==='return','school handoff');TV.exitInterior();
    const schoolReady=C.getState().school;
    TV.enterInterior('generalStore',{x:26,z:-19.6});await run('Return signed school receipt to Nina',()=>C.getState().school.done,'school completion');TV.exitInterior();

    const summaries=U.getSummaries();
    return{counts:C.counts,hydrantsReady,hydrants:C.getState().hydrants,parcelsReady,parcels:C.getState().parcels,lightsReady,lights:C.getState().lights,schoolReady,school:C.getState().school,moneyGain:Life.getState().player.money-money0,summaryCount:summaries.length,hydrantSummary:summaries.find(x=>x.title==='Hydrant Safety Round'),parcelSummary:summaries.find(x=>x.title==='Neighborhood Parcel Route'),lightSummary:summaries.find(x=>x.title==='Streetlight Maintenance Round'),schoolSummary:summaries.find(x=>x.title==='Rainbow Elementary Supply Run')};
  });
  if(report.counts.quests!==4||report.counts.streetlights!==3)throw new Error(`Civic quest counts wrong ${JSON.stringify(report.counts)}`);
  if(report.hydrantsReady.checked.length!==3||!report.hydrantsReady.ready||!report.hydrants.done)throw new Error(`Hydrant route incomplete ${JSON.stringify(report.hydrants)}`);
  if(report.parcelsReady.delivered.length!==3||report.parcelsReady.stage!=='return'||!report.parcels.done)throw new Error(`Parcel route incomplete ${JSON.stringify(report.parcels)}`);
  if(report.lightsReady.checked.length!==3||report.lightsReady.stage!=='return'||!report.lights.done)throw new Error(`Streetlight round incomplete ${JSON.stringify(report.lights)}`);
  if(report.schoolReady.stage!=='return'||!report.school.done)throw new Error(`School supply run incomplete ${JSON.stringify(report.school)}`);
  if(report.moneyGain!==530)throw new Error(`Unexpected civic quest rewards ${report.moneyGain}`);
  if(report.summaryCount<13||!report.hydrantSummary?.done||!report.parcelSummary?.done||!report.lightSummary?.done||!report.schoolSummary?.done)throw new Error(`ToonPhone tracker missing civic quests ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Expanded civic multi-step quest checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
