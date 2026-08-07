import { chromium } from 'playwright';
const url=process.env.BASE_URL||'https://toon-valley.vercel.app',expectedCommit=process.env.EXPECTED_COMMIT||null;
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 const sw=await page.request.get(`${url.replace(/\/$/,'')}/sw.js`);if(!sw.ok())throw new Error(`Production service worker returned ${sw.status()}`);
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.ToonValleyCentralPlaza&&window.ToonValleyPublicInteriors&&window.ToonValleyTheater&&window.ToonValleyOwnedHome&&window.ToonValleyWorldPolish&&window.ToonValleyBluebellLake&&window.ToonValleyInteractionFix&&window.ToonValleyTransit&&window.ToonValleyCommunityGarden&&window.ToonValleyLivingInteriors&&window.ToonValleyInteractionExperience&&window.ToonValleyMobilePolish&&window.ToonValleyServices,null,{timeout:60000});
 await page.waitForFunction(()=>!document.getElementById('boot-status'),null,{timeout:15000});
 const s=await page.evaluate(()=>({deployedCommit:document.querySelector('meta[name="toon-valley-commit"]')?.content||null,plaza:window.ToonValleyCentralPlaza.picnicTables,publicInteriors:window.ToonValleyPublicInteriors.counts,theater:window.ToonValleyTheater.counts,ownedHome:window.ToonValleyOwnedHome.counts,world:window.ToonValleyWorldPolish,lake:window.ToonValleyBluebellLake.counts,transit:window.ToonValleyTransit.counts,living:window.ToonValleyLivingInteriors.counts,interaction:window.ToonValleyInteractionExperience,mobile:window.ToonValleyMobilePolish,annex:window.ToonValleyServices.gardenAnnex,interactables:window.ToonValley.interactables.length}));
 if(expectedCommit&&s.deployedCommit!==expectedCommit)throw new Error(`Production commit mismatch: expected ${expectedCommit}, got ${s.deployedCommit||'none'}`);
 if(s.plaza!==4||s.publicInteriors.newInteriors!==4||s.theater.films!==3||s.ownedHome.decorItems!==10)throw new Error(`Production core expansion incomplete ${JSON.stringify(s)}`);
 if(!s.world.legacyPondRemoved||s.world.roadsAdded<4)throw new Error(`Production world polish missing ${JSON.stringify(s.world)}`);
 if(s.lake.lakes!==1||s.lake.boats!==1||s.lake.reeds<30||s.lake.lilyPads<8||s.lake.dockPlanks<10)throw new Error(`Production lake incomplete ${JSON.stringify(s.lake)}`);
 if(s.transit.stops!==4||s.transit.buses!==1||s.transit.routePoints<12)throw new Error(`Production transit incomplete ${JSON.stringify(s.transit)}`);
 if(s.living.areas!==10||s.living.people<20||s.living.theaterSeats!==28||s.living.cafeSeats<8)throw new Error(`Production living interiors incomplete ${JSON.stringify(s.living)}`);
 if(!s.interaction||s.interaction.pitchRange.min>-.7)throw new Error(`Production physical interaction/camera polish missing ${JSON.stringify(s.interaction)}`);
 // This test intentionally runs at a desktop viewport, where mobile-polish should
 // load but remain inactive. The dedicated production mobile smoke verifies the
 // active phone preset, Run button, portrait/landscape layout, and DPR settings.
 if(!s.mobile||typeof s.mobile.active!=='boolean')throw new Error(`Production mobile module did not initialize ${JSON.stringify(s.mobile)}`);
 if(!Array.isArray(s.annex)||s.annex.length!==5||!s.annex.every(p=>p.x<=-128&&p.z>=58))throw new Error(`Production garden annex placement invalid ${JSON.stringify(s.annex)}`);
 if(s.interactables<75)throw new Error(`Production interaction count too low ${s.interactables}`);if(errors.length)throw new Error(errors.join('\n'));console.log('Production world extensions verified',s);
}finally{await browser.close()}
