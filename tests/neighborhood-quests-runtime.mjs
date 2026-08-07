import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4184','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4184').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyNeighborhoodQuests&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,N=window.ToonValleyNeighborhoodQuests,U=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const until=async(fn,label,timeout=5000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return true;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
    const find=p=>TV.interactables.find(i=>i.prompt===p),enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const money0=Life.getState().player.money;

    TV.enterInterior('clinic',{x:-75,z:-9});const clinicStart=find('Ask Rosa about clinic deliveries');if(!enabled(clinicStart))throw new Error('Clinic quest start unavailable');clinicStart.action();await until(()=>N.getState().clinic.stage==='pickup','clinic quest start');TV.exitInterior();
    let clinic=N.getState().clinic;
    TV.enterInterior('cafe',{x:-15,z:28.1});const soup=find('Pick up recovery soup from Ari');if(!enabled(soup))throw new Error('Clinic soup pickup unavailable');soup.action();await until(()=>N.getState().clinic.stage==='return','clinic soup pickup');TV.exitInterior();
    clinic=N.getState().clinic;
    TV.enterInterior('clinic',{x:-75,z:-9});const clinicReturn=find('Deliver recovery soup to Rosa');if(!enabled(clinicReturn))throw new Error('Clinic return unavailable');clinicReturn.action();await until(()=>N.getState().clinic.done&&N.getState().clinic.stage==='done','clinic final handoff');TV.exitInterior();
    clinic=N.getState().clinic;

    TV.enterInterior('school',{x:72,z:-35});const schoolStart=find('Ask Ms. Maple about classroom supplies');if(!enabled(schoolStart))throw new Error('School quest start unavailable');schoolStart.action();await until(()=>N.getState().school.stage==='pickup','school quest start');TV.exitInterior();
    let school=N.getState().school;
    TV.enterInterior('generalStore',{x:26,z:-19.6});const art=find('Collect classroom art kit from Nina');if(!enabled(art))throw new Error('Art kit pickup unavailable');art.action();await until(()=>N.getState().school.stage==='return','school art-kit pickup');TV.exitInterior();
    school=N.getState().school;
    TV.enterInterior('school',{x:72,z:-35});const schoolReturn=find('Give art kit to Ms. Maple');if(!enabled(schoolReturn))throw new Error('School return unavailable');schoolReturn.action();await until(()=>N.getState().school.done&&N.getState().school.stage==='done','school final handoff');TV.exitInterior();
    school=N.getState().school;
    const summaries=U.getSummaries();
    return{clinic,school,moneyGain:Life.getState().player.money-money0,summaryCount:summaries.length,clinicSummary:summaries.find(x=>x.title==='Clinic Recovery Meal'),schoolSummary:summaries.find(x=>x.title==='Classroom Art Restock')};
  });
  if(!report.clinic.done||report.clinic.stage!=='done')throw new Error(`Clinic quest incomplete ${JSON.stringify(report.clinic)}`);
  if(!report.school.done||report.school.stage!=='done')throw new Error(`School quest incomplete ${JSON.stringify(report.school)}`);
  if(report.moneyGain!==215)throw new Error(`Unexpected neighborhood quest rewards ${report.moneyGain}`);
  if(report.summaryCount<9||!report.clinicSummary?.done||!report.schoolSummary?.done)throw new Error(`ToonPhone tracker missing neighborhood quests ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Neighborhood multi-step quest checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
