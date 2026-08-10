import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4195','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4195').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyAmbientWildlife&&window.ToonValleyAmbientPedestrianLife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const W=window.ToonValleyAmbientWildlife;
    const TV=window.ToonValley;
    const before=W.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<40;i++)W.advance(.25);
    const afterRoam=W.getState();
    const grounded=afterRoam.pigeons.find(p=>p.mode!=='flying')||afterRoam.pigeons[0];
    TV.player.position.set(grounded.x,TV.terrainHeight(grounded.x,grounded.z),grounded.z);
    W.advance(.1);
    const afterPlayerScatter=W.getState();
    for(let i=0;i<8;i++)W.advance(.15);
    const airborne=W.getState();
    for(let i=0;i<24;i++)W.advance(.15);
    const landed=W.getState();
    const calmButterfly=landed.butterflies.find(b=>b.dodge<=0)||landed.butterflies[0];
    TV.player.position.set(calmButterfly.x,TV.terrainHeight(calmButterfly.x,calmButterfly.z),calmButterfly.z);
    W.advance(.1);
    const afterButterflyDodge=W.getState();
    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    for(let i=0;i<60;i++)W.advance(.2);
    const afterFlutter=W.getState();
    const root=TV.scene.getObjectByName('ambient-wildlife');
    return {
      flags:{active:W.active,pigeons:W.reactiveTownSquarePigeons,butterflies:W.reactiveSunshineParkButterflies,pedestrians:W.pedestrianAwareWildlife,terrain:W.terrainFollowing,budget:W.lowPopulationBudget},
      before,afterRoam,afterPlayerScatter,airborne,landed,afterButterflyDodge,afterFlutter,
      rootPresent:Boolean(root),childCount:root?.children.length||0
    };
  });
  const f=report.flags;
  if(!f.active||!f.pigeons||!f.butterflies||!f.pedestrians||!f.terrain||!f.budget)throw new Error(`Ambient wildlife flags missing ${JSON.stringify(report)}`);
  if(!report.rootPresent||report.childCount!==9||report.before.pigeonCount!==4||report.before.butterflyCount!==5)throw new Error(`Ambient wildlife population did not initialize ${JSON.stringify(report)}`);
  const pigeonMoved=report.afterRoam.pigeons.some((p,i)=>Math.hypot(p.x-report.before.pigeons[i].x,p.z-report.before.pigeons[i].z)>.2||p.completedHops>report.before.pigeons[i].completedHops);
  if(!pigeonMoved)throw new Error(`Town Square pigeons did not roam ${JSON.stringify({before:report.before.pigeons,after:report.afterRoam.pigeons})}`);
  const pigeonReaction=report.afterPlayerScatter.pigeons.some((p,i)=>p.scatterCount>report.afterRoam.pigeons[i].scatterCount);
  if(report.afterPlayerScatter.playerScatters<=report.afterRoam.playerScatters||!pigeonReaction)throw new Error(`Pigeon flock did not react to nearby player ${JSON.stringify({before:report.afterRoam,after:report.afterPlayerScatter})}`);
  if(!report.airborne.pigeons.some(p=>p.mode==='flying'&&p.flightHeight>.2))throw new Error(`Pigeon scatter did not produce visible flight ${JSON.stringify(report.airborne.pigeons)}`);
  if(report.landed.pigeons.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)))throw new Error(`Pigeon terrain state became invalid ${JSON.stringify(report.landed.pigeons)}`);
  const butterflyReaction=report.afterButterflyDodge.butterflies.some((b,i)=>b.dodgeCount>report.landed.butterflies[i].dodgeCount);
  if(report.afterButterflyDodge.butterflyDodges<=report.landed.butterflyDodges||!butterflyReaction)throw new Error(`Butterfly flock did not evade nearby player ${JSON.stringify({before:report.landed,after:report.afterButterflyDodge})}`);
  const fluttered=report.afterFlutter.butterflies.some((b,i)=>Math.hypot(b.x-report.afterButterflyDodge.butterflies[i].x,b.z-report.afterButterflyDodge.butterflies[i].z)>.15||b.orbitCount>report.afterButterflyDodge.butterflies[i].orbitCount);
  if(!fluttered)throw new Error(`Sunshine Park butterflies did not continue moving between flower patches ${JSON.stringify({before:report.afterButterflyDodge.butterflies,after:report.afterFlutter.butterflies})}`);
  if(report.afterFlutter.butterflies.some(b=>!Number.isFinite(b.x)||!Number.isFinite(b.y)||!Number.isFinite(b.z)||b.y<0))throw new Error(`Butterfly terrain-following state became invalid ${JSON.stringify(report.afterFlutter.butterflies)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Reactive Town Square pigeons and Sunshine Park butterflies passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
