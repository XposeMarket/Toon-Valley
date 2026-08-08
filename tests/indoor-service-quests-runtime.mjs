import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4187','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4187').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyIndoorServiceQuests&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,Q=window.ToonValleyIndoorServiceQuests,U=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),find=p=>TV.interactables.find(i=>i.prompt===p),enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const until=async(fn,label,timeout=7000)=>{const start=performance.now();while(performance.now()-start<timeout){if(fn())return;await sleep(100)}throw new Error(`Timed out waiting for ${label}`)};
    const run=async(prompt,condition,label)=>{const action=find(prompt);if(!enabled(action))throw new Error(`Interaction unavailable: ${prompt}`);action.action();await until(condition,label||prompt)};
    const money0=Life.getState().player.money;

    TV.enterInterior('cafe',{x:-15,z:28.1});
    await run('Ask Ari about the cafe closing shift',()=>Q.getState().cafe.stage==='pickup','cafe accept');
    await run('Collect cafe bus tub',()=>Q.getState().cafe.stage==='clear','cafe tub pickup');
    for(const [index,name] of ['window table','center table','corner table'].entries())await run(`Clear ${name}`,()=>Q.getState().cafe.cleared.length===index+1,`cafe table ${index+1}`);
    const cafeReady=Q.getState().cafe;
    await run('Return full bus tub to Ari',()=>Q.getState().cafe.done,'cafe completion');
    TV.exitInterior();

    TV.enterInterior('library',{x:-26,z:-19.6});
    await run('Ask Mabel about the return-cart books',()=>Q.getState().library.stage==='pickup','library accept');
    await run('Collect library return stack',()=>Q.getState().library.stage==='shelve','library stack pickup');
    for(const [index,name] of ['history shelf','story shelf','nature shelf'].entries())await run(`Reshelve books at ${name}`,()=>Q.getState().library.shelved.length===index+1,`library shelf ${index+1}`);
    const libraryReady=Q.getState().library;
    await run('Check completed reshelving with Mabel',()=>Q.getState().library.done,'library completion');
    TV.exitInterior();

    const summaries=U.getSummaries(),cafeSummary=summaries.find(x=>x.title==='Cafe Closing Shift'),librarySummary=summaries.find(x=>x.title==='Library Reshelving Shift');
    return{counts:Q.counts,cafeReady,cafe:Q.getState().cafe,libraryReady,library:Q.getState().library,moneyGain:Life.getState().player.money-money0,summaryCount:summaries.length,cafeSummary,librarySummary};
  });
  if(report.counts.cafeTables!==3||report.counts.libraryShelves!==3)throw new Error(`Indoor service counts wrong ${JSON.stringify(report.counts)}`);
  if(report.cafeReady.cleared.length!==3||report.cafeReady.stage!=='return'||!report.cafe.done)throw new Error(`Cafe closing shift incomplete ${JSON.stringify(report.cafe)}`);
  if(report.libraryReady.shelved.length!==3||report.libraryReady.stage!=='return'||!report.library.done)throw new Error(`Library reshelving shift incomplete ${JSON.stringify(report.library)}`);
  if(report.moneyGain!==220)throw new Error(`Unexpected indoor service rewards ${report.moneyGain}`);
  if(report.summaryCount<17||!report.cafeSummary?.done||!report.librarySummary?.done)throw new Error(`ToonPhone tracker missing indoor service quests ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Indoor service multi-step quest checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
