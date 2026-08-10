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
  await page.waitForFunction(()=>window.ToonValleyAmbientPedestrianLife&&window.ToonValleyAmbientPedestrianPolish&&window.ToonValley?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(180);
  const report=await page.evaluate(()=>{
    const A=window.ToonValleyAmbientPedestrianLife,P=window.ToonValleyAmbientPedestrianPolish,TV=window.ToonValley;
    TV.player.position.set(220,0,220);
    const start=P.getState();
    let streamSeen=false,bottleMoved=false,stretchSeen=false,benchSeen=false,viewpointSeen=false,photoPhoneSeen=false,seatedOffsetSeen=false;
    for(let i=0;i<1200;i++){
      A.advance(.08);P.advance(.08);
      const ps=P.getState();
      if(ps.activeHydrationStations>0)streamSeen=true;
      if(ps.activeStretchStations>0)stretchSeen=true;
      if(ps.activeBenchStations>0)benchSeen=true;
      if(ps.activeViewpointStations>0)viewpointSeen=true;
      const root=TV.scene.getObjectByName('ambient-pedestrian-life');
      const states=A.getState();
      for(const child of root?.children||[]){
        if(!child.name.startsWith('park-jogger-'))continue;
        const bottle=child.getObjectByName('jogger-water-bottle');
        if(bottle&&Math.hypot(bottle.position.x-.3,bottle.position.y-1.05,bottle.position.z-.13)>.22)bottleMoved=true;
        const phone=child.getObjectByName('jogger-view-phone');
        if(phone?.visible&&phone.position.y>1.3)photoPhoneSeen=true;
        const state=states.find(x=>x.name===child.name);
        if(state?.activity==='bench'&&state.pause>0&&Math.hypot(child.position.x-state.x,child.position.z-state.z)>.2)seatedOffsetSeen=true;
      }
      if(ps.hydrationSequences>=2&&ps.stretchSessions>=2&&ps.benchRestSessions>=2&&ps.viewpointPhotoSessions>=2&&ps.stretchPoseResets>0&&streamSeen&&bottleMoved&&stretchSeen&&benchSeen&&viewpointSeen&&photoPhoneSeen&&seatedOffsetSeen)break;
    }
    const afterRoutines=P.getState();
    let target=null;
    for(let i=0;i<200;i++){
      const joggers=A.getState().filter(x=>x.kind==='park-jogger');
      target=joggers.find(x=>x.pause===0&&x.playerYield===0);
      if(target)break;
      A.advance(.08);P.advance(.08);
    }
    if(!target)return {start,afterRoutines,streamSeen,bottleMoved,stretchSeen,benchSeen,viewpointSeen,photoPhoneSeen,seatedOffsetSeen,target:null,facingError:Infinity,afterYield:null,rootPresent:Boolean(TV.scene.getObjectByName('ambient-pedestrian-polish'))};
    const group=TV.scene.getObjectByName(target.name);
    TV.player.position.set(group.position.x+.45,group.position.y,group.position.z+.3);
    A.advance(.1);P.advance(.1);
    const afterYield=A.getState().find(x=>x.name===target.name);
    const desired=Math.atan2(TV.player.position.x-group.position.x,TV.player.position.z-group.position.z);
    const facingError=Math.abs(Math.atan2(Math.sin(group.rotation.y-desired),Math.cos(group.rotation.y-desired)));
    const stationNames=[...TV.scene.getObjectByName('ambient-pedestrian-polish').children].map(x=>x.name);
    return {start,afterRoutines,streamSeen,bottleMoved,stretchSeen,benchSeen,viewpointSeen,photoPhoneSeen,seatedOffsetSeen,target,afterYield,facingError,stationNames,rootPresent:Boolean(TV.scene.getObjectByName('ambient-pedestrian-polish'))};
  });
  if(!report.rootPresent||!report.start.finitePositions)throw new Error(`Ambient polish world failed ${JSON.stringify(report)}`);
  if(report.start.hydrationStationCount!==4||report.start.stretchStationCount!==4||report.start.benchStationCount!==4||report.start.viewpointStationCount!==4)throw new Error(`Park station population failed ${JSON.stringify(report.start)}`);
  if(report.stationNames?.filter(name=>name.startsWith('sunshine-hydration-station-')).length!==4||report.stationNames?.filter(name=>name.startsWith('sunshine-stretch-station-')).length!==4||report.stationNames?.filter(name=>name.startsWith('sunshine-rest-bench-')).length!==4||report.stationNames?.filter(name=>name.startsWith('sunshine-viewpoint-')).length!==4)throw new Error(`Physical park station scene objects missing ${JSON.stringify(report.stationNames)}`);
  if(report.afterRoutines.hydrationSequences<2||!report.afterRoutines.stationRefills.some(n=>n>0)||!report.streamSeen||!report.bottleMoved)throw new Error(`Physical refill/sip sequence failed ${JSON.stringify(report)}`);
  if(report.afterRoutines.stretchSessions<2||!report.afterRoutines.stationStretchSessions.some(n=>n>0)||!report.stretchSeen||report.afterRoutines.stretchPoseResets<1)throw new Error(`Physical stretch/reset sessions failed ${JSON.stringify(report)}`);
  if(report.afterRoutines.benchRestSessions<2||!report.afterRoutines.stationBenchSessions.some(n=>n>0)||!report.benchSeen||!report.seatedOffsetSeen)throw new Error(`Physical bench-rest sessions failed ${JSON.stringify(report)}`);
  if(report.afterRoutines.viewpointPhotoSessions<2||!report.afterRoutines.stationViewpointSessions.some(n=>n>0)||!report.viewpointSeen||!report.photoPhoneSeen)throw new Error(`Physical viewpoint/photo sessions failed ${JSON.stringify(report)}`);
  if(!report.target||!report.afterYield||report.afterYield.playerYield<=0||report.facingError>.12||report.afterRoutines.yieldFacingCorrections<0)throw new Error(`Global park yield-facing fix failed ${JSON.stringify(report)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Sunshine Park hydration, stretch/reset, bench-rest, viewpoint/photo, and global yield-facing passed runtime checks',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}