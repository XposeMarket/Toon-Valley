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
  await page.waitForFunction(()=>window.ToonValleyTransitStewardship&&window.ToonValleyTransitRiderLife&&window.ToonValleyTransit&&window.ToonValleySideQuestUI&&window.ToonValleyLife?.getState()?.player,null,{timeout:45000});
  await page.click('#play-button');await wait(220);
  const report=await page.evaluate(async()=>{
    const S=window.ToonValleyTransitStewardship,R=window.ToonValleyTransitRiderLife,T=window.ToonValleyTransit,UI=window.ToonValleySideQuestUI,Life=window.ToonValleyLife;
    const money0=Life.getState().player.money,initial=S.getState(),initialVisual=S.getVisualState();
    S.cartAction();S.refresh();const started=S.getState(),startTarget=S.getTarget(),startVisual=S.getVisualState();
    S.collectToolkit();S.refresh();const picked=S.getState(),pickupTarget=S.getTarget(),pickupVisual=S.getVisualState();
    const stepVisuals=[];
    for(let i=0;i<S.panels.length;i++){S.servicePanel(i);S.refresh();stepVisuals.push(S.getVisualState())}
    const ready=S.getState(),readyTarget=S.getTarget(),moneyBeforeSignoff=Life.getState().player.money,readyVisual=S.getVisualState();
    S.cartAction();S.refresh();const done=S.getState(),moneyAfter=Life.getState().player.money,doneVisual=S.getVisualState();
    const stop=T.stops[0];T.bus.position.set(stop.routeX,T.bus.position.y,stop.routeZ);R.refresh();const nearVisual=S.getVisualState(),nearBoards=R.getBoardState();

    const commuter=S.commuters[0],originIndex=2,destinationIndex=R.chooseDestination(originIndex,0),destination=T.stops[destinationIndex];
    commuter.userData.stop=T.stops[originIndex];commuter.userData.slot=0;commuter.userData.boarded=true;commuter.userData.cooldown=0;commuter.visible=false;R.refresh();
    const boardedTrip=R.getTripState()[0],boardedPassengers=R.getPassengerState();
    await new Promise(r=>setTimeout(r,220));
    const retainedTrip=R.getTripState()[0],retainedPassengers=R.getPassengerState();
    R.processStopArrival(destinationIndex);R.refresh();
    const arrivedTrip=R.getTripState()[0],arrivedPassengers=R.getPassengerState(),walkStart=arrivedTrip.distanceToDestination;
    const firstWaypoint=R.pedestrianRoutes[destinationIndex].outbound[0];
    const firstWaypointStart=Math.hypot(commuter.position.x-firstWaypoint.x,commuter.position.z-firstWaypoint.z);
    R.refresh(.5);
    const walkingTrip=R.getTripState()[0],walkEnd=walkingTrip.distanceToDestination,firstWaypointEnd=Math.hypot(commuter.position.x-firstWaypoint.x,commuter.position.z-firstWaypoint.z);
    const phases=[];
    for(let i=0;i<220;i++){
      const state=R.getTripState()[0];
      if(!state.phase)break;
      phases.push(state.phase);
      R.refresh(.25);
    }
    const finalTrip=R.getTripState()[0];
    const baseOffset=commuter.userData.baseOffset||{x:0,z:-1.5};
    const waitX=destination.x+baseOffset.x,waitZ=destination.z+baseOffset.z;
    const finalStopDistance=Math.hypot(commuter.position.x-waitX,commuter.position.z-waitZ);
    return {money0,initial,initialVisual,started,startTarget,startVisual,picked,pickupTarget,pickupVisual,stepVisuals,ready,readyTarget,moneyBeforeSignoff,readyVisual,done,moneyAfter,doneVisual,nearVisual,nearBoards,boardedTrip,boardedPassengers,retainedTrip,retainedPassengers,arrivedTrip,arrivedPassengers,walkingTrip,walkStart,walkEnd,firstWaypointStart,firstWaypointEnd,phases,finalTrip,finalStopDistance,destinationName:destination.name,panelCount:S.panels.length,commuterCount:S.commuters.length,physicalToolkit:S.physicalToolkit,animatedCommuters:S.animatedCommuters,arrivalFeedback:S.arrivalFeedback,stateNormalization:S.stateNormalization,destinationTrips:R.destinationTrips,physicalDisembark:R.physicalDisembark,dynamicStopBoards:R.dynamicStopBoards,visibleBusPassengers:R.visibleBusPassengers,destinationWalks:R.destinationWalks,sidewalkRouting:R.sidewalkRouting,destinationActivities:R.destinationActivities,boardCount:R.stopBoards.length,passengerSlotCount:R.passengerSlots.length,destinationCount:R.destinations.length,routeCount:R.pedestrianRoutes.length,routePointCount:R.pedestrianRoutes[destinationIndex].outbound.length,activityPointCount:R.pedestrianRoutes[destinationIndex].activity.length,titles:UI.getSummaries().map(x=>x.title)};
  });
  if(report.panelCount!==4||report.commuterCount!==8||!report.physicalToolkit||!report.animatedCommuters||!report.arrivalFeedback||!report.stateNormalization)throw new Error(`Transit stewardship failed to initialize ${JSON.stringify(report)}`);
  if(report.initialVisual.toolkitSourceVisible||report.initialVisual.carriedToolkit||report.initialVisual.servicedPanels!==0||report.initialVisual.waitingCommuters!==8)throw new Error(`Transit life began in an invalid visual state ${JSON.stringify(report.initialVisual)}`);
  if(!report.started.started||report.started.toolkitCollected||report.startTarget?.name!=='transit toolkit'||!report.startVisual.toolkitSourceVisible)throw new Error(`Steward route did not require explicit acceptance and pickup ${JSON.stringify(report)}`);
  if(!report.picked.toolkitCollected||report.pickupTarget?.stopName!=='Town Square'||!report.pickupVisual.carriedToolkit||report.pickupVisual.toolkitSourceVisible)throw new Error(`Toolkit did not physically transfer to player ${JSON.stringify(report)}`);
  report.stepVisuals.forEach((visual,i)=>{if(visual.servicedPanels!==i+1||!visual.carriedToolkit)throw new Error(`Shelter service lacked persistent physical feedback at step ${i+1}: ${JSON.stringify(visual)}`)});
  if(report.ready.serviced.length!==4||!report.ready.awaitingSignoff||report.moneyBeforeSignoff!==report.money0||report.readyTarget?.name!=='Town Square transit steward cart'||!report.readyVisual.carriedToolkit)throw new Error(`Steward route rewarded early or missed return handoff ${JSON.stringify(report)}`);
  if(!report.done.done||report.moneyAfter-report.money0!==160||report.doneVisual.carriedToolkit||report.doneVisual.servicedPanels!==4)throw new Error(`Steward sign-off or physical cleanup failed ${JSON.stringify(report)}`);
  if(!report.titles.includes('Shuttle Stop Steward Round'))throw new Error(`Transit steward route missing from ToonPhone Tasks ${JSON.stringify(report.titles)}`);
  if(!report.nearVisual.arrivalLampStates.some(v=>v>.5))throw new Error(`Arrival feedback did not react to a shuttle at a real stop ${JSON.stringify(report.nearVisual)}`);
  if(report.nearVisual.waitingCommuters+report.nearVisual.boardedCommuters!==8)throw new Error(`Commuter population became inconsistent ${JSON.stringify(report.nearVisual)}`);
  if(!report.destinationTrips||!report.physicalDisembark||!report.dynamicStopBoards||!report.visibleBusPassengers||!report.destinationWalks||!report.sidewalkRouting||!report.destinationActivities||report.boardCount!==4||report.passengerSlotCount!==8||report.destinationCount!==4||report.routeCount!==4)throw new Error(`Transit rider-life improvements failed to initialize ${JSON.stringify(report)}`);
  if(report.nearBoards.length!==4||!report.nearBoards[0].near||report.nearBoards[0].litBars!==4||report.nearBoards.some(b=>!b.nextDestination||b.litBars<1||b.litBars>4))throw new Error(`Dynamic shuttle stop boards failed ${JSON.stringify(report.nearBoards)}`);
  if(!report.boardedTrip.boarded||report.boardedTrip.visible||report.boardedTrip.phase!=='riding'||report.boardedTrip.origin!=='Sunshine Park'||report.boardedTrip.destination!==report.destinationName||report.boardedPassengers.activePassengers!==1)throw new Error(`Commuter did not begin a visible destination trip ${JSON.stringify({trip:report.boardedTrip,passengers:report.boardedPassengers})}`);
  if(!report.retainedTrip.boarded||report.retainedTrip.visible||report.retainedTrip.phase!=='riding'||report.retainedPassengers.activePassengers!==1)throw new Error(`Legacy commuter updater prematurely ejected a rider ${JSON.stringify({trip:report.retainedTrip,passengers:report.retainedPassengers})}`);
  if(report.arrivedTrip.boarded||!report.arrivedTrip.visible||report.arrivedTrip.stop!==report.destinationName||!report.arrivedTrip.disembarking||!report.arrivedTrip.walkingToDestination||!report.arrivedTrip.destinationPoint||report.arrivedPassengers.activePassengers!==0)throw new Error(`Commuter did not physically disembark into a real destination walk ${JSON.stringify({trip:report.arrivedTrip,passengers:report.arrivedPassengers})}`);
  if(report.walkingTrip.phase!=='walking'||!(report.walkEnd<report.walkStart-.7)||!(report.firstWaypointEnd<report.firstWaypointStart-.7))throw new Error(`Disembarked commuter did not follow the first pedestrian waypoint ${JSON.stringify({start:report.walkStart,end:report.walkEnd,waypointStart:report.firstWaypointStart,waypointEnd:report.firstWaypointEnd,trip:report.walkingTrip})}`);
  if(report.routePointCount<3||report.activityPointCount<4||!report.phases.includes('activity')||!report.phases.includes('returning'))throw new Error(`Commuter never completed the destination activity loop ${JSON.stringify({phases:report.phases,routePointCount:report.routePointCount,activityPointCount:report.activityPointCount})}`);
  if(report.finalTrip.phase!==null||report.finalStopDistance>.35)throw new Error(`Commuter did not return to the destination stop after local activity ${JSON.stringify({finalTrip:report.finalTrip,finalStopDistance:report.finalStopDistance})}`);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Transit stewardship, lifecycle ownership, sidewalk routing, destination activity, visible passengers, and stop-board checks passed',report);
}finally{await browser.close();if(server)server.kill('SIGTERM')}
