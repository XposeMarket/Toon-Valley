(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const KEY = 'toon-valley-routines-v2';
  const LEGACY_KEY = 'toon-valley-routines-v1';
  const defaults = { errandDay: -1, accepted: false, stage: 0, completed: false };
  const state = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || '{}');
      return {
        errandDay: Number.isFinite(parsed.errandDay) ? parsed.errandDay : defaults.errandDay,
        accepted: parsed.accepted === true,
        stage: Number.isFinite(parsed.stage) ? parsed.stage : (parsed.completed ? 3 : parsed.accepted ? 1 : 0),
        completed: parsed.completed === true
      };
    } catch (_) { return { ...defaults }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { console.warn('Unable to save valley routines', error); } }
  function world() { return Life.getState().world; }
  function day() { return world().day; }

  const errands = [
    { name:'Library Book Return',icon:'📚',reward:85,pickup:{x:5,z:21,label:'community board parcel shelf',prompt:'Pick up the overdue book bundle'},target:{x:-36,z:30,label:'Toon Valley Library',prompt:'Hand the books to Luna at the library'},thanks:'Luna: “Perfect timing — these were due back yesterday. Thank you!”' },
    { name:'Garden Seed Delivery',icon:'🌱',reward:95,pickup:{x:31,z:-3,label:'grocery counter',prompt:'Pick up the seed packet from Cleo'},target:{x:-116,z:55,label:'Community Garden',prompt:'Deliver the seeds to Ivy at the garden'},thanks:'Ivy: “These are exactly what we needed for the next planting row!”' },
    { name:'Fire Station Supply Run',icon:'🧯',reward:105,pickup:{x:49,z:-20,label:'post office',prompt:'Collect the station supply crate'},target:{x:61,z:15,label:'Fire Station',prompt:'Deliver the crate to Otis'},thanks:'Otis: “You saved me a whole trip across town. Much appreciated!”' }
  ];
  function currentErrand() { return errands[Math.abs(day()) % errands.length]; }
  function currentErrandIndex() { return Math.abs(day()) % errands.length; }
  function resetForDay(){const today=day();if(state.errandDay===today)return false;state.errandDay=today;state.accepted=false;state.stage=0;state.completed=false;save();syncErrandVisuals();return true}

  function handleNoticeBoard(){
    resetForDay();const task=currentErrand();
    if(state.completed){TV.showToast(`✅ ${task.name} is signed off for today.`,2.2);return state.stage}
    if(!state.accepted){state.accepted=true;state.stage=1;save();syncErrandVisuals();TV.showToast(`${task.icon} Job accepted: ${task.name}. First, go to the ${task.pickup.label} and collect the item.`,3.6);return state.stage}
    if(state.stage===3){state.completed=true;state.stage=4;save();syncErrandVisuals();Life.addMoney(task.reward,task.name);Life.emitProgress('help',2,{activity:'notice-board',task:task.name});TV.showToast(`✅ Job signed off! ${task.name} complete · +$${task.reward}`,3);return state.stage}
    TV.showToast(state.stage===1?`${task.icon} ${task.name}: collect the item at the ${task.pickup.label}.`:`${task.icon} ${task.name}: deliver it to ${task.target.label}, then return here for sign-off.`,3);return state.stage
  }
  function handleTaskPoint(kind){
    const task=currentErrand();
    if(kind==='pickup'&&state.accepted&&!state.completed&&state.stage===1){state.stage=2;save();syncErrandVisuals();TV.showToast(`${task.icon} ${task.pickup.prompt}. Item collected — now take it across town to ${task.target.label}.`,3.5);return true}
    if(kind==='target'&&state.accepted&&!state.completed&&state.stage===2){state.stage=3;save();syncErrandVisuals();TV.showToast(`${task.icon} ${task.thanks} Return to the notice board to finish the job.`,4);return true}
    return false
  }

  function makeMarker(color=0xf3d45b){const group=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.08,6,16),TV.mat(color));ring.rotation.x=Math.PI/2;ring.position.y=.16;group.add(ring);const bar=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.04);bar.scale.set(.14,.62,.14);bar.position.y=1.35;group.add(bar);const dot=TV.outlinedMesh(new THREE.SphereGeometry(.14,8,6),TV.mat(color),1.04);dot.position.y=.76;group.add(dot);return group}

  function makeNoticeBoard(){
    const group=new THREE.Group(),postMat=TV.materials.brown||TV.mat(0x76523b);
    for(const x of[-.72,.72]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.9,6),postMat);post.position.set(x,.95,0);group.add(post)}
    const board=TV.outlinedMesh(TV.unitBox,TV.mat(0xd8b46a),1.035);board.scale.set(1.8,1.05,.12);board.position.y=1.55;group.add(board);
    const paper=new THREE.Mesh(TV.unitBox,TV.materials.white||TV.mat(0xf5f0df));paper.scale.set(1.18,.68,.03);paper.position.set(0,1.58,.15);group.add(paper);
    const stamp=new THREE.Mesh(new THREE.TorusGeometry(.2,.055,6,14),TV.mat(0xc94f55));stamp.rotation.x=Math.PI/2;stamp.position.set(.36,1.47,.19);stamp.visible=false;group.add(stamp);group.userData.signoffStamp=stamp;
    group.position.set(9,TV.terrainHeight(9,24),24);TV.scene.add(group);
    TV.registerInteraction({object:group,radius:3,area:'world',prompt:'Check community notice board',enabled:()=>true,action:handleNoticeBoard});return group;
  }

  function makeTaskPoint(kind){
    const group=makeMarker(kind==='pickup'?0x5eb5df:0xf3d45b);TV.scene.add(group);
    const sync=()=>{const point=currentErrand()[kind];group.position.set(point.x,TV.terrainHeight(point.x,point.z),point.z)};sync();
    TV.registerInteraction({object:group,radius:3,area:'world',prompt:kind==='pickup'?'Pick up errand item':'Make errand delivery',enabled:()=>state.accepted&&!state.completed&&((kind==='pickup'&&state.stage===1)||(kind==='target'&&state.stage===2)),action:()=>handleTaskPoint(kind)});return{group,sync};
  }

  function makeErrandCargo(){
    const root=new THREE.Group();root.position.set(.72,1.08,.18);root.visible=false;TV.player.add(root);
    const items=[];
    const books=new THREE.Group();
    [[0x4f83c2,-.12],[0xc94f55,.02],[0xe2b957,.16]].forEach(([color,y],index)=>{const book=TV.outlinedMesh(TV.unitBox,TV.mat(color),1.025);book.scale.set(.56,.11,.38);book.position.set(index*.035,y,index*.02);book.rotation.y=(index-1)*.08;books.add(book)});
    const strap=new THREE.Mesh(TV.unitBox,TV.materials.brown||TV.mat(0x76523b));strap.scale.set(.1,.42,.41);strap.position.y=.04;books.add(strap);root.add(books);items.push(books);
    const seeds=new THREE.Group();const sack=TV.outlinedMesh(new THREE.SphereGeometry(.36,8,6),TV.mat(0xb99062),1.025);sack.scale.set(1,.85,.7);sack.position.y=.04;seeds.add(sack);const tie=new THREE.Mesh(new THREE.TorusGeometry(.12,.035,6,10),TV.mat(0x5d7f46));tie.rotation.x=Math.PI/2;tie.position.y=.34;seeds.add(tie);root.add(seeds);items.push(seeds);
    const supplies=new THREE.Group();const crate=TV.outlinedMesh(TV.unitBox,TV.materials.wood||TV.mat(0x9a704d),1.025);crate.scale.set(.68,.5,.55);crate.position.y=.03;supplies.add(crate);for(const z of[-.2,.2]){const slat=new THREE.Mesh(TV.unitBox,TV.mat(0x6f4e35));slat.scale.set(.74,.09,.08);slat.position.set(0,.18,z);supplies.add(slat)}const cross=new THREE.Mesh(TV.unitBox,TV.mat(0xb53f43));cross.scale.set(.18,.28,.04);cross.position.set(0,.05,.3);supplies.add(cross);const cross2=cross.clone();cross2.scale.set(.38,.11,.04);supplies.add(cross2);root.add(supplies);items.push(supplies);
    return{root,items};
  }

  function makeStreetLamp(x,z){const group=new THREE.Group(),metal=TV.mat(0x3f4650);const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,2.8,7),metal);pole.position.y=1.4;group.add(pole);const arm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.65,6),metal);arm.rotation.z=Math.PI/2;arm.position.set(.28,2.65,0);group.add(arm);const bulbMat=new THREE.MeshBasicMaterial({color:0x6f7680}),bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),bulbMat);bulb.position.set(.57,2.58,0);group.add(bulb);group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);return{group,bulbMat}}

  const lamps=[[-26,18],[-12,18],[2,18],[16,18],[30,18],[18,36],[18,50],[45,7],[58,7],[-40,-12]].map(p=>makeStreetLamp(p[0],p[1]));
  const noticeBoard=makeNoticeBoard(),pickupPoint=makeTaskPoint('pickup'),targetPoint=makeTaskPoint('target'),cargo=makeErrandCargo(),returnMarker=makeMarker(0xffb84d);TV.scene.add(returnMarker);
  function syncErrandVisuals(){
    const carrying=state.accepted&&!state.completed&&state.stage===2,index=currentErrandIndex();
    cargo.root.visible=carrying;cargo.items.forEach((item,i)=>{item.visible=carrying&&i===index});
    returnMarker.position.set(noticeBoard.position.x,TV.terrainHeight(noticeBoard.position.x,noticeBoard.position.z),noticeBoard.position.z);returnMarker.visible=state.accepted&&!state.completed&&state.stage===3;
    if(noticeBoard.userData.signoffStamp)noticeBoard.userData.signoffStamp.visible=state.completed;
  }
  resetForDay();syncErrandVisuals();
  let lastLampState=null,lastDay=day(),elapsed=0,floatClock=0;
  function updateLampVisuals(){const w=world(),hour=((w.minutes||0)/60)%24,on=hour>=18.5||hour<6.5||w.weather==='foggy';if(on===lastLampState)return;lastLampState=on;for(const lamp of lamps)lamp.bulbMat.color.setHex(on?0xffdf8a:0x6f7680)}
  updateLampVisuals();
  TV.registerUpdateHook(dt=>{elapsed+=dt;floatClock+=dt;pickupPoint.group.position.y=TV.terrainHeight(pickupPoint.group.position.x,pickupPoint.group.position.z)+Math.sin(floatClock*2.4)*.08;targetPoint.group.position.y=TV.terrainHeight(targetPoint.group.position.x,targetPoint.group.position.z)+Math.sin(floatClock*2.4+1)*.08;returnMarker.position.y=TV.terrainHeight(returnMarker.position.x,returnMarker.position.z)+Math.sin(floatClock*2.4+2)*.08;pickupPoint.group.visible=state.accepted&&!state.completed&&state.stage===1;targetPoint.group.visible=state.accepted&&!state.completed&&state.stage===2;returnMarker.visible=state.accepted&&!state.completed&&state.stage===3;if(cargo.root.visible){cargo.root.rotation.z=Math.sin(floatClock*5)*.025;cargo.root.position.y=1.08+Math.sin(floatClock*4)*.015}if(elapsed<1)return;elapsed=0;const today=day();if(today!==lastDay){lastDay=today;resetForDay();pickupPoint.sync();targetPoint.sync();syncErrandVisuals()}updateLampVisuals()});

  window.ToonValleyRoutines={getState:()=>JSON.parse(JSON.stringify(state)),getCurrentErrand:()=>({...currentErrand()}),getVisualState:()=>({cargoVisible:cargo.root.visible,cargoIndex:cargo.items.findIndex(item=>item.visible),returnMarkerVisible:returnMarker.visible,signoffStampVisible:Boolean(noticeBoard.userData.signoffStamp?.visible)}),counts:{streetLamps:lamps.length,errands:errands.length},noticeBoard,handleNoticeBoard,pickupErrandItem:()=>handleTaskPoint('pickup'),deliverErrandItem:()=>handleTaskPoint('target'),questStyle:'accept-pickup-deliver-return-signoff',physicalFeedback:'task-specific-cargo-and-return-marker'};
  console.info('Toon Valley routines ready',window.ToonValleyRoutines.counts);
})();
