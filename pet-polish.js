(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;const{THREE}=TV;
  const animated=[];
  const coatColors={Biscuit:0xc98f58,Scout:0x5d5350,Noodle:0xe1c9a6,Mochi:0xe3a86b,Pepper:0x5d5d63,Sunny:0xd9b73f};
  const mat=c=>TV.mat(c),outline=(g,m,s=1.03)=>TV.outlinedMesh(g,m,s);
  function eye(){return new THREE.Mesh(new THREE.SphereGeometry(.055,7,5),TV.materials.dark)}
  function rebuild(group,type,name,color){
    if(!group)return;group.clear();const coat=mat(color||0xb98b61),cream=TV.materials.cream,dark=TV.materials.dark;
    const body=outline(new THREE.DodecahedronGeometry(.48,0),coat);body.scale.set(type==='cat'?1.15:1.35,.72,.82);body.position.y=.62;group.add(body);
    const chest=outline(new THREE.SphereGeometry(.34,8,6),type==='cat'?coat:cream);chest.scale.set(.9,1.05,.72);chest.position.set(0,.69,.42);group.add(chest);
    const head=outline(new THREE.DodecahedronGeometry(.36,0),coat);head.scale.set(.9,.9,.88);head.position.set(0,1.03,.72);group.add(head);
    const muzzle=outline(new THREE.SphereGeometry(.19,8,6),cream);muzzle.scale.set(1.05,.72,.9);muzzle.position.set(0,.93,1.03);group.add(muzzle);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.075,7,5),dark);nose.scale.set(1.2,.75,.8);nose.position.set(0,.98,1.19);group.add(nose);
    for(const side of[-1,1]){const e=eye();e.position.set(side*.14,1.12,1.0);group.add(e);const ear=new THREE.Mesh(new THREE.ConeGeometry(type==='cat'?.14:.13,type==='cat'?.34:.29,5),coat);ear.position.set(side*.22,1.39,.69);ear.rotation.z=side*(type==='cat'?.12:.26);group.add(ear)}
    for(const x of[-.28,.28])for(const z of[-.42,.38]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.48,7),coat);leg.position.set(x,.31,z);group.add(leg);const paw=outline(new THREE.SphereGeometry(.105,7,5),type==='cat'?cream:coat,1.02);paw.scale.set(1.15,.55,1.25);paw.position.set(x,.08,z+.03);group.add(paw)}
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.23,.035,6,14),type==='cat'?TV.materials.pink:TV.materials.blue);collar.rotation.x=Math.PI/2;collar.position.set(0,.88,.65);group.add(collar);
    const tailPivot=new THREE.Group();tailPivot.position.set(0,.72,-.75);group.add(tailPivot);
    if(type==='cat'){
      const s1=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.72,7),coat);s1.rotation.x=-.85;s1.position.set(0,.25,-.22);tailPivot.add(s1);
      const s2=new THREE.Mesh(new THREE.CylinderGeometry(.038,.05,.62,7),coat);s2.rotation.x=-1.25;s2.position.set(0,.55,-.48);tailPivot.add(s2);
    }else{const t=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.72,7),coat);t.rotation.x=-1.05;t.position.set(0,.25,-.26);tailPivot.add(t)}
    group.userData.petType=type;group.userData.petName=name;group.userData.tailPivot=tailPivot;animated.push(group);
  }
  const plaza=window.ToonValleyCentralPlaza?.dogPark;
  if(plaza)plaza.traverse(o=>{if(o.userData?.name&&coatColors[o.userData.name])rebuild(o,'dog',o.userData.name,coatColors[o.userData.name])});
  const lost=TV.interactables.filter(i=>/^Help .+ get home$/.test(i.prompt||''));
  lost.forEach((i,n)=>{const name=(i.prompt.match(/^Help (.+) get home$/)||[])[1]||`Pet ${n+1}`;rebuild(i.object,n===0?'cat':'dog',name,coatColors[name]||0xb98b61)});
  const homeInteraction=TV.interactables.find(i=>i.prompt==='Pet your companion');const homeState=window.ToonValleyOwnedHome?.getState?.();
  if(homeInteraction?.object&&homeState?.pet)rebuild(homeInteraction.object,homeState.pet.type,homeState.pet.name,homeState.pet.type==='cat'?0x777988:0xc88f55);
  let t=0;TV.registerUpdateHook(dt=>{t+=dt;animated.forEach((g,i)=>{const tail=g.userData.tailPivot;if(tail)tail.rotation.y=Math.sin(t*5+i)*(.35+(g.userData.petType==='dog'?.25:.1));const head=g.children.find(c=>c.position?.y>1&&c.position?.z>.6);if(head)head.rotation.z=Math.sin(t*1.2+i)*.025})});
  window.ToonValleyPetPolish=Object.freeze({counts:{pets:animated.length,dogPark:3,lost:lost.length,home:homeInteraction?.object?1:0}});
  console.info('Toon Valley pet polish ready',window.ToonValleyPetPolish.counts);
})();