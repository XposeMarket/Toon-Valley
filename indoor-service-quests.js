(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const {THREE}=TV,bounds=TV.areaBounds,KEY='toon-valley-indoor-service-quests-v1';
  if(!bounds.cafe||!bounds.library||!TV.interiorGroups?.cafe||!TV.interiorGroups?.library)return;

  const fresh=()=>({day:-1,cafe:{stage:'start',cleared:[],done:false},library:{stage:'start',shelved:[],done:false}});
  let state=(()=>{try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');return {...fresh(),...p,cafe:{...fresh().cafe,...(p.cafe||{})},library:{...fresh().library,...(p.library||{})}}}catch{return fresh()}})();
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(error){console.warn('Unable to save indoor service quests',error)}};
  const day=()=>Life.getState().world.day;

  const carryRoot=new THREE.Group();TV.player.add(carryRoot);
  const busTub=(()=>{const g=new THREE.Group(),box=TV.outlinedMesh(TV.unitBox,TV.mat(0x6aa8b8),1.025);box.scale.set(.82,.34,.56);g.add(box);g.position.set(.7,1.12,.18);g.visible=false;carryRoot.add(g);return g})();
  const bookStack=(()=>{const g=new THREE.Group();[0,1,2].forEach((i)=>{const b=TV.outlinedMesh(TV.unitBox,TV.mat([0xd96666,0x5a91d6,0xe6b84c][i]),1.02);b.scale.set(.5,.11,.35);b.position.y=i*.14;g.add(b)});g.position.set(-.66,1.18,.18);g.visible=false;carryRoot.add(g);return g})();

  const cafeStops=[
    [bounds.cafe.cx-4.2,bounds.cafe.cz+1.8,'window table'],
    [bounds.cafe.cx,bounds.cafe.cz+2.1,'center table'],
    [bounds.cafe.cx+4.2,bounds.cafe.cz+1.8,'corner table']
  ];
  const dishStacks=cafeStops.map((p,index)=>{
    const g=new THREE.Group();
    for(let i=0;i<3;i++){const plate=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.055,12),TV.materials.white);plate.position.y=.82+i*.07;plate.rotation.x=.03*(index-1);g.add(plate)}
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.3,10),TV.materials.cream);cup.position.set(.38,1.01,.08);g.add(cup);
    g.position.set(p[0],0,p[1]);TV.interiorGroups.cafe.add(g);return g;
  });

  TV.registerInteraction({x:bounds.cafe.cx-1.8,z:bounds.cafe.cz-5.25,radius:2.8,area:'cafe',prompt:'Ask Ari about the cafe closing shift',enabled:()=>state.cafe.stage==='start'&&!state.cafe.done,action:()=>{state.cafe.stage='pickup';TV.showToast('☕ Ari: “Could you bus the three dining tables before close? Grab the blue tub, clear every table, then bring it back.”',4);save()}});
  TV.registerInteraction({x:bounds.cafe.cx+2,z:bounds.cafe.cz-5.25,radius:2.6,area:'cafe',prompt:'Collect cafe bus tub',enabled:()=>state.cafe.stage==='pickup'&&!state.cafe.done,action:()=>{state.cafe.stage='clear';busTub.visible=true;TV.showToast('🧺 Bus tub collected. Clear all three dining tables, then return the tub to Ari.',3.2);save()}});
  cafeStops.forEach((p,index)=>TV.registerInteraction({x:p[0],z:p[1],radius:2.3,area:'cafe',prompt:`Clear ${p[2]}`,enabled:()=>state.cafe.stage==='clear'&&!state.cafe.done&&state.cafe.cleared.length===index,action:()=>{state.cafe.cleared.push(index);dishStacks[index].visible=false;Life.emitProgress('help',1,{activity:'cafe-table-clear',table:index});if(state.cafe.cleared.length===cafeStops.length){state.cafe.stage='return';TV.showToast('✨ All three tables are cleared. Bring the full bus tub back to Ari.',3)}else TV.showToast(`🍽️ Table cleared · ${state.cafe.cleared.length}/${cafeStops.length}. Move to the next dining table.`,2.4);save()}}));
  TV.registerInteraction({x:bounds.cafe.cx,z:bounds.cafe.cz-5.25,radius:2.8,area:'cafe',prompt:'Return full bus tub to Ari',enabled:()=>state.cafe.stage==='return'&&!state.cafe.done,action:()=>{state.cafe.stage='done';state.cafe.done=true;busTub.visible=false;Life.addMoney(105,'Cloud Nine Cafe closing shift');Life.emitProgress('help',2,{activity:'cafe-closing-shift-complete'});TV.showToast('☕ Ari: “Dining room reset and ready for tomorrow. Thank you!” +$105',3.6);save()}});

  const shelfStops=[
    [bounds.library.cx-5.2,bounds.library.cz+2.5,'history shelf'],
    [bounds.library.cx,bounds.library.cz+3.2,'story shelf'],
    [bounds.library.cx+5.2,bounds.library.cz+2.5,'nature shelf']
  ];
  const shelfBooks=shelfStops.map((p,index)=>{
    const g=new THREE.Group();
    for(let i=0;i<4;i++){const b=TV.outlinedMesh(TV.unitBox,TV.mat([0x6e9bd6,0xd87578,0xe0b65c,0x72b879][(i+index)%4]),1.018);b.scale.set(.14,.52,.34);b.position.set((i-1.5)*.18,.92,0);g.add(b)}
    g.position.set(p[0],0,p[1]);g.visible=false;TV.interiorGroups.library.add(g);return g;
  });

  TV.registerInteraction({x:bounds.library.cx-1.8,z:bounds.library.cz-5.25,radius:2.8,area:'library',prompt:'Ask Mabel about the return-cart books',enabled:()=>state.library.stage==='start'&&!state.library.done,action:()=>{state.library.stage='pickup';TV.showToast('📚 Mabel: “The return cart is overflowing. Take the book stack, reshelve all three sections, then check back with me.”',4);save()}});
  TV.registerInteraction({x:bounds.library.cx+2,z:bounds.library.cz-5.25,radius:2.6,area:'library',prompt:'Collect library return stack',enabled:()=>state.library.stage==='pickup'&&!state.library.done,action:()=>{state.library.stage='shelve';bookStack.visible=true;TV.showToast('📚 Return stack collected. Reshelve the history, story, and nature sections in order.',3.2);save()}});
  shelfStops.forEach((p,index)=>TV.registerInteraction({x:p[0],z:p[1],radius:2.3,area:'library',prompt:`Reshelve books at ${p[2]}`,enabled:()=>state.library.stage==='shelve'&&!state.library.done&&state.library.shelved.length===index,action:()=>{state.library.shelved.push(index);shelfBooks[index].visible=true;Life.emitProgress('help',1,{activity:'library-reshelve',shelf:index});if(state.library.shelved.length===shelfStops.length){state.library.stage='return';bookStack.visible=false;TV.showToast('📖 All three sections are reshelved. Return to Mabel for final check-in.',3)}else TV.showToast(`📚 Section reshelved · ${state.library.shelved.length}/${shelfStops.length}. Continue to the next shelf.`,2.4);save()}}));
  TV.registerInteraction({x:bounds.library.cx,z:bounds.library.cz-5.25,radius:2.8,area:'library',prompt:'Check completed reshelving with Mabel',enabled:()=>state.library.stage==='return'&&!state.library.done,action:()=>{state.library.stage='done';state.library.done=true;Life.addMoney(115,'Storybook Library reshelving shift');Life.emitProgress('help',2,{activity:'library-reshelving-complete'});TV.showToast('📚 Mabel: “Every return is back where it belongs. Beautiful work!” +$115',3.6);save()}});

  function reset(force=false){const today=day();if(!force&&state.day===today)return;state=fresh();state.day=today;busTub.visible=false;bookStack.visible=false;dishStacks.forEach(g=>g.visible=true);shelfBooks.forEach(g=>g.visible=false);save()}
  reset();
  state.cafe.cleared.forEach(i=>{if(dishStacks[i])dishStacks[i].visible=false});
  if(state.cafe.stage==='clear'||state.cafe.stage==='return')busTub.visible=true;
  state.library.shelved.forEach(i=>{if(shelfBooks[i])shelfBooks[i].visible=true});
  if(state.library.stage==='shelve')bookStack.visible=true;

  let elapsed=0;TV.registerUpdateHook(dt=>{elapsed+=dt;if(elapsed>=2){elapsed=0;if(state.day!==day())reset(true)}});

  function summaries(){return[
    {icon:'☕',title:'Cafe Closing Shift',done:state.cafe.done,status:state.cafe.done?'DONE':state.cafe.stage==='start'?'START':state.cafe.stage==='pickup'?'PICKUP':state.cafe.stage==='return'?'RETURN':`${state.cafe.cleared.length}/${cafeStops.length}`,text:state.cafe.done?'Ari has the full bus tub and the dining room is reset.':state.cafe.stage==='start'?'Talk to Ari inside Cloud Nine Cafe to take the closing shift.':state.cafe.stage==='pickup'?'Collect the blue bus tub from Ari before clearing tables.':state.cafe.stage==='return'?'Bring the full bus tub back to Ari for final handoff and payment.':`Clear the next dining table · ${state.cafe.cleared.length}/${cafeStops.length} complete.`},
    {icon:'📚',title:'Library Reshelving Shift',done:state.library.done,status:state.library.done?'DONE':state.library.stage==='start'?'START':state.library.stage==='pickup'?'PICKUP':state.library.stage==='return'?'CHECK IN':`${state.library.shelved.length}/${shelfStops.length}`,text:state.library.done?'Mabel checked the completed reshelving route.':state.library.stage==='start'?'Talk to Mabel inside Storybook Library about the return cart.':state.library.stage==='pickup'?'Collect the stack of returned books from Mabel.':state.library.stage==='return'?'Return to Mabel for the final reshelving check-in and payment.':`Reshelve the next marked section · ${state.library.shelved.length}/${shelfStops.length} complete.`}
  ]}
  window.ToonValleyIndoorServiceQuests=Object.freeze({getState:()=>JSON.parse(JSON.stringify(state)),getSummaries:summaries,counts:{cafeTables:cafeStops.length,libraryShelves:shelfStops.length}});
  console.info('Toon Valley indoor service quests ready',{quests:2,cafeTables:cafeStops.length,libraryShelves:shelfStops.length});
})();