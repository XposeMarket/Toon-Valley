(() => {
  'use strict';
  const TV=window.ToonValley,Life=window.ToonValleyLife;
  if(!TV||!Life)return;
  const{THREE}=TV,KEY='toon-valley-town-activities-v2',LEGACY_KEY='toon-valley-town-activities-v1',fallback={fishingDay:0,caught:[],courierDay:0,courierStep:0,courierReturning:false,courierDone:false},LAKE={x:112,z:-82};
  let state;try{state=Object.assign({},fallback,JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(LEGACY_KEY)||'{}'))}catch(_){state={...fallback}}
  const fishingSpots=[],courierStops=[];
  function day(){return Life.getState().world.day}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(error){console.warn('Unable to save town activities',error)}}
  function resetDaily(){const today=day();if(state.fishingDay!==today){state.fishingDay=today;state.caught=[];fishingSpots.forEach(spot=>{spot.group.visible=true;spot.line.visible=false;spot.bobber.visible=false;spot.casting=false})}if(state.courierDay!==today){state.courierDay=today;state.courierStep=0;state.courierReturning=false;state.courierDone=false}save()}

  function makeFishingSpot(x,z,index){
    const group=new THREE.Group();group.position.set(x,TV.terrainHeight(x,z),z);group.rotation.y=Math.atan2(LAKE.x-x,LAKE.z-z);TV.scene.add(group);
    const pad=TV.outlinedMesh(TV.unitBox,TV.materials.wood,1.025);pad.scale.set(1.65,.16,.95);pad.position.y=.08;group.add(pad);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1.3,6),TV.materials.wood);post.position.set(-.62,.72,-.2);group.add(post);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,2.65,7),TV.materials.dark);rod.rotation.x=1.05;rod.position.set(.48,1.05,.18);group.add(rod);
    const bobber=new THREE.Group();const top=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),TV.materials.red),bottom=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),TV.materials.white);top.position.y=.08;bottom.position.y=-.06;bobber.add(top,bottom);bobber.position.set(.48,.12,4.25);bobber.visible=false;group.add(bobber);
    const curve=[];for(let i=0;i<=10;i++){const t=i/10,xp=.48,yp=THREE.MathUtils.lerp(1.67,.13,t)+Math.sin(t*Math.PI)*.38,zp=THREE.MathUtils.lerp(1.28,4.25,t);curve.push(new THREE.Vector3(xp,yp,zp))}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve),new THREE.LineBasicMaterial({color:0x25323a,transparent:true,opacity:.8}));line.visible=false;group.add(line);
    const entry={group,index,line,bobber,casting:false};fishingSpots.push(entry);
    function finish(){if(!entry.casting||state.caught.includes(index))return;entry.casting=false;state.caught.push(index);const reward=24+((index*13+day())%4)*7;Life.addMoney(reward,'Fresh catch');Life.emitProgress('explore',1,{activity:'fishing'});TV.showToast(`🎣 Fresh catch sold for $${reward} · ${state.caught.length}/${fishingSpots.length}`,2.5);save();setTimeout(()=>{line.visible=false;bobber.visible=false;group.visible=false},450)}
    TV.registerInteraction({object:group,radius:2.8,area:'world',prompt:'Fish from shore',enabled:()=>!state.caught.includes(index)&&!entry.casting,action:()=>{if(state.caught.includes(index)||entry.casting)return;entry.casting=true;line.visible=true;bobber.visible=true;TV.showToast('🎣 Cast out… watch the bobber.',1.4);setTimeout(finish,1150)}});
  }

  function makeCourierStop(x,z,index,label){
    const group=new THREE.Group();
    const box=TV.outlinedMesh(TV.unitBox,TV.materials.yellow||TV.mat(0xf1c84b),1.04);box.scale.set(.45,.34,.38);box.position.y=.34;group.add(box);
    const band=new THREE.Mesh(TV.unitBox,TV.materials.red||TV.mat(0xd84a62));band.scale.set(.08,.36,.4);band.position.y=.34;group.add(band);
    const marker=TV.outlinedMesh(new THREE.ConeGeometry(.18,.55,6),TV.materials.yellow||TV.mat(0xf1c84b),1.04);marker.rotation.x=Math.PI;marker.position.y=1.35;group.add(marker);
    group.position.set(x,TV.terrainHeight(x,z),z);TV.scene.add(group);courierStops.push({group,index,label});
    TV.registerInteraction({
      object:group,radius:2.5,area:'world',
      prompt:()=>{
        if(index===0&&state.courierReturning)return 'Return courier manifest and get paid';
        if(index===0)return 'Pick up courier route';
        return `Deliver parcel: ${label}`;
      },
      enabled:()=>{
        if(state.courierDone)return false;
        if(index===0)return state.courierStep===0||state.courierReturning;
        return !state.courierReturning&&state.courierStep===index;
      },
      action:()=>{
        if(state.courierDone)return;
        if(index===0&&state.courierReturning){
          state.courierReturning=false;state.courierDone=true;state.courierStep=courierStops.length;save();
          Life.addMoney(170,'Completed courier route');Life.emitProgress('help',3,{activity:'courier-complete'});
          TV.showToast('📬 Postmaster: “Everything delivered and signed for. Nice work!” Route complete +$170',3.6);return;
        }
        if(index===0&&state.courierStep===0){state.courierStep=1;save();TV.showToast('📦 Route started · 3 parcels loaded. Deliver all three, then return the manifest here.',3.2);return}
        if(index>0&&state.courierStep===index){
          state.courierStep+=1;Life.emitProgress('help',1,{activity:'courier',stop:label});
          const lastDelivery=index===courierStops.length-1;
          if(lastDelivery){state.courierReturning=true;state.courierStep=0;TV.showToast(`📦 ${label} signed for the parcel. All deliveries done — return to the Post Office for payment.`,3.3)}
          else TV.showToast(`📦 ${label} signed for the parcel · ${courierStops.length-1-index} delivery${courierStops.length-1-index===1?'':'ies'} left`,2.6);
          save();
        }
      }
    });
  }

  [[88,-68],[103,-60],[128,-62],[141,-82]].forEach((p,i)=>makeFishingSpot(p[0],p[1],i));
  [[4,18,'Post Office'],[32,34,'Maple House'],[-28,-22,'Market Cottage'],[58,-18,'Hilltop Home']].forEach((p,i)=>makeCourierStop(p[0],p[1],i,p[2]));
  resetDaily();fishingSpots.forEach(spot=>{spot.group.visible=!state.caught.includes(spot.index)});
  let timer=0,clock=0;TV.registerUpdateHook(dt=>{timer+=dt;clock+=dt;for(const spot of fishingSpots){if(spot.bobber.visible)spot.bobber.position.y=.12+Math.sin(clock*5+spot.index)*.035}courierStops.forEach((stop)=>{stop.group.visible=!state.courierDone&&(stop.index===0?(state.courierStep===0||state.courierReturning):(!state.courierReturning&&state.courierStep===stop.index))});if(timer>=2){timer=0;resetDaily()}});
  window.ToonValleyTownActivities={getState:()=>JSON.parse(JSON.stringify(state)),counts:{fishing:fishingSpots.length,courier:courierStops.length-1},fishingSpots:fishingSpots.map(s=>({x:s.group.position.x,z:s.group.position.z})),fishingFX:'curved-line-and-bobber',courierFlow:'pickup-deliver-return-signoff'};
  console.info('Toon Valley town activities ready',window.ToonValleyTownActivities.counts);
})();