(() => {
  'use strict';

  const TV = window.ToonValley;
  if (!TV) {
    console.error('Toon Valley life systems could not start because the core game API is missing.');
    return;
  }

  const { THREE } = TV;
  const SAVE_VERSION = 4;
  const DB_NAME = 'toon-valley-save-db';
  const STORE_NAME = 'saves';
  const SLOT_KEY = 'toon-valley-active-slot';
  const SETTINGS_KEY = 'toon-valley-settings';
  const EMERGENCY_KEY = 'toon-valley-emergency-save';

  const ITEM_DEFS = Object.freeze({
    apple: { id: 'apple', name: 'Shiny Apple', icon: '🍎', type: 'food', price: 12, hunger: 13, happiness: 2, description: 'Crisp, sweet, and polished enough to see your reflection.' },
    sandwich: { id: 'sandwich', name: 'Cloud Sandwich', icon: '🥪', type: 'food', price: 28, hunger: 28, happiness: 4, description: 'A fluffy cafe sandwich with star-cut vegetables.' },
    soup: { id: 'soup', name: 'Sunshine Soup', icon: '🍲', type: 'food', price: 42, hunger: 38, happiness: 7, description: 'Warm vegetable soup that makes rainy days feel smaller.' },
    berryCake: { id: 'berryCake', name: 'Berry Moon Cake', icon: '🍰', type: 'food', price: 58, hunger: 22, happiness: 15, description: 'A pink berry cake sold in one extremely generous slice.' },
    juice: { id: 'juice', name: 'Rainbow Juice', icon: '🧃', type: 'food', price: 18, hunger: 7, happiness: 7, energy: 5, description: 'Fruit juice with a completely unnecessary curly straw.' },

    chairBlue: { id: 'chairBlue', name: 'Blueberry Chair', icon: '🪑', type: 'furniture', price: 85, description: 'A sturdy blue chair with rounded toon edges.', comfort: 2 },
    tableSunny: { id: 'tableSunny', name: 'Sunny Table', icon: '🟨', type: 'furniture', price: 145, description: 'A warm wooden table for meals, crafts, and unpaid bills.', comfort: 1 },
    sofaPink: { id: 'sofaPink', name: 'Marshmallow Sofa', icon: '🛋️', type: 'furniture', price: 360, description: 'A soft pink sofa that nearly swallows anyone who sits down.', comfort: 8 },
    bedCloud: { id: 'bedCloud', name: 'Cloud Nine Bed', icon: '🛏️', type: 'furniture', price: 520, description: 'A cloud-soft bed that restores extra energy.', comfort: 12 },
    floorLamp: { id: 'floorLamp', name: 'Firefly Floor Lamp', icon: '💡', type: 'furniture', price: 125, description: 'A cheerful lamp with a warm yellow shade.', comfort: 2 },
    bookshelf: { id: 'bookshelf', name: 'Storybook Shelf', icon: '📚', type: 'furniture', price: 275, description: 'A colorful shelf that improves creativity practice.', comfort: 3 },
    pottedPlant: { id: 'pottedPlant', name: 'Wiggly Houseplant', icon: '🪴', type: 'furniture', price: 95, description: 'A plant that looks suspiciously more awake than you.', comfort: 3 },
    rainbowRug: { id: 'rainbowRug', name: 'Rainbow Rug', icon: '🌈', type: 'furniture', price: 180, description: 'A soft oval rug in bright candy colors.', comfort: 4 },
    studyDesk: { id: 'studyDesk', name: 'Little Genius Desk', icon: '🖥️', type: 'furniture', price: 310, description: 'A desk for studying, drawing, and running tiny businesses.', comfort: 2 },
    toonTV: { id: 'toonTV', name: 'Bubble Television', icon: '📺', type: 'furniture', price: 680, description: 'A chunky television with three channels and excellent cartoons.', comfort: 10 },
    dresser: { id: 'dresser', name: 'Maple Dresser', icon: '🗄️', type: 'furniture', price: 240, description: 'A maple dresser with oversized round handles.', comfort: 2 },
    fridge: { id: 'fridge', name: 'Minty Fridge', icon: '🧊', type: 'furniture', price: 760, description: 'A mint refrigerator that unlocks better home meals.', comfort: 2 },
    oven: { id: 'oven', name: 'Cherry Oven', icon: '🍳', type: 'furniture', price: 820, description: 'A bright red oven for practicing cooking recipes.', comfort: 2 },
    shower: { id: 'shower', name: 'Raincloud Shower', icon: '🚿', type: 'furniture', price: 620, description: 'A compact shower that restores hygiene quickly.', comfort: 3 },
    musicBox: { id: 'musicBox', name: 'Moonbeam Music Box', icon: '🎵', type: 'furniture', price: 420, description: 'A tiny music player that improves happiness and creativity.', comfort: 7 }
  });

  const SKILL_DEFS = Object.freeze({
    cooking: { name: 'Cooking', icon: '🍳' },
    gardening: { name: 'Gardening', icon: '🌱' },
    fishing: { name: 'Fishing', icon: '🎣' },
    fitness: { name: 'Fitness', icon: '🏃' },
    creativity: { name: 'Creativity', icon: '🎨' },
    handiness: { name: 'Handiness', icon: '🔨' },
    charisma: { name: 'Charisma', icon: '💬' },
    business: { name: 'Business', icon: '💼' },
    music: { name: 'Music', icon: '🎵' },
    photography: { name: 'Photography', icon: '📷' }
  });

  const NPC_BACKSTORIES = Object.freeze({
    Maya: ['Mayor Maya loves color-coded folders and secretly writes detective novels.', 'Her favorite gift is cake, and she never turns down a town improvement idea.'],
    Benny: ['Benny works at the cafe and believes every problem can be solved with waffles.', 'He collects novelty mugs and is always looking for a taste tester.'],
    Pip: ['Pip delivers packages around town on a squeaky green bicycle.', 'They know every shortcut and almost every piece of local gossip.'],
    Luna: ['Luna runs the library evening club and studies the stars after closing.', 'She likes books, music, and quiet walks near the pond.'],
    Theo: ['Theo repairs furniture and keeps a pocket full of mismatched screws.', 'He can teach handiness tricks after you become friends.'],
    Milo: ['Milo is a park caretaker who names every tree.', 'He gets extremely excited when anyone helps clean Sunshine Park.'],
    Nora: ['Nora teaches at Rainbow Elementary and paints murals on weekends.', 'She loves plants and creative furniture.'],
    Jasper: ['Jasper works at the theater and practices dramatic entrances everywhere.', 'He is friendly, loud, and never underdressed.'],
    Ivy: ['Ivy owns the garden stall and experiments with unusually large strawberries.', 'She loves rain and dislikes plastic flowers.'],
    Finn: ['Finn is learning photography and keeps asking everyone to hold very still.', 'He pays well for unusual town photographs.'],
    Rosie: ['Rosie manages Happy Home Furnishings and rearranges the showroom daily.', 'She gives discounts to regular customers.'],
    Otis: ['Otis works at the fire station and cooks legendary station chili.', 'He is dependable and laughs at every terrible joke.'],
    Cleo: ['Cleo runs the grocery counter and remembers every customer’s favorite snack.', 'She loves community events and bargain hunting.'],
    Sam: ['Sam is a musician who performs in the square after sunset.', 'They can help the player improve music skill.'],
    Tilly: ['Tilly studies bugs, clouds, and anything else that refuses to sit still.', 'She often has exploration tasks near the mountains.'],
    Wren: ['Wren is a carpenter helping Toon Valley expand.', 'They handle home renovations and large town projects.']
  });

  const PROPERTY_TIERS = Object.freeze([
    { name: 'Sunbeam Studio', price: 0, capacity: 12, description: 'A cozy rented studio in Maple Apartments.' },
    { name: 'Starter Cottage', price: 2500, capacity: 22, description: 'Your own cheerful cottage with more decorating space.' },
    { name: 'Family Toon Home', price: 7500, capacity: 34, description: 'A roomy home with an expanded living area.' },
    { name: 'Valley Dream House', price: 18000, capacity: 52, description: 'A large custom home with the best address in town.' }
  ]);

  const PROJECT_DEFS = Object.freeze({
    park: { name: 'Sunshine Park Gazebo', goal: 1800, icon: '🌳', description: 'Build a colorful gazebo and community picnic area.' },
    bridge: { name: 'Mountain Trail Bridge', goal: 4200, icon: '🌉', description: 'Repair the old bridge and open the highland walking trail.' },
    theater: { name: 'Moonbeam Festival Stage', goal: 7200, icon: '🎭', description: 'Upgrade the theater plaza for larger festivals and concerts.' }
  });

  const WEATHER = ['sunny', 'cloudy', 'rainy', 'sunny', 'sunny', 'foggy'];
  const WEATHER_ICONS = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', foggy: '🌫️' };

  function defaultSkillState() {
    return Object.fromEntries(Object.keys(SKILL_DEFS).map((id) => [id, { level: 1, xp: 0 }]));
  }

  function createDefaultSave() {
    return {
      version: SAVE_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: {
        money: 650,
        position: { area: 'world', x: 0, z: 10, returnPoint: null },
        needs: { energy: 92, hunger: 78, happiness: 86, hygiene: 88 },
        skills: defaultSkillState(),
        inventory: { apple: 2, juice: 1, chairBlue: 1 },
        relationships: Object.fromEntries(Object.keys(NPC_BACKSTORIES).map((name) => [name, 0])),
        lastTalk: {},
        jobHistory: {},
        stats: { moneyEarned: 0, moneySpent: 0, jobsCompleted: 0, itemsBought: 0, conversations: 0, furniturePlaced: 0, daysPlayed: 0 }
      },
      property: {
        tier: 0,
        wallpaper: 'cream',
        flooring: 'maple',
        furniture: [],
        nextFurnitureUid: 1
      },
      world: {
        day: 1,
        minutes: 8 * 60,
        weather: 'sunny',
        projects: { park: 0, bridge: 0, theater: 0 },
        completedProjects: [],
        discovered: ['town-center', 'maple-apartments']
      },
      quests: {
        storyStep: 0,
        storyProgress: 0,
        completedStory: [],
        dailyDay: 1,
        daily: []
      },
      settings: {
        relaxedNeeds: false,
        sound: true,
        autoSave: true
      },
      activeJob: null
    };
  }

  function mergeDeep(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    for (const [key, value] of Object.entries(incoming)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
        mergeDeep(base[key], value);
      } else {
        base[key] = value;
      }
    }
    return base;
  }

  function normalizeSave(raw) {
    const save = mergeDeep(createDefaultSave(), raw || {});
    save.version = SAVE_VERSION;
    save.updatedAt = Date.now();
    for (const id of Object.keys(SKILL_DEFS)) {
      if (!save.player.skills[id]) save.player.skills[id] = { level: 1, xp: 0 };
    }
    for (const name of Object.keys(NPC_BACKSTORIES)) {
      if (!Number.isFinite(save.player.relationships[name])) save.player.relationships[name] = 0;
    }
    return save;
  }

  let save = createDefaultSave();
  let activeSlot = Number(localStorage.getItem(SLOT_KEY) || 1);
  let db = null;
  let saveTimer = 0;
  let minuteAccumulator = 0;
  let visualAccumulator = 0;
  let uiAccumulator = 0;
  let activeModal = null;
  let currentTab = 'home';
  let buildMode = null;
  let jobRuntime = null;
  let audioContext = null;
  let lastSavedLabel = 'Not saved yet';
  let homeFurnitureRoot = null;
  const furnitureObjects = new Map();
  const jobWorldObjects = [];
  const projectVisuals = {};

  // -------------------------------------------------------------------------
  // Persistence: IndexedDB primary, localStorage emergency fallback.
  // -------------------------------------------------------------------------
  function openDatabase() {
    return new Promise((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  function dbGet(key) {
    return new Promise((resolve) => {
      if (!db) return resolve(null);
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  function dbPut(key, value) {
    return new Promise((resolve, reject) => {
      if (!db) return resolve(false);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  function captureRuntimeState() {
    save.player.position = {
      area: TV.state.area,
      x: Number(TV.player.position.x.toFixed(3)),
      z: Number(TV.player.position.z.toFixed(3)),
      returnPoint: TV.state.returnPoint ? { x: TV.state.returnPoint.x, z: TV.state.returnPoint.z } : null
    };
    save.updatedAt = Date.now();
  }

  async function saveGame(reason = 'autosave') {
    captureRuntimeState();
    const snapshot = JSON.parse(JSON.stringify(save));
    try {
      const stored = await dbPut(`slot-${activeSlot}`, snapshot);
      if (!stored) localStorage.setItem(`${EMERGENCY_KEY}-${activeSlot}`, JSON.stringify(snapshot));
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(snapshot));
      lastSavedLabel = `Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      if (reason === 'manual') TV.showToast('Game saved.', 1.5);
      updateSaveStatus();
      return true;
    } catch (error) {
      console.error('Save failed', error);
      localStorage.setItem(EMERGENCY_KEY, JSON.stringify(snapshot));
      TV.showToast('Save used emergency storage.', 2.5);
      return false;
    }
  }

  async function loadGame(slot = activeSlot) {
    let raw = await dbGet(`slot-${slot}`);
    if (!raw) {
      try { raw = JSON.parse(localStorage.getItem(`${EMERGENCY_KEY}-${slot}`) || localStorage.getItem(EMERGENCY_KEY) || 'null'); } catch (_) { raw = null; }
    }
    save = normalizeSave(raw);
    activeSlot = slot;
    localStorage.setItem(SLOT_KEY, String(slot));
    ensureDailyTasks();
    applyLoadedState();
    return save;
  }

  function requestPersistentStorage() {
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  }

  // -------------------------------------------------------------------------
  // UI shell.
  // -------------------------------------------------------------------------
  function injectUI() {
    const root = document.createElement('div');
    root.id = 'life-hud';
    root.innerHTML = `
      <div class="life-top">
        <div class="life-chip life-money"><span>💰 VALLEY BUCKS</span><strong id="money-value">$0</strong></div>
        <div class="life-chip life-clock"><span id="clock-value">DAY 1 · 8:00 AM</span><strong id="weather-value">☀️</strong></div>
        <div class="life-needs">
          ${['energy','hunger','happiness','hygiene'].map((need) => `<div class="need" data-need="${need}"><div class="need-fill"></div><span>${need.toUpperCase()}</span></div>`).join('')}
        </div>
      </div>
      <div class="life-actions">
        <button class="life-round" id="tasks-button" aria-label="Tasks">📋<span class="life-badge hidden" id="task-badge">0</span></button>
        <button class="life-round" id="phone-button" aria-label="Life menu">📱</button>
        <button class="life-round" id="inventory-button" aria-label="Inventory">🎒</button>
        <button class="life-round hidden" id="build-button" aria-label="Build mode">🔨</button>
      </div>
      <div id="objective-card"><b>WELCOME TO TOON VALLEY</b><span id="objective-text">Visit City Hall and meet Mayor Maya.</span><small id="objective-progress"></small></div>
    `;
    document.body.appendChild(root);

    document.getElementById('phone-button').addEventListener('click', () => openPhone('home'));
    document.getElementById('inventory-button').addEventListener('click', () => openPhone('inventory'));
    document.getElementById('tasks-button').addEventListener('click', () => openPhone('tasks'));
    document.getElementById('build-button').addEventListener('click', () => openPhone('home'));
  }

  function modal(title, body, options = {}) {
    closeModal(false);
    const overlay = document.createElement('div');
    overlay.className = 'life-overlay';
    overlay.innerHTML = `
      <section class="life-window ${options.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}">
        <header class="life-window-head"><h2>${escapeHTML(title)}</h2><button class="life-close" aria-label="Close">✕</button></header>
        <div class="life-body">${body}</div>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.life-close').addEventListener('click', () => closeModal());
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay && options.dismissible !== false) closeModal();
    });
    activeModal = overlay;
    TV.setModalOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
    return overlay;
  }

  function closeModal(sound = true) {
    if (activeModal) activeModal.remove();
    activeModal = null;
    if (!buildMode) TV.setModalOpen(false);
    if (sound) sfx('close');
  }

  function openPhone(tab = currentTab) {
    currentTab = tab;
    const tabs = [
      ['home','🏠 Home'], ['inventory','🎒 Bag'], ['tasks','📋 Tasks'], ['skills','⭐ Skills'],
      ['people','🙂 People'], ['town','🏛️ Town'], ['save','💾 Save']
    ];
    const overlay = modal('ToonPhone', `
      <nav class="life-tabs">${tabs.map(([id,label]) => `<button class="life-tab ${id === tab ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</nav>
      <div id="phone-content">${renderPhoneTab(tab)}</div>
    `, { wide: tab === 'inventory' || tab === 'town' });
    overlay.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => openPhone(button.dataset.tab)));
    bindPhoneActions(overlay, tab);
    sfx('open');
  }

  function renderPhoneTab(tab) {
    switch (tab) {
      case 'inventory': return renderInventory();
      case 'tasks': return renderTasks();
      case 'skills': return renderSkills();
      case 'people': return renderPeople();
      case 'town': return renderTown();
      case 'save': return renderSaveSettings();
      default: return renderHomeTab();
    }
  }

  function renderHomeTab() {
    const tier = PROPERTY_TIERS[save.property.tier];
    const placed = save.property.furniture.length;
    return `
      <div class="life-notice"><b>${tier.name}</b><br>${tier.description}</div>
      <div class="life-two-col">
        <section class="life-section">
          <h3>Property</h3>
          <div class="life-row"><div class="life-row-copy"><b>Furniture capacity</b><small>${placed} of ${tier.capacity} placed</small></div><span class="life-pill">🏠 Tier ${save.property.tier + 1}</span></div>
          <div class="life-row"><div class="life-row-copy"><b>Wallpaper</b><small>${capitalize(save.property.wallpaper)}</small></div><button class="life-button secondary" data-action="remodel-wall">Change</button></div>
          <div class="life-row"><div class="life-row-copy"><b>Flooring</b><small>${capitalize(save.property.flooring)}</small></div><button class="life-button secondary" data-action="remodel-floor">Change</button></div>
          ${TV.state.area === 'home' ? '<button class="life-button green" data-action="decorate">DECORATE HOME</button>' : '<div class="life-notice">Go home to place or move furniture.</div>'}
        </section>
        <section class="life-section">
          <h3>Placed furniture</h3>
          ${placed ? save.property.furniture.map((entry) => {
            const def = ITEM_DEFS[entry.itemId];
            return `<div class="life-row"><div class="life-row-copy"><b>${def?.icon || '📦'} ${escapeHTML(def?.name || entry.itemId)}</b><small>Grid ${entry.x.toFixed(1)}, ${entry.z.toFixed(1)}</small></div><div><button class="life-button secondary" data-move-uid="${entry.uid}">Move</button> <button class="life-button secondary" data-store-uid="${entry.uid}">Store</button></div></div>`;
          }).join('') : '<div class="life-empty">Your studio is ready for its first real decorating session.</div>'}
        </section>
      </div>`;
  }

  function renderInventory() {
    const entries = Object.entries(save.player.inventory).filter(([, count]) => count > 0);
    if (!entries.length) return '<div class="life-empty">Your bag is empty. The grocery and furniture stores can fix that.</div>';
    return `<div class="life-grid">${entries.map(([id,count]) => {
      const item = ITEM_DEFS[id];
      if (!item) return '';
      const action = item.type === 'food'
        ? `<button class="life-button green" data-use-item="${id}">EAT / USE</button>`
        : `<button class="life-button blue" data-place-item="${id}" ${TV.state.area !== 'home' ? 'disabled' : ''}>PLACE AT HOME</button>`;
      return `<article class="life-card"><div class="item-icon">${item.icon}</div><h3>${escapeHTML(item.name)} <span class="item-count">×${count}</span></h3><p>${escapeHTML(item.description)}</p><div class="spacer"></div>${action}</article>`;
    }).join('')}</div>`;
  }

  function renderTasks() {
    const story = storyObjective();
    return `
      <section class="life-section"><h3>Main Story</h3>
        <div class="life-card"><h3>${escapeHTML(story.title)}</h3><p>${escapeHTML(story.text)}</p><div class="life-progress"><span style="width:${Math.min(100, story.percent)}%"></span></div><div class="life-card-meta"><span>${story.progressText}</span><span>${story.reward}</span></div></div>
      </section>
      <section class="life-section"><h3>Daily Tasks · Day ${save.world.day}</h3>
        ${save.quests.daily.map((task) => `<div class="life-row"><div class="life-row-copy"><b>${task.done ? '✅' : task.icon} ${escapeHTML(task.title)}</b><small>${escapeHTML(task.description)}</small></div><div><span class="life-pill">${Math.min(task.progress,task.goal)}/${task.goal}</span> <span class="life-pill">$${task.reward}</span></div></div>`).join('')}
      </section>`;
  }

  function renderSkills() {
    return `<div class="life-grid">${Object.entries(SKILL_DEFS).map(([id,def]) => {
      const skill = save.player.skills[id];
      const need = xpForNext(skill.level);
      return `<article class="life-card"><div class="item-icon">${def.icon}</div><h3>${def.name} · Lv ${skill.level}</h3><p>${skillDescription(id, skill.level)}</p><div class="spacer"></div><div class="life-progress"><span style="width:${Math.min(100, skill.xp / need * 100)}%"></span></div><div class="life-card-meta"><span>${skill.xp}/${need} XP</span><span>Max 10</span></div></article>`;
    }).join('')}</div>`;
  }

  function renderPeople() {
    return `<div class="life-grid">${Object.keys(NPC_BACKSTORIES).map((name) => {
      const score = save.player.relationships[name] || 0;
      return `<article class="life-card"><div class="item-icon">${relationshipIcon(score)}</div><h3>${name}</h3><p>${NPC_BACKSTORIES[name][0]}</p><div class="spacer"></div><div class="life-progress"><span style="width:${Math.min(100,score)}%"></span></div><div class="life-card-meta"><span>${relationshipLabel(score)}</span><span>${score}/100</span></div></article>`;
    }).join('')}</div>`;
  }

  function renderTown() {
    return `
      <section class="life-section"><h3>Community Projects</h3><div class="life-grid">
        ${Object.entries(PROJECT_DEFS).map(([id,project]) => {
          const donated = save.world.projects[id] || 0;
          const complete = save.world.completedProjects.includes(id);
          return `<article class="life-card"><div class="item-icon">${project.icon}</div><h3>${project.name}</h3><p>${project.description}</p><div class="spacer"></div><div class="life-progress"><span style="width:${Math.min(100,donated/project.goal*100)}%"></span></div><div class="life-card-meta"><span>$${donated} / $${project.goal}</span><span>${complete ? 'COMPLETE' : 'ACTIVE'}</span></div>${complete ? '' : `<button class="life-button green" data-donate="${id}">DONATE $100</button>`}</article>`;
        }).join('')}
      </div></section>
      <section class="life-section"><h3>Property Ladder</h3>${PROPERTY_TIERS.map((tier,index) => `<div class="life-row"><div class="life-row-copy"><b>${index <= save.property.tier ? '✅' : '🏠'} ${tier.name}</b><small>${tier.description} · Capacity ${tier.capacity}</small></div>${index === save.property.tier + 1 ? `<button class="life-button" data-buy-property="${index}">BUY $${tier.price}</button>` : `<span class="life-pill">${index < save.property.tier ? 'OWNED' : index === save.property.tier ? 'CURRENT' : '$'+tier.price}</span>`}</div>`).join('')}</section>`;
  }

  function renderSaveSettings() {
    return `
      <section class="life-section"><h3>Save Slots</h3>
        ${[1,2,3].map((slot) => `<div class="life-row"><div class="life-row-copy"><b>Save Slot ${slot}</b><small>${slot === activeSlot ? 'Currently active' : 'Switching loads that slot immediately'}</small></div><button class="life-button ${slot === activeSlot ? 'green' : 'secondary'}" data-slot="${slot}">${slot === activeSlot ? 'ACTIVE' : 'LOAD'}</button></div>`).join('')}
        <div class="life-row"><div class="life-row-copy"><b>Manual save</b><small class="life-save-status">${lastSavedLabel}</small></div><button class="life-button green" data-action="save-now">SAVE NOW</button></div>
        <div class="life-row"><div class="life-row-copy"><b>Backup file</b><small>Export or restore a portable JSON save.</small></div><div><button class="life-button secondary" data-action="export">Export</button> <button class="life-button secondary" data-action="import">Import</button></div></div>
      </section>
      <section class="life-section"><h3>Gameplay Settings</h3>
        <div class="life-row"><div class="life-row-copy"><b>Relaxed needs</b><small>Needs decay at one quarter speed.</small></div><button class="life-button secondary" data-toggle="relaxedNeeds">${save.settings.relaxedNeeds ? 'ON' : 'OFF'}</button></div>
        <div class="life-row"><div class="life-row-copy"><b>Sound effects</b><small>Small synthesized interface and reward sounds.</small></div><button class="life-button secondary" data-toggle="sound">${save.settings.sound ? 'ON' : 'OFF'}</button></div>
        <div class="life-row"><div class="life-row-copy"><b>Autosave</b><small>Saves every 20 seconds and whenever the app backgrounds.</small></div><button class="life-button secondary" data-toggle="autoSave">${save.settings.autoSave ? 'ON' : 'OFF'}</button></div>
        <div class="life-row"><div class="life-row-copy"><b>Start over</b><small>Reset only the currently active slot.</small></div><button class="life-button danger" data-action="reset">RESET SLOT</button></div>
      </section>`;
  }

  function bindPhoneActions(root, tab) {
    root.querySelectorAll('[data-use-item]').forEach((button) => button.addEventListener('click', () => useItem(button.dataset.useItem)));
    root.querySelectorAll('[data-place-item]').forEach((button) => button.addEventListener('click', () => startBuild(button.dataset.placeItem)));
    root.querySelectorAll('[data-move-uid]').forEach((button) => button.addEventListener('click', () => moveFurniture(Number(button.dataset.moveUid))));
    root.querySelectorAll('[data-store-uid]').forEach((button) => button.addEventListener('click', () => storeFurniture(Number(button.dataset.storeUid))));
    root.querySelector('[data-action="decorate"]')?.addEventListener('click', () => openPhone('inventory'));
    root.querySelector('[data-action="remodel-wall"]')?.addEventListener('click', () => openRemodel('wallpaper'));
    root.querySelector('[data-action="remodel-floor"]')?.addEventListener('click', () => openRemodel('flooring'));
    root.querySelectorAll('[data-donate]').forEach((button) => button.addEventListener('click', () => donateProject(button.dataset.donate)));
    root.querySelectorAll('[data-buy-property]').forEach((button) => button.addEventListener('click', () => buyProperty(Number(button.dataset.buyProperty))));
    root.querySelectorAll('[data-slot]').forEach((button) => button.addEventListener('click', async () => {
      await saveGame('switch');
      await loadGame(Number(button.dataset.slot));
      openPhone('save');
      TV.showToast(`Loaded save slot ${activeSlot}.`, 2);
    }));
    root.querySelector('[data-action="save-now"]')?.addEventListener('click', () => saveGame('manual'));
    root.querySelector('[data-action="export"]')?.addEventListener('click', exportSave);
    root.querySelector('[data-action="import"]')?.addEventListener('click', importSave);
    root.querySelector('[data-action="reset"]')?.addEventListener('click', resetSlot);
    root.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.toggle;
      save.settings[key] = !save.settings[key];
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(save.settings));
      openPhone('save');
    }));
  }

  function updateSaveStatus() {
    document.querySelectorAll('.life-save-status').forEach((element) => { element.textContent = lastSavedLabel; });
  }

  // -------------------------------------------------------------------------
  // Economy, inventory, shops, needs, and skills.
  // -------------------------------------------------------------------------
  function addMoney(amount, reason = '') {
    const value = Math.max(0, Math.round(amount));
    save.player.money += value;
    save.player.stats.moneyEarned += value;
    if (reason) TV.showToast(`+$${value} · ${reason}`, 2.2);
    sfx('money');
    updateHUD();
  }

  function spendMoney(amount) {
    const value = Math.max(0, Math.round(amount));
    if (save.player.money < value) {
      TV.showToast(`You need $${value - save.player.money} more.`, 2);
      sfx('error');
      return false;
    }
    save.player.money -= value;
    save.player.stats.moneySpent += value;
    updateHUD();
    return true;
  }

  function addItem(itemId, quantity = 1) {
    save.player.inventory[itemId] = (save.player.inventory[itemId] || 0) + quantity;
  }

  function removeItem(itemId, quantity = 1) {
    const current = save.player.inventory[itemId] || 0;
    if (current < quantity) return false;
    save.player.inventory[itemId] = current - quantity;
    if (save.player.inventory[itemId] <= 0) delete save.player.inventory[itemId];
    return true;
  }

  function useItem(itemId) {
    const item = ITEM_DEFS[itemId];
    if (!item || item.type !== 'food' || !removeItem(itemId, 1)) return;
    save.player.needs.hunger = clampNeed(save.player.needs.hunger + (item.hunger || 0));
    save.player.needs.happiness = clampNeed(save.player.needs.happiness + (item.happiness || 0));
    save.player.needs.energy = clampNeed(save.player.needs.energy + (item.energy || 0));
    emitProgress('eat', 1);
    TV.showToast(`${item.icon} You enjoyed ${item.name}.`, 2);
    sfx('eat');
    openPhone('inventory');
    saveGame('item');
  }

  function openShop(kind) {
    const ids = kind === 'grocery'
      ? ['apple','sandwich','soup','berryCake','juice']
      : Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].type === 'furniture');
    const title = kind === 'grocery' ? 'Sunny General Store' : 'Happy Home Furnishings';
    const discount = currentEvent().id === 'market' ? 0.85 : 1;
    const overlay = modal(title, `
      ${discount < 1 ? '<div class="life-notice"><b>Saturday Market Sale!</b> Everything is 15% off today.</div>' : ''}
      <div class="life-grid">${ids.map((id) => {
        const item = ITEM_DEFS[id];
        const price = Math.ceil(item.price * discount);
        return `<article class="life-card"><div class="item-icon">${item.icon}</div><h3>${item.name}</h3><p>${item.description}</p><div class="spacer"></div><div class="life-card-meta"><span>${item.type === 'furniture' ? 'HOME ITEM' : 'FOOD'}</span><b>$${price}</b></div><button class="life-button" data-buy-item="${id}" data-price="${price}">BUY</button></article>`;
      }).join('')}</div>`, { wide: true });
    overlay.querySelectorAll('[data-buy-item]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.buyItem;
      const price = Number(button.dataset.price);
      if (!spendMoney(price)) return;
      addItem(id, 1);
      save.player.stats.itemsBought++;
      emitProgress('buy', 1, { itemId: id });
      TV.showToast(`${ITEM_DEFS[id].icon} ${ITEM_DEFS[id].name} added to your bag.`, 2.2);
      sfx('buy');
      saveGame('purchase');
    }));
  }

  function xpForNext(level) { return 35 + level * 25; }

  function gainSkill(id, amount) {
    const skill = save.player.skills[id];
    if (!skill || skill.level >= 10) return;
    skill.xp += Math.round(amount);
    let leveled = false;
    while (skill.level < 10 && skill.xp >= xpForNext(skill.level)) {
      skill.xp -= xpForNext(skill.level);
      skill.level++;
      leveled = true;
    }
    if (leveled) {
      TV.showToast(`${SKILL_DEFS[id].icon} ${SKILL_DEFS[id].name} reached level ${skill.level}!`, 3);
      sfx('level');
    }
  }

  function skillDescription(id, level) {
    const descriptions = {
      cooking: 'Improves cafe pay and home meal strength.', gardening: 'Improves park work and future crops.', fishing: 'Improves catches at the pond.', fitness: 'Improves sprint endurance and physical job pay.', creativity: 'Unlocks decor colors and art activities.', handiness: 'Reduces remodeling costs.', charisma: 'Improves relationships and tips.', business: 'Improves job bonuses and future shop ownership.', music: 'Improves street performance rewards.', photography: 'Improves town photo task rewards.'
    };
    return `${descriptions[id]} Current bonus: ${Math.max(0,level-1) * 5}%.`;
  }

  function clampNeed(value) { return Math.max(0, Math.min(100, value)); }

  function updateNeeds(gameMinutes) {
    const multiplier = save.settings.relaxedNeeds ? 0.25 : 1;
    const needs = save.player.needs;
    needs.energy = clampNeed(needs.energy - gameMinutes * 0.018 * multiplier);
    needs.hunger = clampNeed(needs.hunger - gameMinutes * 0.029 * multiplier);
    needs.hygiene = clampNeed(needs.hygiene - gameMinutes * 0.017 * multiplier);
    needs.happiness = clampNeed(needs.happiness - gameMinutes * 0.009 * multiplier);
    if (needs.hunger < 12 || needs.energy < 10) TV.state.stamina = Math.min(TV.state.stamina, 0.55);
  }

  function sleepAtHome() {
    if (TV.state.area !== 'home') return;
    const oldDay = save.world.day;
    if (save.world.minutes < 8 * 60) {
      save.world.minutes = 8 * 60;
    } else {
      save.world.day++;
      save.world.minutes = 8 * 60;
    }
    if (save.world.day !== oldDay) onNewDay();
    save.player.needs.energy = 100;
    save.player.needs.happiness = clampNeed(save.player.needs.happiness + 8);
    gainSkill('fitness', 2);
    TV.showToast('You slept until 8:00 AM. Energy restored!', 3);
    sfx('sleep');
    saveGame('sleep');
  }

  function showerAtHome() {
    save.player.needs.hygiene = 100;
    save.player.needs.happiness = clampNeed(save.player.needs.happiness + 3);
    TV.showToast('Sparkling clean! Hygiene restored.', 2.2);
    sfx('water');
    saveGame('shower');
  }

  function cookAtHome() {
    if ((save.player.inventory.apple || 0) < 1) {
      TV.showToast('You need an apple from the general store.', 2.2);
      return;
    }
    removeItem('apple', 1);
    addItem('soup', 1);
    gainSkill('cooking', 12);
    TV.showToast('You cooked Sunshine Soup and packed it in your bag.', 2.7);
    sfx('cook');
    saveGame('cook');
  }

  // -------------------------------------------------------------------------
  // Home furniture and remodeling.
  // -------------------------------------------------------------------------
  function makeBox(parent, x, y, z, sx, sy, sz, material, outline = true) {
    const mesh = outline ? TV.outlinedMesh(TV.unitBox, material, 1.035) : new THREE.Mesh(TV.unitBox, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  function createFurnitureMesh(itemId, ghost = false) {
    const g = new THREE.Group();
    const m = TV.materials;
    const accent = { chairBlue: m.blue, tableSunny: m.wood, sofaPink: m.pink, bedCloud: m.blue, floorLamp: m.yellow, bookshelf: m.wood, pottedPlant: m.green, rainbowRug: m.purple, studyDesk: m.wood, toonTV: m.dark, dresser: m.wood, fridge: m.teal, oven: m.red, shower: m.glass, musicBox: m.purple }[itemId] || m.orange;

    if (itemId === 'chairBlue') {
      makeBox(g, 0, .72, 0, 1.3, .25, 1.25, accent);
      makeBox(g, 0, 1.55, -.5, 1.3, 1.55, .22, accent);
      for (const x of [-.48,.48]) for (const z of [-.42,.42]) makeBox(g,x,.34,z,.18,.7,.18,m.dark,false);
    } else if (itemId === 'tableSunny' || itemId === 'studyDesk') {
      makeBox(g,0,1.25,0,itemId === 'studyDesk' ? 2.8 : 2.5,.28,1.4,accent);
      for (const x of [-1,1]) for (const z of [-.48,.48]) makeBox(g,x,.6,z,.18,1.2,.18,m.dark,false);
      if (itemId === 'studyDesk') makeBox(g, .85,.62,0,.65,.95,1.18,m.blue);
    } else if (itemId === 'sofaPink') {
      makeBox(g,0,.65,0,3.2,.65,1.45,accent);
      makeBox(g,0,1.45,-.58,3.2,1.25,.3,accent);
      makeBox(g,-1.55,1.0,0,.38,.95,1.55,accent);
      makeBox(g,1.55,1.0,0,.38,.95,1.55,accent);
    } else if (itemId === 'bedCloud') {
      makeBox(g,0,.35,0,3.0,.55,4.2,m.wood);
      makeBox(g,0,.78,0,2.8,.55,4.0,m.white);
      makeBox(g,0,1.2,-1.75,2.8,1.8,.25,accent);
      makeBox(g,-.7,1.08,-1.2,1.15,.25,.8,m.cream);
      makeBox(g,.7,1.08,-1.2,1.15,.25,.8,m.cream);
    } else if (itemId === 'floorLamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.11,.15,2.8,6),m.dark); pole.position.y=1.4; g.add(pole);
      const shade = TV.outlinedMesh(new THREE.ConeGeometry(.72,1.0,8,1,true),accent,1.04); shade.position.y=2.9; shade.rotation.x=Math.PI; g.add(shade);
    } else if (itemId === 'bookshelf') {
      makeBox(g,0,1.55,0,2.4,3.1,.55,accent);
      for (const y of [.55,1.35,2.15]) makeBox(g,0,y,.35,2.2,.14,.42,m.dark,false);
      const bookColors=[m.red,m.blue,m.yellow,m.green,m.purple];
      for(let row=0;row<3;row++) for(let i=0;i<5;i++) makeBox(g,-.82+i*.4,.78+row*.8,.42,.28,.62,.18,bookColors[(row+i)%bookColors.length],false);
    } else if (itemId === 'pottedPlant') {
      const pot = TV.outlinedMesh(new THREE.CylinderGeometry(.58,.42,.75,8),m.orange,1.04); pot.position.y=.38; g.add(pot);
      for (const [x,z,s] of [[0,0,1],[-.35,.1,.8],[.35,.05,.85],[0,.35,.75]]) { const leaf=TV.outlinedMesh(new THREE.IcosahedronGeometry(.55,0),m.green,1.04); leaf.position.set(x,1.1+s*.25,z); leaf.scale.set(.65,1.2,.55); g.add(leaf); }
    } else if (itemId === 'rainbowRug') {
      const rug=TV.outlinedMesh(new THREE.CylinderGeometry(2.3,2.3,.08,18),accent,1.02); rug.position.y=.06; rug.scale.z=.65; g.add(rug);
      const stripe=new THREE.Mesh(new THREE.TorusGeometry(1.25,.22,6,18,Math.PI),m.yellow); stripe.rotation.x=Math.PI/2; stripe.position.y=.12; g.add(stripe);
    } else if (itemId === 'toonTV') {
      makeBox(g,0,1.55,0,2.8,1.85,.45,m.dark);
      makeBox(g,0,1.58,.25,2.35,1.35,.12,m.blue,false);
      makeBox(g,0,.48,0,1.5,.75,.7,m.wood);
      const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.0,5),m.dark); antenna.position.set(-.35,2.75,0); antenna.rotation.z=-.45; g.add(antenna); const antenna2=antenna.clone(); antenna2.position.x=.35; antenna2.rotation.z=.45; g.add(antenna2);
    } else if (itemId === 'dresser') {
      makeBox(g,0,1.2,0,2.8,2.4,1.25,accent);
      for (const y of [.52,1.18,1.84]) { makeBox(g,0,y,.66,2.45,.5,.12,m.cream,false); const knob=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),m.dark); knob.position.set(0,y,.78); g.add(knob); }
    } else if (itemId === 'fridge') {
      makeBox(g,0,1.75,0,1.8,3.5,1.65,accent);
      makeBox(g,.58,2.25,.86,.12,.95,.12,m.dark,false);
      makeBox(g,.58,.95,.86,.12,.75,.12,m.dark,false);
      makeBox(g,0,1.55,.88,1.55,.08,.06,m.dark,false);
    } else if (itemId === 'oven') {
      makeBox(g,0,1.15,0,2.05,2.3,1.65,accent);
      makeBox(g,0,1.0,.86,1.55,1.05,.08,m.dark,false);
      makeBox(g,0,2.05,.86,1.8,.28,.08,m.white,false);
      for(const x of [-.62,-.2,.2,.62]) { const knob=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.1,8),m.dark); knob.rotation.x=Math.PI/2; knob.position.set(x,2.05,.97); g.add(knob); }
    } else if (itemId === 'shower') {
      makeBox(g,0,.12,0,2.2,.22,2.2,m.white);
      makeBox(g,-1.0,1.75,0,.12,3.5,2.2,m.glass,false);
      makeBox(g,0,1.75,-1.0,2.2,3.5,.12,m.glass,false);
      const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,2.6,6),m.dark); pipe.position.set(.7,2.0,-.75); g.add(pipe);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.25,7,5),m.dark); head.position.set(.7,3.2,-.75); g.add(head);
    } else if (itemId === 'musicBox') {
      makeBox(g,0,.65,0,1.8,1.3,1.1,accent);
      makeBox(g,0,1.45,-.25,1.55,.22,.65,m.yellow);
      const note=TV.outlinedMesh(new THREE.SphereGeometry(.22,7,5),m.white,1.05); note.position.set(.35,1.8,0); g.add(note);
    } else {
      makeBox(g,0,.5,0,1,1,1,accent);
    }

    g.userData.itemId = itemId;
    if (ghost) {
      g.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.material = obj.material.clone();
        obj.material.transparent = true;
        obj.material.opacity = .56;
        obj.material.depthWrite = false;
      });
    }
    return g;
  }

  function rebuildHomeFurniture() {
    if (!homeFurnitureRoot) {
      homeFurnitureRoot = new THREE.Group();
      homeFurnitureRoot.name = 'player-home-furniture';
      TV.interiorGroups.home.add(homeFurnitureRoot);
    }
    while (homeFurnitureRoot.children.length) homeFurnitureRoot.remove(homeFurnitureRoot.children[0]);
    furnitureObjects.clear();
    for (const placement of save.property.furniture) {
      const object = createFurnitureMesh(placement.itemId, false);
      object.position.set(TV.areaBounds.home.cx + placement.x, 0, TV.areaBounds.home.cz + placement.z);
      object.rotation.y = placement.rotation || 0;
      homeFurnitureRoot.add(object);
      furnitureObjects.set(placement.uid, object);
    }
    applyHomeStyle();
  }

  function startBuild(itemId, movingUid = null) {
    if (TV.state.area !== 'home') {
      TV.showToast('Go home before decorating.', 2);
      return;
    }
    if (!movingUid && (save.player.inventory[itemId] || 0) < 1) return;
    const tier = PROPERTY_TIERS[save.property.tier];
    if (!movingUid && save.property.furniture.length >= tier.capacity) {
      TV.showToast('Your current home is full. Upgrade it at City Hall.', 2.5);
      return;
    }
    closeModal(false);
    const existing = movingUid ? save.property.furniture.find((f) => f.uid === movingUid) : null;
    const ghost = createFurnitureMesh(itemId, true);
    const startX = existing ? existing.x : 0;
    const startZ = existing ? existing.z : 0;
    ghost.position.set(TV.areaBounds.home.cx + startX, .03, TV.areaBounds.home.cz + startZ);
    ghost.rotation.y = existing?.rotation || 0;
    TV.interiorGroups.home.add(ghost);
    buildMode = { itemId, movingUid, ghost, x: startX, z: startZ, rotation: existing?.rotation || 0 };
    TV.setModalOpen(true);
    document.getElementById('mobile-controls')?.classList.add('hidden');
    renderBuildControls();
    TV.showToast('Move, rotate, then place your furniture.', 2.4);
    sfx('open');
  }

  function renderBuildControls() {
    document.getElementById('build-controls')?.remove();
    const item = ITEM_DEFS[buildMode.itemId];
    const panel = document.createElement('div');
    panel.id = 'build-controls';
    panel.innerHTML = `<div class="build-head"><b>🔨 ${item.icon} ${item.name}</b><small>Keyboard: arrows/WASD · R rotate · Enter place · Esc cancel</small></div>
      <div class="build-buttons">
        <button data-build="left">←</button><button data-build="forward">↑</button><button data-build="back">↓</button><button data-build="right">→</button>
        <button data-build="rotate">↻ ROTATE</button><button class="place" data-build="place">✓ PLACE</button><button class="cancel" data-build="cancel">✕ CANCEL</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-build]').forEach((button) => button.addEventListener('click', () => buildAction(button.dataset.build)));
  }

  function buildAction(action) {
    if (!buildMode) return;
    const step = 0.75;
    if (action === 'left') buildMode.x -= step;
    if (action === 'right') buildMode.x += step;
    if (action === 'forward') buildMode.z -= step;
    if (action === 'back') buildMode.z += step;
    if (action === 'rotate') buildMode.rotation += Math.PI / 2;
    if (action === 'place') return finishBuild();
    if (action === 'cancel') return cancelBuild();
    const b = TV.areaBounds.home;
    buildMode.x = Math.max(-b.halfW + 1.5, Math.min(b.halfW - 1.5, buildMode.x));
    buildMode.z = Math.max(-b.halfD + 1.5, Math.min(b.halfD - 2.2, buildMode.z));
    buildMode.ghost.position.set(b.cx + buildMode.x, .03, b.cz + buildMode.z);
    buildMode.ghost.rotation.y = buildMode.rotation;
    sfx('tick');
  }

  function finishBuild() {
    if (!buildMode) return;
    const { itemId, movingUid, x, z, rotation, ghost } = buildMode;
    TV.interiorGroups.home.remove(ghost);
    if (movingUid) {
      const placement = save.property.furniture.find((f) => f.uid === movingUid);
      if (placement) Object.assign(placement, { x, z, rotation });
    } else {
      if (!removeItem(itemId, 1)) return cancelBuild();
      save.property.furniture.push({ uid: save.property.nextFurnitureUid++, itemId, x, z, rotation });
      save.player.stats.furniturePlaced++;
      emitProgress('place', 1, { itemId });
    }
    buildMode = null;
    document.getElementById('build-controls')?.remove();
    TV.setModalOpen(false);
    if (TV.DEVICE.touch) document.getElementById('mobile-controls')?.classList.remove('hidden');
    rebuildHomeFurniture();
    TV.showToast(`${ITEM_DEFS[itemId].name} placed!`, 2);
    sfx('place');
    saveGame('decorate');
  }

  function cancelBuild() {
    if (!buildMode) return;
    TV.interiorGroups.home.remove(buildMode.ghost);
    buildMode = null;
    document.getElementById('build-controls')?.remove();
    TV.setModalOpen(false);
    if (TV.DEVICE.touch) document.getElementById('mobile-controls')?.classList.remove('hidden');
    TV.showToast('Placement cancelled.', 1.4);
  }

  function moveFurniture(uid) {
    const placement = save.property.furniture.find((f) => f.uid === uid);
    if (placement) startBuild(placement.itemId, uid);
  }

  function storeFurniture(uid) {
    const index = save.property.furniture.findIndex((f) => f.uid === uid);
    if (index < 0) return;
    const [placement] = save.property.furniture.splice(index, 1);
    addItem(placement.itemId, 1);
    rebuildHomeFurniture();
    saveGame('store-furniture');
    openPhone('home');
  }

  function openRemodel(type) {
    const options = type === 'wallpaper'
      ? [['cream','Warm Cream','#fff0c9'],['sky','Clear Sky','#ccecff'],['mint','Mint Pop','#d7f2d1'],['rose','Rose Candy','#ffd7e7'],['lavender','Moon Lavender','#e4dbff']]
      : [['maple','Maple Boards','#d8b887'],['honey','Honey Oak','#e9c66d'],['teal','Teal Tile','#85d4cd'],['cloud','Cloud Tile','#e8eef0'],['berry','Berry Carpet','#ca86a8']];
    const overlay = modal(type === 'wallpaper' ? 'Choose Wallpaper' : 'Choose Flooring', `<div class="life-grid">${options.map(([id,name,color]) => `<article class="life-card"><div class="item-icon" style="background:${color}">🎨</div><h3>${name}</h3><p>Remodel cost: $${remodelCost()}</p><div class="spacer"></div><button class="life-button" data-style="${id}">INSTALL</button></article>`).join('')}</div>`);
    overlay.querySelectorAll('[data-style]').forEach((button) => button.addEventListener('click', () => {
      const cost = remodelCost();
      if (!spendMoney(cost)) return;
      save.property[type] = button.dataset.style;
      gainSkill('handiness', 5);
      applyHomeStyle();
      saveGame('remodel');
      TV.showToast('Home remodel complete!', 2);
      openPhone('home');
    }));
  }

  function remodelCost() {
    const discount = 1 - (save.player.skills.handiness.level - 1) * .035;
    return Math.max(80, Math.round((180 + save.property.tier * 120) * discount));
  }

  let styleRoot = null;
  function applyHomeStyle() {
    if (styleRoot) TV.interiorGroups.home.remove(styleRoot);
    styleRoot = new THREE.Group();
    const b = TV.areaBounds.home;
    const wallColors = { cream:0xfff0c9, sky:0xccecff, mint:0xd7f2d1, rose:0xffd7e7, lavender:0xe4dbff };
    const floorColors = { maple:0xd8b887, honey:0xe9c66d, teal:0x85d4cd, cloud:0xe8eef0, berry:0xca86a8 };
    const floor = new THREE.Mesh(TV.unitBox, TV.mat(floorColors[save.property.flooring] || floorColors.maple));
    floor.position.set(b.cx, .015, b.cz); floor.scale.set(b.halfW*2-.5,.03,b.halfD*2-.5); styleRoot.add(floor);
    const wallMat = TV.mat(wallColors[save.property.wallpaper] || wallColors.cream);
    const panels = [
      [b.cx,3.3,b.cz-b.halfD+.08,b.halfW*2-.5,6.5,.08],
      [b.cx-b.halfW+.08,3.3,b.cz,.08,6.5,b.halfD*2-.5],
      [b.cx+b.halfW-.08,3.3,b.cz,.08,6.5,b.halfD*2-.5]
    ];
    for (const [x,y,z,sx,sy,sz] of panels) { const panel=new THREE.Mesh(TV.unitBox,wallMat); panel.position.set(x,y,z); panel.scale.set(sx,sy,sz); styleRoot.add(panel); }
    TV.interiorGroups.home.add(styleRoot);
    updateHomeTierVisuals();
  }

  let tierVisualRoot = null;
  function updateHomeTierVisuals() {
    if (tierVisualRoot) TV.interiorGroups.home.remove(tierVisualRoot);
    tierVisualRoot = new THREE.Group();
    const b = TV.areaBounds.home;
    if (save.property.tier >= 1) {
      const arch = TV.outlinedMesh(new THREE.TorusGeometry(2.2,.25,6,12,Math.PI),TV.materials.wood,1.04); arch.rotation.x=Math.PI/2; arch.position.set(b.cx-5,2.4,b.cz-1.5); tierVisualRoot.add(arch);
    }
    if (save.property.tier >= 2) {
      const divider=TV.outlinedMesh(TV.unitBox,TV.materials.cream,1.02); divider.position.set(b.cx+4,1.5,b.cz+1.5); divider.scale.set(.3,3,5.5); tierVisualRoot.add(divider);
    }
    if (save.property.tier >= 3) {
      const chandelier=new THREE.Group(); const stem=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,1.3,6),TV.materials.dark); stem.position.y=6.5; chandelier.add(stem); const light=TV.outlinedMesh(new THREE.IcosahedronGeometry(.65,1),TV.materials.yellow,1.05); light.position.y=5.7; chandelier.add(light); chandelier.position.x=b.cx; chandelier.position.z=b.cz; tierVisualRoot.add(chandelier);
    }
    TV.interiorGroups.home.add(tierVisualRoot);
    TV.setAreaName('home', PROPERTY_TIERS[save.property.tier].name.toUpperCase());
  }

  function buyProperty(tierIndex) {
    if (tierIndex !== save.property.tier + 1) return;
    const tier = PROPERTY_TIERS[tierIndex];
    if (!spendMoney(tier.price)) return;
    save.property.tier = tierIndex;
    gainSkill('business', 18);
    updateHomeTierVisuals();
    emitProgress('property', 1);
    TV.showToast(`🏠 You now own the ${tier.name}!`, 3.5);
    sfx('level');
    saveGame('property');
    openPhone('town');
  }

  // -------------------------------------------------------------------------
  // Jobs and physical objectives.
  // -------------------------------------------------------------------------
  function openJobs() {
    const jobs = [
      { id:'cafe', icon:'☕', name:'Cafe Rush', pay:'$90–$220', description:'Match six customer orders before the timer ends.' },
      { id:'cleanup', icon:'🧹', name:'Park Cleanup', pay:'$145', description:'Find and collect five messy piles around Sunshine Park.' },
      { id:'delivery', icon:'📦', name:'Parcel Delivery', pay:'$180', description:'Carry three parcels to marked addresses around town.' },
      { id:'music', icon:'🎵', name:'Street Performer', pay:'$80–$240', description:'Hit the beat in a quick town-square rhythm challenge.' }
    ];
    const overlay = modal('Toon Valley Job Board', `<div class="life-grid">${jobs.map((job) => `<article class="life-card"><div class="item-icon">${job.icon}</div><h3>${job.name}</h3><p>${job.description}</p><div class="spacer"></div><div class="life-card-meta"><span>SHORT SHIFT</span><b>${job.pay}</b></div><button class="life-button green" data-job="${job.id}" ${save.activeJob ? 'disabled' : ''}>START SHIFT</button></article>`).join('')}</div>`);
    overlay.querySelectorAll('[data-job]').forEach((button) => button.addEventListener('click', () => startJob(button.dataset.job)));
  }

  function startJob(id) {
    closeModal(false);
    if (save.activeJob) {
      TV.showToast('Finish your current job first.', 2);
      return;
    }
    if (id === 'cafe') return startCafeGame();
    if (id === 'music') return startMusicGame();
    if (id === 'cleanup') return startCleanupJob();
    if (id === 'delivery') return startDeliveryJob();
  }

  function startCafeGame() {
    save.activeJob = { id:'cafe', score:0, total:6 };
    const orders = [
      { icon:'☕', label:'Coffee' }, { icon:'🧇', label:'Waffle' }, { icon:'🥪', label:'Sandwich' }
    ];
    let round = 0;
    let score = 0;
    let seconds = 30;
    const overlay = modal('Cafe Rush', `<div id="job-game"><div class="life-row"><b>Orders completed: <span id="job-score">0</span>/6</b><span class="job-timer" id="job-timer">30s</span></div><div class="job-order"><div><div class="emoji" id="order-icon">☕</div><h2 id="order-label">Coffee</h2></div></div><div class="job-choices">${orders.map((o) => `<button class="life-button job-choice" data-choice="${o.label}">${o.icon}</button>`).join('')}</div></div>`, { dismissible:false });
    const chooseOrder = () => orders[Math.floor(Math.random()*orders.length)];
    let current = chooseOrder();
    const renderOrder = () => { overlay.querySelector('#order-icon').textContent=current.icon; overlay.querySelector('#order-label').textContent=current.label; overlay.querySelector('#job-score').textContent=score; };
    renderOrder();
    overlay.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.choice === current.label) { score++; round++; gainSkill('cooking',5); sfx('good'); }
      else { seconds=Math.max(0,seconds-3); sfx('error'); }
      if (round >= 6) return finishCafeJob(score,seconds);
      current=chooseOrder(); renderOrder();
    }));
    const interval=setInterval(() => {
      if (!document.body.contains(overlay)) return clearInterval(interval);
      seconds--;
      overlay.querySelector('#job-timer').textContent=`${seconds}s`;
      if (seconds <= 0) { clearInterval(interval); finishCafeJob(score,0); }
    },1000);
    jobRuntime={ interval };
  }

  function finishCafeJob(score, timeLeft) {
    if (jobRuntime?.interval) clearInterval(jobRuntime.interval);
    jobRuntime=null;
    closeModal(false);
    const pay=60+score*23+Math.max(0,timeLeft)*2;
    addMoney(pay,'Cafe shift');
    gainSkill('charisma',score*3);
    finishJobCommon('cafe');
  }

  function startMusicGame() {
    save.activeJob={id:'music',score:0,total:10};
    let beat=0, score=0, position=0, direction=1;
    const overlay=modal('Street Performance', `<div id="job-game"><div class="life-notice">Tap HIT while the moving note is inside the green center zone.</div><div class="life-progress" style="height:35px;position:relative"><span style="position:absolute;left:42%;width:16%;background:#61d36e"></span><i id="music-marker" style="position:absolute;top:2px;left:0;width:25px;height:27px;border-radius:50%;background:#9c78d6;border:3px solid #16212a"></i></div><div class="life-row"><b>Beat <span id="beat-count">1</span>/10</b><b>Score <span id="music-score">0</span></b></div><button class="life-button blue" id="hit-beat" style="width:100%;min-height:72px;font-size:24px">🎵 HIT THE BEAT</button></div>`,{dismissible:false});
    const marker=overlay.querySelector('#music-marker');
    let last=performance.now();
    const animate=(now) => {
      if (!document.body.contains(overlay)) return;
      const dt=Math.min(.04,(now-last)/1000); last=now;
      position += direction*dt*1.15;
      if(position>=1){position=1;direction=-1;} if(position<=0){position=0;direction=1;}
      marker.style.left=`calc(${position*100}% - 12px)`;
      jobRuntime.raf=requestAnimationFrame(animate);
    };
    jobRuntime={raf:requestAnimationFrame(animate)};
    overlay.querySelector('#hit-beat').addEventListener('click',()=>{
      const quality=Math.max(0,1-Math.abs(position-.5)*4);
      const points=Math.round(quality*100);
      score+=points; beat++;
      gainSkill('music',4+Math.round(quality*5));
      sfx(points>60?'good':'tick');
      overlay.querySelector('#music-score').textContent=score;
      if(beat>=10) return finishMusicJob(score);
      overlay.querySelector('#beat-count').textContent=beat+1;
      position=Math.random()*.25; direction=1;
    });
  }

  function finishMusicJob(score) {
    if(jobRuntime?.raf) cancelAnimationFrame(jobRuntime.raf); jobRuntime=null;
    closeModal(false);
    const pay=80+Math.round(score*.16);
    addMoney(pay,'Street performance tips');
    save.player.needs.happiness=clampNeed(save.player.needs.happiness+12);
    finishJobCommon('music');
  }

  function clearJobWorldObjects() {
    for(const entry of jobWorldObjects){ if(entry.object?.parent) entry.object.parent.remove(entry.object); entry.interaction.enabled=()=>false; }
    jobWorldObjects.length=0;
  }

  function startCleanupJob() {
    save.activeJob={id:'cleanup',progress:0,total:5};
    const spots=[[-70,35],[-82,48],[-65,56],[-88,38],[-74,62]];
    spots.forEach((spot,index)=>{
      const object=new THREE.Group();
      const bag=TV.outlinedMesh(new THREE.DodecahedronGeometry(.42,0),TV.materials.rock,1.05); bag.position.y=.42; object.add(bag);
      const can=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.55,6),TV.materials.red); can.position.set(.45,.28,.1); can.rotation.z=.45; object.add(can);
      object.position.set(spot[0],TV.terrainHeight(spot[0],spot[1]),spot[1]); TV.scene.add(object);
      let collected=false;
      const interaction=TV.registerInteraction({object,radius:2.3,prompt:'Pick up litter',text:'',area:'world',enabled:()=>!collected&&save.activeJob?.id==='cleanup',action:()=>{
        if(collected)return; collected=true; object.visible=false; save.activeJob.progress++; gainSkill('gardening',5); emitProgress('clean',1); sfx('good');
        if(save.activeJob.progress>=5){ addMoney(145,'Park cleanup'); save.player.needs.happiness=clampNeed(save.player.needs.happiness+8); finishJobCommon('cleanup'); clearJobWorldObjects(); }
        else TV.showToast(`Park cleanup: ${save.activeJob.progress}/5`,1.6);
      }});
      jobWorldObjects.push({object,interaction});
    });
    TV.showToast('🧹 Find five litter piles around Sunshine Park.',3);
    closeModal(false);
  }

  function startDeliveryJob() {
    save.activeJob={id:'delivery',progress:0,total:3};
    const stops=[{x:49,z:-20,name:'Post Office'},{x:-49,z:-20,name:'Fire Station'},{x:64,z:55,name:'Hilltop Apartments'}];
    stops.forEach((stop,index)=>{
      const object=new THREE.Group();
      const box=TV.outlinedMesh(TV.unitBox,TV.materials.orange,1.04); box.position.y=.55; box.scale.set(.9,.9,.9); object.add(box);
      const bow=new THREE.Mesh(TV.unitBox,TV.materials.yellow); bow.position.y=.58; bow.scale.set(.18,1.0,1.0); object.add(bow);
      object.position.set(stop.x,TV.terrainHeight(stop.x,stop.z),stop.z); TV.scene.add(object);
      const interaction=TV.registerInteraction({object,radius:3,prompt:`Deliver to ${stop.name}`,area:'world',enabled:()=>save.activeJob?.id==='delivery'&&save.activeJob.progress===index,action:()=>{
        object.visible=false; save.activeJob.progress++; gainSkill('fitness',6); sfx('good');
        if(save.activeJob.progress>=3){ addMoney(180,'Parcel route'); finishJobCommon('delivery'); clearJobWorldObjects(); }
        else TV.showToast(`Parcel delivered! Next stop: ${stops[index+1].name}.`,2.5);
      }});
      jobWorldObjects.push({object,interaction});
    });
    TV.showToast('📦 First delivery: Post Office.',3);
  }

  function finishJobCommon(id) {
    save.player.stats.jobsCompleted++;
    save.player.jobHistory[id]=(save.player.jobHistory[id]||0)+1;
    save.activeJob=null;
    emitProgress('work',1,{job:id});
    gainSkill('business',5);
    save.player.needs.energy=clampNeed(save.player.needs.energy-8);
    save.player.needs.hunger=clampNeed(save.player.needs.hunger-6);
    saveGame('job');
    updateHUD();
  }

  // -------------------------------------------------------------------------
  // Quests, daily tasks, relationships, and NPC dialogue.
  // -------------------------------------------------------------------------
  function ensureDailyTasks() {
    if (save.quests.dailyDay === save.world.day && save.quests.daily.length) return;
    const pool=[
      {id:'talk',icon:'💬',title:'Friendly Neighbor',description:'Talk to 3 residents.',goal:3,reward:75},
      {id:'buy',icon:'🛍️',title:'Support Local Shops',description:'Buy 2 items in town.',goal:2,reward:65},
      {id:'work',icon:'💼',title:'Honest Day’s Work',description:'Complete 1 job shift.',goal:1,reward:110},
      {id:'eat',icon:'🍎',title:'Snack Break',description:'Eat or drink 2 items.',goal:2,reward:45},
      {id:'clean',icon:'🧹',title:'Keep It Tidy',description:'Collect 3 park litter piles.',goal:3,reward:70},
      {id:'place',icon:'🛋️',title:'Fresh Arrangement',description:'Place 1 furniture item.',goal:1,reward:60}
    ];
    const start=(save.world.day*2)%pool.length;
    save.quests.daily=[0,1,2].map((i)=>({...pool[(start+i)%pool.length],progress:0,done:false}));
    save.quests.dailyDay=save.world.day;
  }

  function emitProgress(type, amount=1, data={}) {
    ensureDailyTasks();
    for(const task of save.quests.daily){
      if(task.done||task.id!==type)continue;
      task.progress=Math.min(task.goal,task.progress+amount);
      if(task.progress>=task.goal){ task.done=true; addMoney(task.reward,`Daily task: ${task.title}`); }
    }
    updateStoryProgress(type,data);
    updateObjective();
  }

  function storyObjective() {
    const steps=[
      {title:'Welcome to Toon Valley',text:'Talk to Mayor Maya near City Hall.',type:'talk-maya',goal:1,reward:'Reward: $150',progressText:`${save.quests.storyProgress}/1`},
      {title:'A Place of Your Own',text:'Visit Maple Apartments and enter your Sunbeam Studio.',type:'enter-home',goal:1,reward:'Reward: 2 apples',progressText:`${save.quests.storyProgress}/1`},
      {title:'Make It Yours',text:'Buy or use a furniture item and place it in your studio.',type:'place',goal:1,reward:'Reward: $250',progressText:`${save.quests.storyProgress}/1`},
      {title:'First Payday',text:'Complete any job from the City Hall job board.',type:'work',goal:1,reward:'Reward: $300',progressText:`${save.quests.storyProgress}/1`},
      {title:'Home Sweet Home',text:'Save $2,500 and buy the Starter Cottage property upgrade.',type:'property',goal:1,reward:'Reward: Rainbow Rug',progressText:`${save.quests.storyProgress}/1`},
      {title:'Community Builder',text:'Donate at least $500 total to town projects.',type:'donate',goal:5,reward:'Reward: $500',progressText:`${save.quests.storyProgress}/5`},
      {title:'Valley Citizen',text:'Reach Friend status with any resident.',type:'friend',goal:1,reward:'Reward: Music Box',progressText:`${save.quests.storyProgress}/1`},
      {title:'Toon Valley Life',text:'You completed the opening story. Keep building your home, career, friendships, and town.',type:'complete',goal:1,reward:'Opening chapter complete',progressText:'✓'}
    ];
    const step=steps[Math.min(save.quests.storyStep,steps.length-1)];
    return {...step,percent:step.type==='complete'?100:(save.quests.storyProgress/step.goal*100)};
  }

  function updateStoryProgress(type,data={}) {
    const objective=storyObjective();
    let matches=false;
    if(objective.type==='talk-maya'&&type==='talk'&&data.name==='Maya')matches=true;
    else if(objective.type===type)matches=true;
    if(!matches)return;
    save.quests.storyProgress=Math.min(objective.goal,save.quests.storyProgress+1);
    if(save.quests.storyProgress>=objective.goal) completeStoryStep();
  }

  function completeStoryStep() {
    const step=save.quests.storyStep;
    const rewards=[()=>addMoney(150,'Welcome quest'),()=>addItem('apple',2),()=>addMoney(250,'Decorating quest'),()=>addMoney(300,'First Payday quest'),()=>addItem('rainbowRug',1),()=>addMoney(500,'Community Builder quest'),()=>addItem('musicBox',1)];
    rewards[step]?.();
    save.quests.completedStory.push(step);
    save.quests.storyStep++;
    save.quests.storyProgress=0;
    TV.showToast('⭐ Story objective complete!',3);
    sfx('level');
    saveGame('quest');
  }

  function updateObjective() {
    const objective=storyObjective();
    document.querySelector('#objective-card b').textContent=objective.title.toUpperCase();
    document.getElementById('objective-text').textContent=objective.text;
    document.getElementById('objective-progress').textContent=`${objective.progressText} · ${objective.reward}`;
    const ready=save.quests.daily.filter((task)=>task.done).length;
    const badge=document.getElementById('task-badge');
    badge.textContent=String(ready); badge.classList.toggle('hidden',ready===0);
  }

  function openNPC(npc) {
    const name=npc.userData.name;
    const score=save.player.relationships[name]||0;
    const stories=NPC_BACKSTORIES[name]||['A friendly Toon Valley resident.','They wave cheerfully.'];
    const canChat=(save.world.minutes-(save.player.lastTalk[name]??-999))>60 || save.player.lastTalk[name] > save.world.minutes;
    const overlay=modal(name, `<div class="life-two-col"><div><div class="item-icon" style="font-size:42px">${relationshipIcon(score)}</div><h3>${relationshipLabel(score)} · ${score}/100</h3><div class="life-progress"><span style="width:${score}%"></span></div><p>${escapeHTML(stories[0])}</p><p>${escapeHTML(stories[1])}</p></div><div><button class="life-button green" data-npc-action="chat" ${canChat?'':'disabled'} style="width:100%;margin-bottom:9px">💬 CHAT ${canChat?'':'(LATER)'}</button><button class="life-button blue" data-npc-action="gift" style="width:100%;margin-bottom:9px">🎁 GIVE FOOD GIFT</button><button class="life-button secondary" data-npc-action="advice" style="width:100%">🗺️ ASK ABOUT TOWN</button></div></div>`);
    overlay.querySelector('[data-npc-action="chat"]').addEventListener('click',()=>{
      if(!canChat)return;
      save.player.lastTalk[name]=save.world.minutes;
      changeRelationship(name,3+Math.floor(save.player.skills.charisma.level/3));
      save.player.stats.conversations++;
      gainSkill('charisma',6);
      emitProgress('talk',1,{name});
      TV.showToast(`${name}: “${npcDialogue(name)}”`,3.5);
      closeModal(false); saveGame('talk');
    });
    overlay.querySelector('[data-npc-action="gift"]').addEventListener('click',()=>openGiftMenu(name));
    overlay.querySelector('[data-npc-action="advice"]').addEventListener('click',()=>{
      TV.showToast(`${name}: “${townAdvice(name)}”`,4); closeModal(false);
    });
  }

  function openGiftMenu(name) {
    const food=Object.entries(save.player.inventory).filter(([id,count])=>count>0&&ITEM_DEFS[id]?.type==='food');
    if(!food.length){ TV.showToast('You have no food gifts in your bag.',2); return; }
    const overlay=modal(`Gift for ${name}`,`<div class="life-grid">${food.map(([id,count])=>{const item=ITEM_DEFS[id];return `<article class="life-card"><div class="item-icon">${item.icon}</div><h3>${item.name} ×${count}</h3><p>${item.description}</p><div class="spacer"></div><button class="life-button green" data-gift="${id}">GIVE</button></article>`}).join('')}</div>`);
    overlay.querySelectorAll('[data-gift]').forEach((button)=>button.addEventListener('click',()=>{
      const id=button.dataset.gift; if(!removeItem(id,1))return;
      const favorite=(name==='Maya'&&id==='berryCake')||(name==='Benny'&&id==='sandwich')||(name==='Cleo'&&id==='juice');
      changeRelationship(name,favorite?12:7); gainSkill('charisma',4); TV.showToast(`${name} ${favorite?'loved':'liked'} the ${ITEM_DEFS[id].name}!`,2.5); closeModal(false); saveGame('gift');
    }));
  }

  function changeRelationship(name,amount) {
    const before=save.player.relationships[name]||0;
    const after=Math.max(0,Math.min(100,before+amount)); save.player.relationships[name]=after;
    if(before<40&&after>=40)TV.showToast(`${name} is now your friend!`,2.5);
    if(before<40&&after>=40)emitProgress('friend',1,{name});
  }

  function relationshipLabel(score){ if(score>=85)return'Best Friend'; if(score>=65)return'Close Friend'; if(score>=40)return'Friend'; if(score>=15)return'Acquaintance'; return'Stranger'; }
  function relationshipIcon(score){ if(score>=85)return'💖'; if(score>=65)return'😊'; if(score>=40)return'🙂'; if(score>=15)return'👋'; return'😶'; }
  function npcDialogue(name){ const lines={Maya:'Every good town starts with someone willing to care about it.',Benny:'I invented a waffle with smaller waffles inside it.',Pip:'The fastest route is not always the one without geese.',Luna:'The moon looks especially round from the pond tonight.',Theo:'Measure twice, then ask Wren what you measured.',Milo:'The maple by the fountain grew a whole new leaf!',Nora:'A blank wall is just a mural that has not happened yet.',Jasper:'Life needs more curtains and at least one spotlight.',Ivy:'Rain is free watering. Best bargain in town.',Finn:'The clouds are posing beautifully today.',Rosie:'A rug can change a room. A good sofa can change a weekend.',Otis:'Safety first, chili second, everything else third.',Cleo:'The apples arrived this morning and they are extremely shiny.',Sam:'The town square has perfect evening acoustics.',Tilly:'I found a beetle with excellent manners.',Wren:'A town is just a very large house we all share.'}; return lines[name]||'Beautiful day in Toon Valley!'; }
  function townAdvice(name){ const lines=['The job board inside City Hall always has short shifts.','Happy Home Furnishings rotates a full catalog of useful home items.','Maple Apartments is your home base; use the bed, kitchen, and shower there.','Sunshine Park is west of the town center, beside the pond.','Community projects unlock visible improvements around town.','Saturday Market days give every shop a discount.']; return lines[(name.charCodeAt(0)+save.world.day)%lines.length]; }

  // -------------------------------------------------------------------------
  // Town projects, visuals, time, weather, and events.
  // -------------------------------------------------------------------------
  function donateProject(id) {
    const project=PROJECT_DEFS[id]; if(!project||save.world.completedProjects.includes(id))return;
    if(!spendMoney(100))return;
    save.world.projects[id]=Math.min(project.goal,(save.world.projects[id]||0)+100);
    gainSkill('business',3); emitProgress('donate',1,{project:id});
    if(save.world.projects[id]>=project.goal){ save.world.completedProjects.push(id); updateProjectVisuals(); TV.showToast(`${project.icon} ${project.name} completed!`,3.5); sfx('level'); }
    else TV.showToast(`Donated $100 to ${project.name}.`,1.8);
    saveGame('donation'); openPhone('town');
  }

  function createProjectVisuals() {
    // Gazebo in Sunshine Park.
    const gazebo=new THREE.Group();
    for(const [x,z] of [[-2,-2],[2,-2],[-2,2],[2,2]]){ const post=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,3.1,6),TV.materials.white); post.position.set(x,1.55,z); gazebo.add(post); }
    const roof=TV.outlinedMesh(new THREE.ConeGeometry(3.6,1.8,8),TV.materials.red,1.035); roof.position.y=3.8; gazebo.add(roof);
    const floor=TV.outlinedMesh(new THREE.CylinderGeometry(3.0,3.0,.3,12),TV.materials.wood,1.02); floor.position.y=.15; gazebo.add(floor);
    gazebo.position.set(-73,TV.terrainHeight(-73,51),51); TV.scene.add(gazebo); projectVisuals.park=gazebo;

    const bridge=new THREE.Group();
    for(let i=0;i<7;i++)makeBox(bridge,-3+i,0,0,.85,.22,2.5,TV.materials.wood);
    for(const x of [-3.5,3.5]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,1.6,6),TV.materials.dark);post.position.set(x,.8,0);bridge.add(post);}
    bridge.position.set(118,TV.terrainHeight(118,15)+.4,15); bridge.rotation.y=.3; TV.scene.add(bridge); projectVisuals.bridge=bridge;

    const stage=new THREE.Group(); makeBox(stage,0,.55,0,8,1.1,4,TV.materials.purple); makeBox(stage,0,3,-1.8,8,5,.3,TV.materials.red); for(const x of [-3,3]){const light=TV.outlinedMesh(new THREE.IcosahedronGeometry(.45,1),TV.materials.yellow,1.05);light.position.set(x,5,-1.5);stage.add(light);} stage.position.set(0,TV.terrainHeight(0,67),67); TV.scene.add(stage); projectVisuals.theater=stage;
    updateProjectVisuals();
  }

  function updateProjectVisuals(){ for(const [id,object] of Object.entries(projectVisuals))object.visible=save.world.completedProjects.includes(id); }

  function currentEvent(){
    if(save.world.day%7===0)return{id:'market',name:'Saturday Market',icon:'🛍️'};
    if(save.world.day%9===0)return{id:'festival',name:'Valley Festival',icon:'🎉'};
    if(save.world.day%5===0)return{id:'pet',name:'Pet Parade',icon:'🐶'};
    return{id:'normal',name:'A Regular Lovely Day',icon:'🌼'};
  }

  function onNewDay(){
    save.player.stats.daysPlayed++;
    save.world.weather=WEATHER[save.world.day%WEATHER.length];
    ensureDailyTasks();
    save.player.needs.happiness=clampNeed(save.player.needs.happiness+3);
    const event=currentEvent();
    TV.showToast(`DAY ${save.world.day} · ${event.icon} ${event.name}`,3.5);
    saveGame('new-day');
  }

  const rainGeometry=new THREE.BufferGeometry();
  const rainCount=TV.DEVICE.touch?90:150;
  const rainPositions=new Float32Array(rainCount*3);
  for(let i=0;i<rainCount;i++){ rainPositions[i*3]=(Math.random()-.5)*42; rainPositions[i*3+1]=Math.random()*24; rainPositions[i*3+2]=(Math.random()-.5)*42; }
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rainMaterial=new THREE.PointsMaterial({color:0xaee6ff,size:.16,transparent:true,opacity:.8});
  const rain=new THREE.Points(rainGeometry,rainMaterial); rain.visible=false; TV.scene.add(rain);

  const bgDay=new THREE.Color(0x75cfff),bgDusk=new THREE.Color(0xff9f77),bgNight=new THREE.Color(0x1d315d),bgCloud=new THREE.Color(0x94b6c7),fogDay=new THREE.Color(0x8fd8f5),fogNight=new THREE.Color(0x263a61);
  function updateWorldVisuals(dt){
    const dayFraction=save.world.minutes/1440;
    const daylight=Math.max(0,Math.sin((dayFraction-.25)*Math.PI*2));
    let target=daylight>.18?bgDay:bgNight;
    if((dayFraction>.72&&dayFraction<.82)||(dayFraction>.18&&dayFraction<.25))target=bgDusk;
    if(save.world.weather==='cloudy'||save.world.weather==='foggy')target=bgCloud;
    TV.scene.background.lerp(target,.018);
    TV.scene.fog.color.lerp(daylight>.2?fogDay:fogNight,.02);
    TV.sun.intensity=.28+daylight*2.25;
    TV.sun.position.set(Math.cos(dayFraction*Math.PI*2)*75,20+daylight*85,Math.sin(dayFraction*Math.PI*2)*65);
    rain.visible=save.world.weather==='rainy'&&TV.state.area==='world';
    if(rain.visible){
      rain.position.x=TV.player.position.x; rain.position.z=TV.player.position.z;
      const pos=rainGeometry.attributes.position.array;
      for(let i=0;i<rainCount;i++){pos[i*3+1]-=dt*14;if(pos[i*3+1]<0)pos[i*3+1]=24;}
      rainGeometry.attributes.position.needsUpdate=true;
    }
  }

  function formatTime(minutes){ const total=Math.floor(minutes)%1440; const h24=Math.floor(total/60); const mins=total%60; const suffix=h24>=12?'PM':'AM'; const h=h24%12||12; return `${h}:${String(mins).padStart(2,'0')} ${suffix}`; }

  // -------------------------------------------------------------------------
  // World wiring and interiors.
  // -------------------------------------------------------------------------
  function wireWorldInteractions(){
    // Replace the original flavor-only interactions with real systems.
    const replace=(area,prompt,action)=>{ const item=TV.interactables.find((i)=>i.area===area&&i.prompt===prompt); if(item)item.action=action; };
    replace('generalStore','Browse counter',()=>openShop('grocery'));
    replace('cafe','Order snack',()=>openCafeCounter());
    const cityDesk=TV.interactables.find((i)=>i.area==='cityHall'&&i.prompt==='Ask about town'); if(cityDesk){cityDesk.prompt='Open job & property desk';cityDesk.action=()=>openJobs();}

    const fs=TV.areaBounds.furnitureStore;
    TV.registerInteraction({x:fs.cx,z:fs.cz+4.4,radius:3,area:'furnitureStore',prompt:'Browse furniture catalog',action:()=>openShop('furniture')});
    const home=TV.areaBounds.home;
    TV.registerInteraction({x:home.cx-8.8,z:home.cz-6.4,radius:3,area:'home',prompt:'Sleep until morning',action:sleepAtHome});
    TV.registerInteraction({x:home.cx+9.2,z:home.cz-6.4,radius:3,area:'home',prompt:'Cook Sunshine Soup',action:cookAtHome});
    TV.registerInteraction({x:home.cx+8.6,z:home.cz+5.5,radius:3,area:'home',prompt:'Take a shower',action:showerAtHome});
    TV.registerInteraction({x:home.cx-7.5,z:home.cz+5.5,radius:3,area:'home',prompt:'Open decorating menu',action:()=>openPhone('home')});

    TV.npcs.forEach((npc)=>TV.registerInteraction({object:npc,radius:2.25,area:'world',prompt:`Talk to ${npc.userData.name}`,action:()=>openNPC(npc)}));

    // Story progresses as soon as the player actually enters home.
    const originalEnter=TV.enterInterior;
    const homeEntrance=TV.interactables.find((i)=>i.area==='world'&&i.prompt==='Go home');
    if(homeEntrance){ const action=homeEntrance.action; homeEntrance.action=()=>{action();emitProgress('enter-home',1);}; }

    document.addEventListener('keydown',(event)=>{
      if(!buildMode)return;
      const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'forward',KeyW:'forward',ArrowDown:'back',KeyS:'back',KeyR:'rotate',Enter:'place',Escape:'cancel'};
      if(map[event.code]){event.preventDefault();buildAction(map[event.code]);}
    },true);
  }

  function openCafeCounter(){
    const overlay=modal('Cloud Nine Cafe',`<div class="life-two-col"><article class="life-card"><div class="item-icon">🧇</div><h3>Order a snack</h3><p>Buy a Cloud Sandwich for $25 or a Berry Moon Cake for $52.</p><div class="spacer"></div><button class="life-button" data-cafe-buy="sandwich" data-price="25">BUY SANDWICH</button><button class="life-button secondary" data-cafe-buy="berryCake" data-price="52" style="margin-top:8px">BUY CAKE</button></article><article class="life-card"><div class="item-icon">☕</div><h3>Work a shift</h3><p>Match customer orders in a fast cafe minigame.</p><div class="spacer"></div><button class="life-button green" data-cafe-job>START CAFE RUSH</button></article></div>`);
    overlay.querySelectorAll('[data-cafe-buy]').forEach((button)=>button.addEventListener('click',()=>{if(!spendMoney(Number(button.dataset.price)))return;addItem(button.dataset.cafeBuy,1);emitProgress('buy',1);saveGame('cafe-buy');TV.showToast('Snack added to your bag.',2);}));
    overlay.querySelector('[data-cafe-job]').addEventListener('click',()=>startJob('cafe'));
  }

  function applyLoadedState(){
    clearJobWorldObjects();
    if (jobRuntime?.interval) clearInterval(jobRuntime.interval);
    if (jobRuntime?.raf) cancelAnimationFrame(jobRuntime.raf);
    jobRuntime = null;
    rebuildHomeFurniture(); updateProjectVisuals(); updateHUD(); updateObjective(); updateHomeTierVisuals();
    const position=save.player.position;
    if(position.area&&position.area!=='world'&&TV.areaBounds[position.area]){
      TV.enterInterior(position.area,position.returnPoint||{x:0,z:10});
      TV.player.position.set(position.x,0,position.z);
    }else{
      if(TV.state.area!=='world')TV.exitInterior();
      TV.player.position.set(position.x,TV.terrainHeight(position.x,position.z),position.z);
    }
    TV.state.cameraReady=false;
    const pendingJob = save.activeJob ? JSON.parse(JSON.stringify(save.activeJob)) : null;
    if (pendingJob?.id === 'cleanup') {
      save.activeJob = null;
      startCleanupJob();
      save.activeJob.progress = Math.min(pendingJob.progress || 0, save.activeJob.total);
      for (let i = 0; i < save.activeJob.progress; i++) {
        if (jobWorldObjects[i]) jobWorldObjects[i].object.visible = false;
      }
    } else if (pendingJob?.id === 'delivery') {
      save.activeJob = null;
      startDeliveryJob();
      save.activeJob.progress = Math.min(pendingJob.progress || 0, save.activeJob.total);
      for (let i = 0; i < save.activeJob.progress; i++) {
        if (jobWorldObjects[i]) jobWorldObjects[i].object.visible = false;
      }
    } else if (pendingJob) {
      save.activeJob = null;
      TV.showToast('The unfinished minigame shift was safely closed.', 2.5);
    }
  }

  function updateNPCSchedules(){
    const hour=Math.floor(save.world.minutes/60);
    const locations={home:[-58,48],civic:[0,-9],park:[-72,48],cafe:[-15,23],shops:[24,-22],theater:[0,54]};
    TV.npcs.forEach((npc,index)=>{
      let spot;
      if(hour<8||hour>=22)spot=locations.home;
      else if(hour<12)spot=index%3===0?locations.civic:index%3===1?locations.shops:locations.park;
      else if(hour<17)spot=index%4===0?locations.cafe:index%4===1?locations.park:index%4===2?locations.shops:locations.civic;
      else spot=index%2?locations.theater:locations.park;
      npc.userData.home.set(spot[0]+(index%4)*3,spot[1]+Math.floor(index/4)*2);
    });
  }

  // -------------------------------------------------------------------------
  // Export/import/reset and sound.
  // -------------------------------------------------------------------------
  function exportSave(){
    captureRuntimeState();
    const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=`toon-valley-slot-${activeSlot}-day-${save.world.day}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    TV.showToast('Save backup exported.',2);
  }

  function importSave(){
    const input=document.createElement('input');input.type='file';input.accept='application/json';
    input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const raw=JSON.parse(await file.text());save=normalizeSave(raw);applyLoadedState();await saveGame('import');openPhone('save');TV.showToast('Save backup restored.',2.5);}catch(error){TV.showToast('That save file could not be read.',2.5);sfx('error');}};
    input.click();
  }

  function resetSlot(){
    const confirmReset=window.confirm(`Reset Toon Valley save slot ${activeSlot}? This cannot be undone unless you exported a backup.`);
    if(!confirmReset)return;
    save=createDefaultSave(); ensureDailyTasks(); applyLoadedState(); saveGame('reset'); openPhone('save'); TV.showToast('Save slot reset.',2);
  }

  function sfx(type){
    if(!save.settings.sound)return;
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended')audioContext.resume();
      const osc=audioContext.createOscillator(),gain=audioContext.createGain();
      const config={open:[520,.045],close:[320,.04],tick:[440,.025],good:[720,.09],error:[170,.1],money:[880,.13],buy:[620,.11],place:[560,.1],level:[980,.25],eat:[390,.08],sleep:[250,.22],water:[670,.13],cook:[500,.13]}[type]||[440,.05];
      osc.frequency.value=config[0];osc.type=type==='error'?'sawtooth':'sine';gain.gain.setValueAtTime(.045,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+config[1]);osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+config[1]);
    }catch(_){ }
  }

  function escapeHTML(value){return String(value).replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
  function capitalize(value){return String(value).replace(/(^|[-_ ])\w/g,(s)=>s.toUpperCase());}

  // -------------------------------------------------------------------------
  // HUD and update loop.
  // -------------------------------------------------------------------------
  function updateHUD(){
    document.getElementById('money-value').textContent=`$${save.player.money.toLocaleString()}`;
    const event=currentEvent();
    document.getElementById('clock-value').textContent=`DAY ${save.world.day} · ${formatTime(save.world.minutes)} · ${event.icon} ${event.name}`;
    document.getElementById('weather-value').textContent=WEATHER_ICONS[save.world.weather]||'☀️';
    for(const [need,value] of Object.entries(save.player.needs)){
      const fill=document.querySelector(`.need[data-need="${need}"] .need-fill`); if(fill)fill.style.transform=`scaleX(${value/100})`;
    }
    document.getElementById('build-button').classList.toggle('hidden',TV.state.area!=='home');
    updateObjective();
  }

  function updateActiveJobObjective(){
    if(!save.activeJob)return;
    const card=document.getElementById('objective-card');
    const data=save.activeJob;
    const names={cleanup:'PARK CLEANUP',delivery:'PARCEL DELIVERY'};
    if(names[data.id]){card.querySelector('b').textContent=names[data.id];document.getElementById('objective-text').textContent=data.id==='cleanup'?'Collect litter around Sunshine Park.':'Deliver parcels to the glowing package stops.';document.getElementById('objective-progress').textContent=`${data.progress}/${data.total}`;}
  }

  function updateLife(dt,now){
    if(!TV.state.started)return;
    if(!TV.state.modalOpen&&!TV.state.pausedByVisibility){
      minuteAccumulator+=dt;
      const minutesPerSecond=1;
      if(minuteAccumulator>=.25){
        const gameMinutes=minuteAccumulator*minutesPerSecond; minuteAccumulator=0;
        save.world.minutes+=gameMinutes; updateNeeds(gameMinutes);
        if(save.world.minutes>=1440){save.world.minutes-=1440;save.world.day++;onNewDay();}
      }
    }
    visualAccumulator+=dt;uiAccumulator+=dt;saveTimer+=dt;
    if(visualAccumulator>=.12){updateWorldVisuals(visualAccumulator);visualAccumulator=0;}
    if(uiAccumulator>=.25){updateHUD();updateNPCSchedules();if(save.activeJob)updateActiveJobObjective();uiAccumulator=0;}
    if(save.settings.autoSave&&saveTimer>=20){saveTimer=0;saveGame('autosave');}
  }

  // -------------------------------------------------------------------------
  // Boot sequence.
  // -------------------------------------------------------------------------
  async function boot(){
    injectUI();
    createProjectVisuals();
    wireWorldInteractions();
    db=await openDatabase();
    await loadGame(activeSlot);
    requestPersistentStorage();
    TV.registerUpdateHook(updateLife);
    window.addEventListener('pagehide',()=>saveGame('pagehide'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame('background');});
    window.addEventListener('beforeunload',()=>{captureRuntimeState();try{localStorage.setItem(EMERGENCY_KEY,JSON.stringify(save));}catch(_){}});
    if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch((error)=>console.warn('Service worker registration failed',error));
    updateHUD();
    console.info('Toon Valley life systems ready', {version:SAVE_VERSION,slot:activeSlot});
  }

  window.ToonValleyLife = Object.freeze({
    version: SAVE_VERSION,
    getState: () => JSON.parse(JSON.stringify(save)),
    saveGame,
    loadGame,
    openPhone,
    openShop,
    openJobs,
    startJob,
    startBuild,
    useItem,
    addMoney,
    emitProgress
  });

  boot().catch((error)=>{console.error('Toon Valley life systems failed to boot',error);TV.showToast('Life systems encountered a save error. The world is still playable.',4);});
})();
