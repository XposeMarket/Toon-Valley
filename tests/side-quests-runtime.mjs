import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4182','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4182').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValleySideQuests&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);

  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,Q=window.ToonValleySideQuests,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const byPrompt=p=>TV.interactables.find(i=>i.prompt===p);
    const enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const money0=Life.getState().player.money;

    // Lost pet: pet must follow across town and only completes at the owner's door.
    const pet=byPrompt('Help Mochi get home');
    pet.action();
    const petStart=Q.getState();
    TV.player.position.set(65,TV.terrainHeight(65,60),60);
    await sleep(350);
    const petObject=pet.object;
    const followDistance=Math.hypot(petObject.position.x-TV.player.position.x,petObject.position.z-TV.player.position.z);
    const knock=byPrompt("Knock for Mochi's owner");
    if(!enabled(knock))throw new Error('Lost pet owner door did not activate');
    knock.action();await sleep(80);
    const petDone=Q.getState();
    const owner=[...TV.scene.children].find(o=>o.userData?.name==='Mrs. Juniper');

    // Forage: four bushes fill a carried basket; cafe handoff is the completion.
    const berries=TV.interactables.filter(i=>i.prompt==='Gather wild berries').slice(0,4);berries.forEach(i=>i.action());
    const forageReady=Q.getState().forage;
    TV.enterInterior('cafe',{x:-15,z:28.1});
    const berryDrop=byPrompt('Hand berry basket to Ari');
    if(!enabled(berryDrop))throw new Error('Berry cafe handoff did not activate');
    berryDrop.action();TV.exitInterior();
    const forageDone=Q.getState().forage;

    // Cleanup: collect every piece, physically return the bag to the park bin.
    const litter=TV.interactables.filter(i=>i.prompt==='Pick up litter');litter.forEach(i=>i.action());
    const cleanupReady=Q.getState().cleanup;
    const bin=byPrompt('Drop cleanup bag in park bin');if(!enabled(bin))throw new Error('Cleanup return bin did not activate');bin.action();
    const cleanupDone=Q.getState().cleanup;

    // Bird survey: notebook checkout -> four observations -> library return.
    TV.enterInterior('library',{x:-26,z:-19.6});
    const checkout=byPrompt('Check out bird survey notebook');if(!enabled(checkout))throw new Error('Bird notebook checkout missing');checkout.action();TV.exitInterior();
    const birds=TV.interactables.filter(i=>/^Observe /.test(i.prompt||''));birds.forEach(i=>{if(enabled(i))i.action()});
    const birdReady=Q.getState().birds;
    TV.enterInterior('library',{x:-26,z:-19.6});const birdReturn=byPrompt('Return completed bird survey to Mabel');if(!enabled(birdReturn))throw new Error('Bird survey return missing');birdReturn.action();TV.exitInterior();
    const birdDone=Q.getState().birds;

    // Garden: borrow can -> water six individual beds -> return equipment.
    Q.startGarden();
    const gardenBeds=TV.interactables.filter(i=>/^Water raised garden bed /.test(i.prompt||''));gardenBeds.forEach(i=>{if(enabled(i))i.action()});
    const gardenReady=Q.getState().garden;
    const canReturn=byPrompt('Return watering can');if(!enabled(canReturn))throw new Error('Watering-can return missing');canReturn.action();
    const gardenDone=Q.getState().garden;

    // Notice board: accept -> collect actual cargo from a source -> deliver to target.
    Q.acceptNotice();
    const noticeCollect=TV.interactables.find(i=>/^(Collect returned books|Collect seed packet|Collect fire-station supplies)/.test(i.prompt||'')&&enabled(i));
    if(!noticeCollect)throw new Error('Notice-board pickup leg missing');noticeCollect.action();
    const noticeLoaded=Q.getState().notice;
    const noticeDeliver=TV.interactables.find(i=>/^(Hand book bundle|Deliver seed packet|Hand supplies)/.test(i.prompt||'')&&enabled(i));
    if(!noticeDeliver)throw new Error('Notice-board delivery leg missing');noticeDeliver.action();
    const noticeDone=Q.getState().notice;

    // Farmers market: start survey -> taste three marked samples -> report back.
    Q.marketAction();
    const samples=TV.interactables.filter(i=>/^Taste market sample /.test(i.prompt||''));samples.forEach(i=>{if(enabled(i))i.action()});
    const marketReady=Q.getState().market;Q.marketAction();const marketDone=Q.getState().market;

    const oldErrand=byPrompt('Complete community errand'),oldWater=TV.interactables.filter(i=>i.prompt==='Water community garden');
    return {
      counts:Q.counts,audit:Q.audit,moneyGain:Life.getState().player.money-money0,
      pet:{activeAtStart:petStart.pets.active,followDistance,done:petDone.pets.done.includes(0),ownerVisible:Boolean(owner?.visible)},
      forage:{ready:forageReady.ready,collected:forageReady.collected.length,done:forageDone.delivered},
      cleanup:{ready:cleanupReady.ready,collected:cleanupReady.collected.length,done:cleanupDone.delivered},
      birds:{started:birdReady.started,seen:birdReady.seen.length,ready:birdReady.ready,done:birdDone.returned},
      garden:{watered:gardenReady.watered.length,readyToReturn:gardenReady.started,done:gardenDone.returned},
      notice:{loaded:noticeLoaded.stage,done:noticeDone.completed},
      market:{samples:marketReady.samples.length,done:marketDone.completed},
      oldOneClickDisabled:!oldErrand?.enabled?.()&&oldWater.every(i=>!i.enabled?.())
    };
  });

  if(report.counts.overhauled<7||report.audit.alreadySubstantive.length<8)throw new Error(`Quest audit incomplete ${JSON.stringify(report)}`);
  if(report.pet.activeAtStart!==0||report.pet.followDistance>3||!report.pet.done||!report.pet.ownerVisible)throw new Error(`Lost pet escort failed ${JSON.stringify(report.pet)}`);
  if(!report.forage.ready||report.forage.collected<4||!report.forage.done)throw new Error(`Forage delivery failed ${JSON.stringify(report.forage)}`);
  if(!report.cleanup.ready||report.cleanup.collected<6||!report.cleanup.done)throw new Error(`Cleanup return failed ${JSON.stringify(report.cleanup)}`);
  if(!report.birds.started||report.birds.seen<4||!report.birds.ready||!report.birds.done)throw new Error(`Bird survey failed ${JSON.stringify(report.birds)}`);
  if(report.garden.watered!==6||!report.garden.readyToReturn||!report.garden.done)throw new Error(`Garden round failed ${JSON.stringify(report.garden)}`);
  if(report.notice.loaded!=='deliver'||!report.notice.done)throw new Error(`Notice errand failed ${JSON.stringify(report.notice)}`);
  if(report.market.samples!==3||!report.market.done)throw new Error(`Market survey failed ${JSON.stringify(report.market)}`);
  if(!report.oldOneClickDisabled)throw new Error('Legacy one-click quest endpoints are still active');
  if(report.moneyGain<400)throw new Error(`Quest completion rewards missing ${report.moneyGain}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Multi-step side quest runtime checks passed',report);
} finally {
  await browser.close();if(server)server.kill('SIGTERM');
}
