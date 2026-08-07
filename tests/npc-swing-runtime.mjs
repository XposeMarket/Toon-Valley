import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const server=spawn('python3',['-m','http.server','4175','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));await wait(900);
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
  await page.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.ToonValleySwingExitFix&&window.ToonValleyNPCBuildingLife,null,{timeout:30000});
  const state=await page.evaluate(async()=>{
    const TV=window.ToonValley, S=window.ToonValleySwingExitFix, N=window.ToonValleyNPCBuildingLife;
    const swing=TV.interactables.find(i=>i.prompt==='Play on the swings');
    swing?.action?.();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const seated={x:TV.player.position.x,z:TV.player.position.z,active:TV.state.seated};
    TV.standUpFromSeat(false);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const dismounted={x:TV.player.position.x,z:TV.player.position.z,active:TV.state.seated,blocked:TV.isBlocked(TV.player.position.x,TV.player.position.z)};

    const entered=N.forceEnter(0,'cafe');
    await new Promise(r=>requestAnimationFrame(r));
    const insideWorld={entered,state:N.getState(0),visible:TV.npcs[0].visible,tag:TV.npcs[0].userData.tvInsideArea};
    TV.enterInterior('cafe',{x:-15,z:28});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const insideCafe={visible:TV.npcs[0].visible,x:TV.npcs[0].position.x,z:TV.npcs[0].position.z,area:N.getState(0)?.area};
    const exited=N.forceExit(0);
    await new Promise(r=>requestAnimationFrame(r));
    const outsideWhileCafe={exited,state:N.getState(0),visible:TV.npcs[0].visible,tag:TV.npcs[0].userData.tvInsideArea};
    TV.exitInterior();
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const outsideWorld={visible:TV.npcs[0].visible,x:TV.npcs[0].position.x,z:TV.npcs[0].position.z};
    return {swingFix:S,seated,dismounted,swingDistance:Math.hypot(dismounted.x-seated.x,dismounted.z-seated.z),npcCounts:N.counts,insideWorld,insideCafe,outsideWhileCafe,outsideWorld};
  });
  if(!state.seated.active||state.dismounted.active||state.swingDistance<1.7)throw new Error(`Swing dismount unsafe ${JSON.stringify(state)}`);
  if(state.dismounted.blocked)throw new Error(`Swing dismount lands in collider ${JSON.stringify(state.dismounted)}`);
  if(state.npcCounts.destinations<10||state.npcCounts.npcs<10)throw new Error(`NPC building life incomplete ${JSON.stringify(state.npcCounts)}`);
  if(!state.insideWorld.entered||state.insideWorld.state?.phase!=='inside'||state.insideWorld.tag!=='cafe'||state.insideWorld.visible)throw new Error(`NPC did not transition indoors cleanly ${JSON.stringify(state.insideWorld)}`);
  if(!state.insideCafe.visible||state.insideCafe.area!=='cafe')throw new Error(`Indoor NPC not visible to player inside cafe ${JSON.stringify(state.insideCafe)}`);
  if(!state.outsideWhileCafe.exited||state.outsideWhileCafe.state?.phase!=='outside'||state.outsideWhileCafe.tag)throw new Error(`NPC did not leave building cleanly ${JSON.stringify(state.outsideWhileCafe)}`);
  if(!state.outsideWorld.visible)throw new Error(`NPC did not reappear outside ${JSON.stringify(state.outsideWorld)}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Swing dismount and NPC building-life checks passed',state);
} finally { await browser.close(); server.kill('SIGTERM'); }
