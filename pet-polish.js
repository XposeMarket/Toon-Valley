(() => {
  'use strict';
  const TV=window.ToonValley;if(!TV)return;const{THREE}=TV;
  const polished=new Set();
  function materialFrom(group,fallback){let mat=null;group.traverse(o=>{if(!mat&&o.isMesh&&o.material?.color)mat=o.material;});return mat||TV.mat(fallback);}
  function mesh(geo,mat,scale,pos){const m=TV.outlinedMesh(geo,mat,1.025);m.scale.set(...scale);m.position.set(...pos);return m;}
  function addLeg(group,mat,x,z){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,.48,7),mat);leg.position.set(x,.3,z);group.add(leg);const paw=mesh(new THREE.SphereGeometry(.12,7,5),mat,[1.25,.55,1.35],[x,.08,z+.035]);group.add(paw);}
  function buildDog(group,mat){
    group.clear();group.userData.petKind='dog';
    group.add(mesh(new THREE.SphereGeometry(.48,10,8),mat,[1.45,.72,.82],[0,.7,0]));
    group.add(mesh(new THREE.SphereGeometry(.34,10,8),mat,[.95,1.0,.92],[.62,1.03,0]));
    const muzzle=mesh(new THREE.SphereGeometry(.2,9,7),TV.materials.cream,[1.08,.72,.9],[.92,.94,0]);group.add(muzzle);
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),TV.materials.dark);nose.position.set(1.1,.96,0);group.add(nose);
    for(const z of[-.13,.13]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.045,7,5),TV.materials.dark);eye.position.set(.88,1.12,z);group.add(eye);const ear=mesh(new THREE.SphereGeometry(.16,8,6),mat,[.65,1.25,.45],[.5,1.23,z*1.65]);ear.rotation.x=z<0?-.25:.25;group.add(ear);}
    for(const x of[-.38,.42])for(const z of[-.25,.25])addLeg(group,mat,x,z);
    const tail=new THREE.Group();tail.position.set(-.63,.78,0);const a=new THREE.Mesh(new THREE.CylinderGeometry(.045,.065,.55,7),mat);a.rotation.z=-.85;a.position.set(-.2,.2,0);tail.add(a);const b=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.42,7),mat);b.rotation.z=-1.15;b.position.set(-.48,.42,0);tail.add(b);tail.userData.tail=true;group.add(tail);
    const collar=new THREE.Mesh(new THREE.TorusGeometry(.29,.035,6,14),TV.materials.red);collar.rotation.y=Math.PI/2;collar.position.set(.46,.93,0);group.add(collar);
  }
  function buildCat(group,mat){
    group.clear();group.userData.petKind='cat';
    group.add(mesh(new THREE.SphereGeometry(.43,10,8),mat,[1.45,.68,.76],[-.04,.67,0]));
    group.add(mesh(new THREE.SphereGeometry(.32,10,8),mat,[1,.95,.95],[.58,1.0,0]));
    const chest=mesh(new THREE.SphereGeometry(.24,9,7),TV.materials.cream,[.75,1.1,.75],[.32,.7,0]);group.add(chest);
    for(const z of[-.15,.15]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.14,.34,5),mat);ear.position.set(.54,1.36,z);ear.rotation.z=z<0?.08:-.08;group.add(ear);const eye=new THREE.Mesh(new THREE.SphereGeometry(.042,7,5),TV.materials.dark);eye.position.set(.84,1.08,z*.72);group.add(eye);}
    const nose=new THREE.Mesh(new THREE.SphereGeometry(.055,7,5),TV.materials.pink);nose.position.set(.88,.96,0);group.add(nose);
    for(const x of[-.35,.38])for(const z of[-.22,.22])addLeg(group,mat,x,z);
    const tail=new THREE.Group();tail.position.set(-.65,.72,0);for(let i=0;i<3;i++){const seg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.45,7),mat);seg.rotation.z=-.55-i*.18;seg.position.set(-.14-i*.3,.14+i*.24,0);tail.add(seg);}tail.userData.tail=true;group.add(tail);
    for(const z of[-.12,.12])for(let i=0;i<2;i++){const w=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.34,4),TV.materials.white);w.rotation.z=Math.PI/2;w.position.set(.98,.96,z+(i-.5)*.08);group.add(w);}
  }
  function typeFor(item){
    const p=item.prompt||'';if(p==='Pet your companion'){return window.ToonValleyOwnedHome?.getState?.().pet?.type||'dog';}
    if(/Mochi|Sunny/i.test(p))return'cat';return'dog';
  }
  function polish(item){const g=item.object;if(!g?.isGroup)return false;const type=typeFor(item);if(g.userData.petPolishVersion===2&&g.children.length>8&&g.userData.petKind===type)return false;const mat=materialFrom(g,type==='cat'?0x8a8a95:0xc58b52);if(type==='cat')buildCat(g,mat);else buildDog(g,mat);g.userData.petPolishVersion=2;polished.add(g);return true;}
  const targets=()=>TV.interactables.filter(i=>i.object&&(/^Pet /.test(i.prompt)||i.prompt==='Pet your companion'||/^Help .* get home$/.test(i.prompt)));
  targets().forEach(polish);
  let t=0;TV.registerUpdateHook(dt=>{t+=dt;if(t>.7){t=0;targets().forEach(polish);}for(const g of polished){const tail=g.children.find(c=>c.userData?.tail);if(tail)tail.rotation.z=Math.sin(performance.now()*.008+(g.id%7))*(g.userData.petKind==='dog'?.32:.12);}});
  window.ToonValleyPetPolish=Object.freeze({version:2,get count(){return polished.size;},rebuild:()=>targets().forEach(polish)});
  console.info('Toon Valley pet polish ready',window.ToonValleyPetPolish.count);
})();