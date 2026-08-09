(() => {
  'use strict';
  const Q=window.ToonValleySideQuests,S=window.ToonValleyServices,R=window.ToonValleyRoutines;
  if(!Q)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function summaries(){
    const q=Q.getState(),pets=S?.getState?.()||{petsFound:[],activePet:null},homes=S?.petHomes||[],pet=Number.isInteger(pets.activePet)?homes[pets.activePet]:null,notice=R?.getCurrentErrand?.(),noticeState=R?.getState?.()||{accepted:false,stage:0,completed:false};
    const list=[];
    list.push({icon:'🐾',title:'Lost Pet Rescue',done:pets.petsFound?.length===homes.length&&homes.length>0,status:pet?'ESCORTING':`${pets.petsFound?.length||0}/${homes.length||3}`,text:pet?`Walk ${pet.name} to ${pet.owner}'s real house at ${pet.label}. Keep the pet with you, then knock on the marked door.`:`Find a lost pet, earn its trust, escort it across town, and return it to the owner at their house.`});
    list.push({icon:'🫐',title:'Cafe Berry Basket',done:q.forage.delivered,status:q.forage.delivered?'DONE':q.forage.ready?'DELIVER':`${q.forage.collected.length}/4`,text:q.forage.delivered?'Berry basket delivered to Ari.':q.forage.ready?'Take the full basket inside Cloud Nine Cafe and hand it to Ari.':'Gather four wild-berry bushes to fill a cafe basket.'});
    list.push({icon:'♻️',title:'Community Cleanup',done:q.cleanup.delivered,status:q.cleanup.delivered?'DONE':q.cleanup.ready?'DISPOSE':`${q.cleanup.collected.length}/${Q.counts.cleanupItems}`,text:q.cleanup.delivered?'Cleanup bag disposed and the route is complete.':q.cleanup.ready?'Carry the full cleanup bag to the marked green bin in Sunshine Park.':'Pick up every piece of litter on the cleanup route.'});
    list.push({icon:'🐦',title:'Valley Bird Survey',done:q.birds.returned,status:q.birds.returned?'DONE':q.birds.ready?'RETURN':q.birds.started?`${q.birds.seen.length}/${Q.counts.birdSpecies}`:'START',text:q.birds.returned?'Completed field notes returned to Mabel.':q.birds.ready?'Return the completed notebook to Mabel in Storybook Library.':q.birds.started?'Follow the blue objective marker and log each remaining bird species.':'Go to Storybook Library and check out Mabel’s bird-survey notebook.'});
    list.push({icon:'🌻',title:'Garden Care Round',done:q.garden.returned,status:q.garden.returned?'DONE':q.garden.started?`${q.garden.watered.length}/${Q.counts.gardenBeds}`:'START',text:q.garden.returned?'Watering equipment returned after caring for every bed.':q.garden.started&&q.garden.watered.length===Q.counts.gardenBeds?'Return the watering can to the barrel.':q.garden.started?'Follow the green marker and water every raised bed.':'Borrow the watering can at the main community garden.'});
    const noticeStatus=noticeState.completed?'DONE':!noticeState.accepted?'START':noticeState.stage===1?'PICKUP':noticeState.stage===2?'DELIVER':noticeState.stage===3?'SIGN OFF':'ACTIVE';
    const noticeText=noticeState.completed?'Today’s notice-board job has been signed off.':!noticeState.accepted?'Read the community notice board to accept today’s hands-on errand.':noticeState.stage===1?`Go to ${notice?.pickup?.label||'the marked pickup point'} and collect the item.`:noticeState.stage===2?`Carry the item across town to ${notice?.target?.label||'the marked destination'} and deliver it.`:noticeState.stage===3?'Return to the community notice board for final sign-off and payment.':'Finish today’s notice-board errand.';
    list.push({icon:notice?.icon||'📦',title:notice?.name||'Notice-Board Errand',done:noticeState.completed,status:noticeStatus,text:noticeText});
    list.push({icon:'🥕',title:'Farmers-Market Survey',done:q.market.completed,status:q.market.completed?'DONE':q.market.started?`${q.market.samples.length}/${Q.counts.marketSamples}`:'START',text:q.market.completed?'The vendor received your completed tasting feedback.':q.market.started&&q.market.samples.length===Q.counts.marketSamples?'Return to the vendor and report your feedback.':q.market.started?'Taste each marked produce sample before reporting back.':'Talk to the farmers-market vendor to begin a real three-sample survey.'});
    const community=window.ToonValleyCommunityObjectives?.getSummaries?.();if(Array.isArray(community))list.push(...community);
    const neighborhood=window.ToonValleyNeighborhoodQuests?.getSummaries?.();if(Array.isArray(neighborhood))list.push(...neighborhood);
    const civic=window.ToonValleyCivicQuests?.getSummaries?.();if(Array.isArray(civic))list.push(...civic);
    const services=window.ToonValleyTownServiceQuests?.getSummaries?.();if(Array.isArray(services))list.push(...services);
    const indoor=window.ToonValleyIndoorServiceQuests?.getSummaries?.();if(Array.isArray(indoor))list.push(...indoor);
    return list;
  }
  function render(){
    const active=document.querySelector('.life-tab.active[data-tab="tasks"]'),content=document.getElementById('phone-content');if(!active||!content)return;
    const items=summaries(),signature=JSON.stringify(items),existing=content.querySelector('#tv-side-quests');if(existing?.dataset.signature===signature)return;
    const section=existing||document.createElement('section');section.id='tv-side-quests';section.className='life-section';section.dataset.signature=signature;section.innerHTML=`<h3>Hands-on Side Quests</h3><div class="life-notice">These complete only after the real-world objective and final handoff — not from a single tap.</div>${items.map(item=>`<div class="life-row"><div class="life-row-copy"><b>${item.done?'✅':item.icon} ${esc(item.title)}</b><small>${esc(item.text)}</small></div><span class="life-pill">${esc(item.status)}</span></div>`).join('')}`;if(!existing)content.appendChild(section);
  }
  let queued=false;const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})};new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});setInterval(render,1200);render();
  window.ToonValleySideQuestUI=Object.freeze({active:true,getSummaries:summaries,render});
  console.info('Toon Valley side quest tracker ready',{quests:summaries().length});
})();