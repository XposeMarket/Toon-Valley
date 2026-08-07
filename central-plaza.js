(() => {
  'use strict';
  const TV = window.ToonValley;
  const Life = window.ToonValleyLife;
  if (!TV || !Life) return;
  const { THREE } = TV;

  const root = new THREE.Group();
  root.position.set(-14, TV.terrainHeight(-14, 16), 16);
  TV.scene.add(root);

  const stone = TV.mat(0xd9d3c2);
  const blue = TV.mat(0x66bde8);
  const green = TV.mat(0x5da76b);
  const tan = TV.mat(0xe8c98d);
  const red = TV.mat(0xc84d4d);
  const dark = TV.mat(0x57483f);

  // Central fountain landmark.
  const basin = TV.outlinedMesh(new THREE.CylinderGeometry(2.25, 2.45, 0.45, 18), stone, 1.025);
  basin.position.set(0, 0.23, 0);
  root.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.10, 18), blue);
  water.position.set(0, 0.47, 0);
  root.add(water);
  const pedestal = TV.outlinedMesh(new THREE.CylinderGeometry(0.38, 0.55, 1.7, 10), stone, 1.03);
  pedestal.position.set(0, 1.25, 0);
  root.add(pedestal);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), blue);
  topper.position.set(0, 2.25, 0);
  root.add(topper);
  TV.addCircleCollider(-14, 16, 2.45);
  TV.registerInteraction({
    object: root,
    radius: 3.8,
    area: 'world',
    prompt: 'Make a wish at the fountain',
    action: () => TV.showToast('⛲ You make a wish for a good day in Toon Valley.', 2.4)
  });

  // Farmer's market stall: a visible daily interaction tied to the economy/help loop.
  const stall = new THREE.Group();
  stall.position.set(6.8, 0, -1.2);
  root.add(stall);
  const counter = TV.outlinedMesh(TV.unitBox, tan, 1.03);
  counter.scale.set(2.4, 0.9, 1.25);
  counter.position.y = 0.45;
  stall.add(counter);
  const canopy = TV.outlinedMesh(TV.unitBox, red, 1.03);
  canopy.scale.set(2.8, 0.16, 1.55);
  canopy.position.y = 2.35;
  stall.add(canopy);
  [-1.15, 1.15].forEach((x) => {
    const post = new THREE.Mesh(TV.unitBox, dark);
    post.scale.set(0.12, 2.2, 0.12);
    post.position.set(x, 1.15, -0.55);
    stall.add(post);
  });
  for (let i = 0; i < 5; i++) {
    const crate = TV.outlinedMesh(TV.unitBox, i % 2 ? green : tan, 1.02);
    crate.scale.set(0.35, 0.28, 0.35);
    crate.position.set(-0.8 + i * 0.4, 1.02, 0.05 + (i % 2) * 0.18);
    stall.add(crate);
  }
  TV.addBoxCollider(-7.2, 14.8, 2.8, 1.6);

  let marketDay = -1;
  let sampleTaken = false;
  function syncDay() {
    const today = Life.getState().world.day;
    if (marketDay !== today) {
      marketDay = today;
      sampleTaken = false;
    }
  }
  syncDay();
  TV.registerInteraction({
    object: stall,
    radius: 3.4,
    area: 'world',
    prompt: 'Visit the farmers market',
    action: () => {
      syncDay();
      if (!sampleTaken) {
        sampleTaken = true;
        Life.addMoney(10, 'Market tasting survey');
        Life.emitProgress('help', 1, { activity: 'farmers-market' });
        TV.showToast('🥕 You helped taste-test produce. The vendor pays you $10.', 2.8);
      } else {
        TV.showToast('🥬 Fresh produce, jam, and bread are on today’s market table.', 2.4);
      }
    }
  });

  // Four picnic tables turn the plaza into a usable social space.
  [[-5.3, -4.0], [-5.0, 4.2], [4.4, 4.4], [4.0, -4.4]].forEach(([x, z], index) => {
    const table = new THREE.Group();
    table.position.set(x, 0, z);
    root.add(table);
    const top = TV.outlinedMesh(TV.unitBox, dark, 1.02);
    top.scale.set(1.8, 0.16, 0.8);
    top.position.y = 0.8;
    table.add(top);
    [-0.65, 0.65].forEach((sx) => {
      const bench = TV.outlinedMesh(TV.unitBox, tan, 1.02);
      bench.scale.set(0.28, 0.18, 1.65);
      bench.position.set(sx, 0.48, 0);
      table.add(bench);
    });
    TV.registerInteraction({
      object: table,
      radius: 2.0,
      area: 'world',
      prompt: 'Rest at picnic table',
      action: () => TV.showToast(index % 2 ? '🌳 The plaza is calm from here.' : '🥪 A perfect spot for lunch.', 2.0)
    });
  });

  let elapsed = 0;
  TV.registerUpdateHook((dt) => {
    elapsed += dt;
    water.rotation.y += dt * 0.08;
    topper.position.y = 2.25 + Math.sin(elapsed * 2.4) * 0.08;
    if (Math.floor(elapsed) % 3 === 0) syncDay();
  });

  window.ToonValleyCentralPlaza = { root, fountain: basin, market: stall, picnicTables: 4 };
  console.info('Toon Valley central plaza ready');
})();
