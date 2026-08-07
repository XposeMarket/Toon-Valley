(() => {
  'use strict';
  const TV = window.ToonValley, Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;
  const people = [], seats = [];
  const palette = [
    { body: TV.materials.red, skin: TV.materials.skin, hair: TV.materials.hair, legs: TV.materials.blue, shoes: TV.materials.dark },
    { body: TV.materials.green, skin: TV.materials.skin, hair: TV.mat(0x8b5a2b), legs: TV.materials.purple, shoes: TV.materials.dark },
    { body: TV.materials.yellow, skin: TV.materials.skin, hair: TV.mat(0x34251f), legs: TV.materials.blue, shoes: TV.materials.dark },
    { body: TV.materials.teal, skin: TV.materials.skin, hair: TV.mat(0x5d3d2e), legs: TV.materials.red, shoes: TV.materials.dark }
  ];
  const box = (m,x,y,z) => { const o=TV.outlinedMesh(TV.unitBox,m,1.025); o.scale.set(x,y,z); return o; };
  const add = (area,obj,x,y,z) => { const b=TV.areaBounds[area]; obj.position.set(b.cx+x,y,b.cz+z); TV.interiorGroups[area].add(obj); return obj; };

  function poseSeated(character) {
    const d = character.userData;
    d.bodyRoot.position.y = .08;
    d.legs[0].rotation.x = d.legs[1].rotation.x = -1.12;
    d.arms[0].rotation.x = d.arms[1].rotation.x = -.22;
  }
  function sitAt(area, x, z, rot=0, label='seat') {
    if (TV.state.area !== area) return;
    TV.state.seated = true;
    TV.state.seat = { position:{x,z}, rotation:{y:rot}, userData:{area,label} };
    TV.player.position.set(x,.62,z);
    TV.player.rotation.y = rot;
    TV.playerVelocity.set(0,0,0);
    TV.state.jumpVelocity=0; TV.state.grounded=true; TV.state.cameraReady=false;
    poseSeated(TV.player);
    TV.showToast(`🪑 Sitting at ${label}. Move, jump, or use to stand.`,2.2);
  }
  function registerSeat(area,lx,lz,rot=0,label='seat') {
    const b=TV.areaBounds[area], x=b.cx+lx, z=b.cz+lz;
    TV.registerInteraction({x,z,radius:1.65,area,prompt:`Sit at ${label}`,action:()=>sitAt(area,x,z,rot,label)});
    seats.push({area,x,z,label});
  }
  function chair(area,lx,lz,rot=0,color=TV.materials.blue,label='chair') {
    const g=new THREE.Group(), s=box(color,1.12,.22,1.02), back=box(color,1.12,1.2,.2);
    s.position.y=.72; back.position.set(0,1.35,-.42); g.add(s,back);
    for(const sx of[-.4,.4])for(const sz of[-.32,.32]){const leg=new THREE.Mesh(TV.unitBox,TV.materials.dark);leg.scale.set(.11,.66,.11);leg.position.set(sx,.33,sz);g.add(leg);}
    g.rotation.y=rot; add(area,g,lx,0,lz); registerSeat(area,lx,lz,rot,label); return g;
  }
  function spawn(area,name,role,lx,lz,rot=0,p=0,seated=false,line='Hello!') {
    const c=TV.createCharacter(palette[p%palette.length],true); c.scale.setScalar(.9); add(area,c,lx,0,lz); c.rotation.y=rot;
    c.userData.name=name; c.userData.role=role; if(seated) poseSeated(c);
    people.push({area,name,role,seated,object:c});
    const b=TV.areaBounds[area];
    TV.registerInteraction({x:b.cx+lx,z:b.cz+lz,radius:2.3,area,prompt:`Talk to ${name}`,action:()=>TV.showToast(`${name} · ${role}: ${line}`,3)});
    return c;
  }
  function prop(area,lx,lz,w,h,d,mat,y=h*.5){const o=box(mat,w,h,d);return add(area,o,lx,y,lz);}

  // City Hall
  chair('cityHall',-5.7,2.4,Math.PI,'','visitor chair'); chair('cityHall',5.7,2.4,Math.PI,TV.materials.blue,'visitor chair');
  spawn('cityHall','June','Town clerk',0,-5.7,0,0,false,'I can help with homes, permits, and community events.');
  spawn('cityHall','Marty','Resident',-5.7,2.4,Math.PI,2,true,'I am waiting on a garden permit.');
  prop('cityHall',0,-4.2,2.4,.12,1.1,TV.materials.white,.9);

  // General Store
  chair('generalStore',7.8,5.7,Math.PI,TV.materials.green,'store bench');
  spawn('generalStore','Nina','Cashier',0,5.2,Math.PI,1,false,'Fresh fruit came in this morning.');
  spawn('generalStore','Otis','Shopper',-4,1.2,.5,2,false,'I always buy too many mystery candy bags.');
  prop('generalStore',-4,1.2,1.2,.45,.9,TV.materials.wood,.35);

  // Library
  registerSeat('library',-1.8,3.5,-.35,'reading chair'); registerSeat('library',1.8,3.5,.35,'reading chair');
  chair('library',-2.2,-.2,0,TV.materials.green,'study chair'); chair('library',2.2,-.2,0,TV.materials.blue,'study chair');
  spawn('library','Mabel','Librarian',0,-5.5,0,3,false,'Quiet voices, big adventures.');
  spawn('library','Theo','Reader',-1.8,3.5,-.35,0,true,'This moon-rabbit book is excellent.');

  // Cafe: booths, stools, barista, couple and coffee equipment.
  [-4.4,0,4.4].forEach(x=>registerSeat('cafe',x,4.8,Math.PI,'cafe booth'));
  [-4,-2,0,2,4].forEach(x=>registerSeat('cafe',x,-4.2,Math.PI,'counter stool'));
  const machine=prop('cafe',-2.2,-6.4,2.0,1.7,.8,TV.materials.dark,1.35);
  const steam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.09,.9,6),TV.materials.white);steam.position.set(machine.position.x,2.5,machine.position.z);TV.interiorGroups.cafe.add(steam);
  spawn('cafe','Ari','Barista',0,-6.45,Math.PI,1,false,'The berry-cloud latte is the favorite today.');
  spawn('cafe','Maya','Cafe guest',-4.8,4.8,Math.PI,0,true,'We meet here every Friday.');
  spawn('cafe','Benny','Cafe guest',-4.05,4.8,Math.PI,2,true,'The waffles are worth the walk.');
  spawn('cafe','Luna','Customer',2,-4.2,Math.PI,3,true,'I am waiting on a cocoa.');
  for(const x of[-4.8,-4.05,2]){const mug=new THREE.Mesh(new THREE.CylinderGeometry(.16,.14,.28,8),TV.materials.cream);add('cafe',mug,x,1.22,x===2?-5.25:3.7);}

  // Furniture store
  [-7.5,-6.4,-5.3].forEach(x=>registerSeat('furnitureStore',x,2.2,0,'showroom sofa'));
  spawn('furnitureStore','Penny','Furniture designer',0,4.8,Math.PI,3,false,'Try everything before you bring it home.');
  spawn('furnitureStore','Finn','Shopper',-6.4,2.2,0,0,true,'This sofa is dangerously comfortable.');

  // Clinic
  [-6.5,-3.5,3.5,6.5].forEach(x=>registerSeat('clinic',x,5.8,Math.PI,'waiting-room chair'));
  spawn('clinic','Rosa','Receptionist',0,5.25,Math.PI,3,false,'The doctor will be right with you.');
  spawn('clinic','Dr. Sunny','Doctor',5.2,-4.8,0,1,false,'Remember to drink water and take breaks.');
  spawn('clinic','Pip','Patient',-6.5,5.8,Math.PI,2,true,'I only bumped my knee at the playground.');

  // Fire station
  [5.3,7.3,9.3].forEach(x=>registerSeat('fireStation',x,6,Math.PI,'crew chair'));
  spawn('fireStation','Sam','Firefighter',-8,-5.6,.5,0,false,'Engine 1 is ready to roll.');
  spawn('fireStation','Tilly','Firefighter',7.3,6,Math.PI,1,true,'We are doing equipment checks today.');

  // Post office
  chair('postOffice',-6.5,5.6,Math.PI,TV.materials.blue,'post-office chair'); chair('postOffice',-4.7,5.6,Math.PI,TV.materials.blue,'post-office chair');
  spawn('postOffice','Cal','Postal clerk',0,5.45,Math.PI,2,false,'Every postcard gets a smiling-sun stamp.');
  spawn('postOffice','Ivy','Customer',-5.5,5.6,Math.PI,3,true,'I am mailing a birthday card.');

  // School
  for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=-6.3+c*4.2,z=-3.2+r*3.2;registerSeat('school',x,z,0,'student chair');}
  registerSeat('school',0,-5.8,0,'teacher chair');
  spawn('school','Ms. Maple','Teacher',0,-7.3,0,0,false,'Today we are drawing maps of Toon Valley.');
  [[-6.3,-3.2],[-2.1,0],[2.1,3.2],[6.3,-3.2]].forEach(([x,z],i)=>spawn('school',['Cleo','Milo','Nora','Jasper'][i],'Student',x,z,0,i,true,['I drew the lake!','Mine has a giant bus.','I added the theater.','I drew the mountains.'][i]));

  // Theater: every one of the 28 auditorium seats is now usable.
  for(let r=0;r<4;r++)for(let c=0;c<7;c++){const x=-9+c*3,z=2.8-r*3;registerSeat('theater',x,z,Math.PI,'theater seat');}
  spawn('theater','Wren','Usher',-9,8.5,Math.PI,1,false,'Tickets, trailers, and tiny movies this way.');
  spawn('theater','Rosie','Concession clerk',10.5,8.7,Math.PI,0,false,'Popcorn is extra crunchy today.');
  [[-6,2.8],[3,-.2],[6,-3.2],[-3,-6.2]].forEach(([x,z],i)=>spawn('theater',['Milo','Nora','Sam','Cleo'][i],'Moviegoer',x,z,Math.PI,i,true,'Shhh — this is the good part.'));

  // Low-cost idle motion makes staff feel present without pathfinding inside rooms.
  let t=0;
  TV.registerUpdateHook((dt)=>{t+=dt;for(const p of people){if(p.seated)continue;const d=p.object.userData;d.arms[0].rotation.x=Math.sin(t*1.7+p.name.length)*.08;d.arms[1].rotation.x=-d.arms[0].rotation.x;d.bodyRoot.position.y=Math.sin(t*1.25+p.name.length)*.015;}});

  const byArea = {};
  for(const p of people) (byArea[p.area] ||= []).push(p.name);
  const theaterSeats = seats.filter(s=>s.area==='theater').length;
  const cafeSeats = seats.filter(s=>s.area==='cafe').length;
  window.ToonValleyLivingInteriors = Object.freeze({
    counts:{areas:Object.keys(byArea).length,people:people.length,seats:seats.length,theaterSeats,cafeSeats},
    staffByArea:byArea,
    sitAt
  });
  console.info('Toon Valley living interiors ready',window.ToonValleyLivingInteriors.counts);
})();
