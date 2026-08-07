import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4186','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4186').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyTownServiceQuests&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,Q=window.ToonValleyTownServiceQuests,U=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),find=p=>TV.interactables.find(i=>i.prompt===p),enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const until=async(fn,label,timeout=7000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
    const run=async(prompt,condition,label)=>{const action=find(prompt);if(!enabled(action))throw new Error(`Interaction unavailable: ${prompt}`);action.action();await until(condition,label||prompt)};
    const money0=Life.getState().player.money;

    TV.enterInterior('clinic',{x:-17,z:-19.6});
    await run('Ask Rosa about the neighborhood care package',()=>Q.getState().clinic.stage==='pickup','clinic accept');
    await run('Collect clinic care basket',()=>Q.getState().clinic.stage==='deliver','clinic pickup');
    TV.exitInterior();
    await run('Deliver care basket to Mrs. Juniper',()=>Q.getState().clinic.stage==='return','clinic delivery');
    const clinicReady=Q.getState().clinic;
    TV.enterInterior('clinic',{x:-17,z:-19.6});
    await run('Return signed care card to Rosa',()=>Q.getState().clinic.done,'clinic completion');
    TV.exitInterior();

    TV.enterInterior('theater',{x:-10,z:-24});
    await run('Ask Wren about the new movie posters',()=>Q.getState().posters.stage==='pickup','poster accept');
    await run('Collect theater poster roll',()=>Q.getState().posters.stage==='place','poster pickup');
    TV.exitInterior();
    for(const [index,name] of ['Central Plaza board','Sunshine Park board','East Market board'].entries())await run(`Hang poster at ${name}`,()=>Q.getState().posters.placed.length===index+1,`poster ${index+1}`);
    const postersReady=Q.getState().posters;
    TV.enterInterior('theater',{x:-10,z:-24});
    await run('Return empty poster tube to Wren',()=>Q.getState().posters.done,'poster completion');
    TV.exitInterior();

    const summaries=U.getSummaries(),clinicSummary=summaries.find(x=>x.title==='Clinic Care Package'),posterSummary=summaries.find(x=>x.title==='Moonbeam Poster Round');
    const visiblePosters=TV.scene.children.flatMap(o=>o.children||[]).filter(o=>o.visible&&o.scale&&Math.abs(o.scale.x-1.08)<.02&&Math.abs(o.scale.y-.74)<.02).length;
    return{counts:Q.counts,clinicReady,clinic:Q.getState().clinic,postersReady,posters:Q.getState().posters,moneyGain:Life.getState().player.money-money0,summaryCount:summaries.length,clinicSummary,posterSummary,visiblePosters};
  });
  if(report.counts.posterStops!==3)throw new Error(`Town service counts wrong ${JSON.stringify(report.counts)}`);
  if(report.clinicReady.stage!=='return'||!report.clinic.done)throw new Error(`Clinic care route incomplete ${JSON.stringify(report.clinic)}`);
  if(report.postersReady.placed.length!==3||report.postersReady.stage!=='return'||!report.posters.done)throw new Error(`Poster route incomplete ${JSON.stringify(report.posters)}`);
  if(report.moneyGain!==265)throw new Error(`Unexpected town service rewards ${report.moneyGain}`);
  if(report.summaryCount<15||!report.clinicSummary?.done||!report.posterSummary?.done)throw new Error(`ToonPhone tracker missing town service quests ${JSON.stringify(report)}`);
  if(report.visiblePosters<3)throw new Error(`Poster boards did not visibly update ${report.visiblePosters}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Town service multi-step quest checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
