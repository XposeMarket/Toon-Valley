import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4202','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4202').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleyBluebellWildlifeSocial&&window.ToonValleyBluebellWildlifePolish&&window.ToonValleyBluebellWildlife&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const S=window.ToonValleyBluebellWildlifeSocial,P=window.ToonValleyBluebellWildlifePolish,W=window.ToonValleyBluebellWildlife,TV=window.ToonValley;
    const root=TV.scene.getObjectByName('bluebell-wildlife');
    const adult=root?.getObjectByName('bluebell-duck-1');
    const duck2=root?.getObjectByName('bluebell-duck-2');
    const duck3=root?.getObjectByName('bluebell-duck-3');
    if(!adult||!duck2||!duck3)throw new Error('Bluebell duck family missing');

    // Keep every family member outside the base flee radius while deliberately
    // spreading the ducklings so the watchful shelter correction is measurable.
    TV.player.position.set(adult.position.x+6.2,adult.position.y,adult.position.z);
    duck2.position.set(adult.position.x-2.4,duck2.position.y,adult.position.z+2.0);
    duck3.position.set(adult.position.x-2.3,duck3.position.y,adult.position.z-2.1);
    P.advance(.12);S.advance(.12);
    const shelterBefore=S.getState();
    for(let i=0;i<20;i++){P.advance(.1);S.advance(.1)}
    const shelterAfter=S.getState();

    TV.player.position.set(220,TV.terrainHeight(220,220),220);
    const chaseBefore=S.getState();
    for(let i=0;i<120;i++){W.advance(.1);P.advance(.1);S.advance(.1)}
    const chaseAfter=S.getState();
    return {flags:{active:S.active,shelter:S.ducklingShelterFormation,separation:S.postChaseSeparationClimb},shelterBefore,shelterAfter,chaseBefore,chaseAfter};
  });
  if(!Object.values(report.flags).every(Boolean))throw new Error(`Bluebell social capability flags missing ${JSON.stringify(report.flags)}`);
  const before=report.shelterBefore.shelterDistances.filter(Number.isFinite).reduce((a,b)=>a+b,0);
  const after=report.shelterAfter.shelterDistances.filter(Number.isFinite).reduce((a,b)=>a+b,0);
  if(report.shelterAfter.shelterCorrections<2||report.shelterAfter.shelterResponses<1||!Number.isFinite(before)||!Number.isFinite(after)||after>=before-.15)throw new Error(`Alert ducklings did not physically tuck into shelter formation ${JSON.stringify({before,after,state:report.shelterAfter})}`);
  if(report.chaseAfter.postChaseSeparations<1||report.chaseAfter.postChaseCorrections<2||report.chaseAfter.postChasePeakLift<.025)throw new Error(`Dragonflies did not visibly separate and climb after a chase ${JSON.stringify(report.chaseAfter)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Bluebell duckling shelter formation and dragonfly post-chase separation climb passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
