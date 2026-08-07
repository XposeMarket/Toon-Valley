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
  await page.waitForFunction(()=>window.ToonValleySideQuests&&window.ToonValleySideQuestUI&&window.ToonValleyServices&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(160);

  const report=await page.evaluate(async()=>{
    const TV=window.ToonValley,Q=window.ToonValleySideQuests,UI=window.ToonValleySideQuestUI,S=window.ToonValleyServices,Life=window.ToonValleyLife;
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const byPrompt=p=>TV.interactables.find(i=>i.prompt===p);
    const enabled=i=>Boolean(i&&(!i.enabled||i.enabled()));
    const money0=Life.getState().player.money,trackerBefore=UI.getSummaries();

    const pet=byPrompt('Help Mochi get home'),petObject=pet.object,petBefore={x:petObject.position.x,z:petObject.position.z};
    pet.action();await sleep(1120);const petStart=S.getState();
    TV.player.position.set(petBefore.x+5,TV.terrainHeight(petBefore.x+5,petBefore.z),petBefore.z);const distanceBefore=Math.hypot(petObject.position.x-TV.player.position.x,petObject.position.z-TV.player.position.z);await sleep(950);
    const distanceAfter=Math.hypot(petObject.position.x-TV.player.position.x,petObject.position.z-TV.player.position.z),moved=Math.hypot(petObject.position.x-petBefore.x,petObject.position.z-petBefore.z),home=S.petHomes.find(h=>h.name==='Mochi');
    TV.player.position.set(home.x,TV.terrainHeight(home.x,home.z),home.z);petObject.position.set(home.x+1,TV.terrainHeight(home.x+1,home.z),home.z+.5);
    const knock=byPrompt("Knock on Mrs. Juniper's door");if(!enabled(knock))throw new Error(`Lost pet real-house door did not activate: ${JSON.stringify(petStart)}`);knock.action();await sleep(120);
    const petDone=S.getState(),ownerVisible=knock.object.children.some(c=>c.visible&&c.userData?.arms),trackerAfterPet=UI.getSummaries();

    const berries=TV.interactables.filter(i=>i.prompt==='Gather wild berries').slice(0,4);for(const i of berries){if(enabled(i))i.action()}const forageReady=Q.getState().forage;
    TV.enterInterior('cafe',{x:-15,z:28.1});const berryDrop=byPrompt('Hand berry basket to Ari');if(!enabled(berryDrop))throw new Error('Berry cafe handoff did not activate');berryDrop.action();TV.exitInterior();const forageDone=Q.getState().forage;

    const litter=TV.interactables.filter(i=>i.prompt==='Pick up litter');for(const i of litter){if(enabled(i)){i.action();await sleep(620)}}const cleanupReady=Q.getState().cleanup;const bin=byPrompt('Drop cleanup bag in park bin');if(!enabled(bin))throw new Error('Cleanup return bin did not activate');bin.action();const cleanupDone=Q.getState().cleanup;

    TV.enterInterior('library',{x:-26,z:-19.6});const checkout=byPrompt('Check out bird survey notebook');if(!enabled(checkout))throw new Error('Bird notebook checkout missing');checkout.action();TV.exitInterior();const birds=TV.interactables.filter(i=>/^Observe /.test(i.prompt||''));for(const i of birds){if(enabled(i)){i.action();await sleep(620)}}const birdReady=Q.getState().birds;
    TV.enterInterior('library',{x:-26,z:-19.6});const birdReturn=byPrompt('Return completed bird survey to Mabel');if(!enabled(birdReturn))throw new Error('Bird survey return missing');birdReturn.action();TV.exitInterior();const birdDone=Q.getState().birds;

    Q.startGarden();const gardenBeds=TV.interactables.filter(i=>/^Water raised garden bed /.test(i.prompt||''));for(const i of gardenBeds){if(enabled(i))i.action()}const gardenReady=Q.getState().garden;const canReturn=byPrompt('Return watering can');if(!enabled(canReturn))throw new Error('Watering-can return missing');canReturn.action();const gardenDone=Q.getState().garden;

    Q.acceptNotice();const noticeCollect=TV.interactables.find(i=>/^(Collect returned books|Collect seed packet|Collect fire-station supplies)/.test(i.prompt||'')&&enabled(i));if(!noticeCollect)throw new Error('Notice-board pickup leg missing');noticeCollect.action();await sleep(620);const noticeLoaded=Q.getState().notice;
    const noticeDeliver=TV.interactables.find(i=>/^(Hand book bundle|Deliver seed packet|Hand supplies)/.test(i.prompt||'')&&enabled(i));if(!noticeDeliver)throw new Error('Notice-board delivery leg missing');noticeDeliver.action();await sleep(620);const noticeDone=Q.getState().notice;

    Q.marketAction();const samples=TV.interactables.filter(i=>/^Taste market sample /.test(i.prompt||''));for(const i of samples){if(enabled(i))i.action()}const marketReady=Q.getState().market;Q.marketAction();const marketDone=Q.getState().market;
    const trackerDone=UI.getSummaries(),oldErrand=byPrompt('Complete community errand'),oldWater=TV.interactables.filter(i=>i.prompt==='Water community garden bed');
    return {counts:Q.counts,audit:Q.audit,moneyGain:Life.getState().player.money-money0,trackerBefore,trackerAfterPet,trackerDone,
      pet:{questStyle:S.questStyle,activeAtStart:petStart.activePet,distanceBefore,distanceAfter,moved,done:petDone.petsFound.includes(0),ownerVisible,home},
      forage:{ready:forageReady.ready,collected:forageReady.collected.length,done:forageDone.delivered},cleanup:{ready:cleanupReady.ready,collected:cleanupReady.collected.length,done:cleanupDone.delivered},
      birds:{started:birdReady.started,seen:birdReady.seen.length,ready:birdReady.ready,done:birdDone.returned},garden:{watered:gardenReady.watered.length,readyToReturn:gardenReady.started,done:gardenDone.returned},
      notice:{loaded:noticeLoaded.stage,done:noticeDone.completed},market:{samples:marketReady.samples.length,done:marketDone.completed},oldOneClickDisabled:!oldErrand?.enabled?.()&&oldWater.every(i=>!i.enabled?.())};
  });

  if(report.counts.overhauled<6||report.audit.alreadySubstantive.length<9||report.trackerBefore.length!==7)throw new Error(`Quest audit/tracker incomplete ${JSON.stringify(report)}`);
  if(report.pet.questStyle!=='multi-step-escort-real-house-owner-handoff'||report.pet.activeAtStart!==0||report.pet.moved<.5||report.pet.distanceAfter>=report.pet.distanceBefore||!report.pet.done||!report.pet.ownerVisible)throw new Error(`Lost pet escort failed ${JSON.stringify(report.pet)}`);
  if(!report.trackerAfterPet.find(q=>q.title==='Lost Pet Rescue')?.status.includes('1/'))throw new Error(`Pet tracker did not update ${JSON.stringify(report.trackerAfterPet)}`);
  if(!report.forage.ready||report.forage.collected<4||!report.forage.done)throw new Error(`Forage delivery failed ${JSON.stringify(report.forage)}`);
  if(!report.cleanup.ready||report.cleanup.collected<6||!report.cleanup.done)throw new Error(`Cleanup return failed ${JSON.stringify(report.cleanup)}`);
  if(!report.birds.started||report.birds.seen<4||!report.birds.ready||!report.birds.done)throw new Error(`Bird survey failed ${JSON.stringify(report.birds)}`);
  if(report.garden.watered!==6||!report.garden.readyToReturn||!report.garden.done)throw new Error(`Garden round failed ${JSON.stringify(report.garden)}`);
  if(report.notice.loaded!=='deliver'||!report.notice.done)throw new Error(`Notice errand failed ${JSON.stringify(report.notice)}`);
  if(report.market.samples!==3||!report.market.done)throw new Error(`Market survey failed ${JSON.stringify(report.market)}`);
  if(!report.oldOneClickDisabled)throw new Error('Legacy one-click quest endpoints are still active');
  if(report.moneyGain<400)throw new Error(`Quest completion rewards missing ${report.moneyGain}`);
  const completedTitles=new Set(report.trackerDone.filter(q=>q.done).map(q=>q.title));for(const title of ['Cafe Berry Basket','Community Cleanup','Valley Bird Survey','Garden Care Round','Farmers-Market Survey'])if(!completedTitles.has(title))throw new Error(`Tracker did not mark ${title} complete`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Multi-step side quest runtime checks passed',report);
} finally {await browser.close();if(server)server.kill('SIGTERM')}
