(() => {
  'use strict';
  const TV=window.ToonValley;
  if(!TV)return;
  const style=document.createElement('style');
  style.id='toon-valley-ui-layer-fix';
  style.textContent=`
    #game{z-index:0!important}
    #hud{z-index:100!important}
    #life-hud{z-index:200!important}
    #life-hud .life-actions{z-index:4!important;pointer-events:auto!important}
    #life-hud .life-actions button{pointer-events:auto!important;position:relative;z-index:5}
    .overlay{z-index:10000!important}
    .life-overlay,.mb-overlay,.ohx{z-index:12000!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    #build-controls,#ohbuild,#bl-controls{z-index:13000!important}
    #tv-desktop-dock{position:fixed;z-index:460;right:18px;bottom:18px;display:flex;gap:8px;pointer-events:auto;font:900 12px system-ui}
    #tv-desktop-dock button{border:3px solid #172027;border-radius:13px;background:#fff4cf;color:#172027;box-shadow:0 4px 0 #172027;padding:9px 12px;font:900 12px system-ui;cursor:pointer}
    #tv-desktop-dock button:hover{transform:translateY(-1px);background:#fff}
    #tv-desktop-dock kbd{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-right:5px;border:2px solid #172027;border-radius:5px;background:#fff;font:900 10px system-ui}
    body.touch-device #tv-desktop-dock{display:none!important}
    body:not(.tv-started) #tv-desktop-dock{display:none!important}
  `;
  document.head.appendChild(style);

  // Do not intercept or suspend renderer.render for UI. Chromium/WebGL stacks can
  // become unstable when a hot render function is replaced while Pointer Lock and
  // composited fixed overlays transition in the same task. The game already gates
  // input/update behavior through modalOpen; continuing normal draws keeps the
  // WebGL context alive and avoids the apparent "popover crash"/frozen canvas.
  let modalTransition=false;
  let transitions=0;
  function beginPopoverTransition(){modalTransition=true;transitions++;}
  function endPopoverTransition(){requestAnimationFrame(()=>{modalTransition=false;});}

  const dock=document.createElement('div');
  dock.id='tv-desktop-dock';
  dock.setAttribute('aria-label','Desktop ToonPhone shortcuts');
  dock.innerHTML='<button data-tv-tab="home"><kbd>P</kbd>PHONE</button><button data-tv-tab="tasks"><kbd>T</kbd>TASKS</button><button data-tv-tab="inventory"><kbd>I</kbd>BAG</button>';
  document.body.appendChild(dock);
  document.getElementById('play-button')?.addEventListener('click',()=>document.body.classList.add('tv-started'));
  if(TV.state.started)document.body.classList.add('tv-started');

  const shortcuts={KeyP:'home',KeyI:'inventory',KeyT:'tasks'};
  let pendingTab=null,releaseTimer=0;
  function actuallyOpen(tab){
    const Life=window.ToonValleyLife;
    if(!Life?.openPhone)return;
    pendingTab=null;
    clearTimeout(releaseTimer);
    if(TV.state.modalOpen&&!document.querySelector('.life-overlay,.mb-overlay,.ohx'))TV.setModalOpen(false);
    document.getElementById('pause-screen')?.classList.add('hidden');
    beginPopoverTransition();
    requestAnimationFrame(()=>{
      try{Life.openPhone(tab);}finally{endPopoverTransition();}
    });
  }
  function finishRelease(){
    if(!pendingTab||document.pointerLockElement)return;
    actuallyOpen(pendingTab);
  }
  function openTab(tab){
    if(!TV.state.started)return;
    const existing=document.querySelector('.life-overlay');
    if(TV.state.modalOpen&&existing){
      window.ToonValleyLife?.openPhone?.(tab);
      return;
    }
    if(TV.state.modalOpen&&!document.querySelector('.life-overlay,.mb-overlay,.ohx'))TV.setModalOpen(false);
    if(TV.state.modalOpen)return;
    if(document.pointerLockElement){
      pendingTab=tab;
      beginPopoverTransition();
      TV.setModalOpen(true);
      document.getElementById('pause-screen')?.classList.add('hidden');
      document.exitPointerLock?.();
      clearTimeout(releaseTimer);
      releaseTimer=setTimeout(finishRelease,180);
    }else actuallyOpen(tab);
  }
  document.addEventListener('pointerlockchange',()=>{
    if(!document.pointerLockElement&&pendingTab)finishRelease();
  });
  dock.addEventListener('click',event=>{
    const button=event.target.closest('[data-tv-tab]');
    if(!button)return;
    event.preventDefault();
    openTab(button.dataset.tvTab);
  });
  document.addEventListener('keydown',(event)=>{
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
    const tab=shortcuts[event.code];
    if(!tab||!TV.state.started)return;
    if(TV.state.modalOpen&&document.querySelector('.life-overlay'))return;
    event.preventDefault();event.stopImmediatePropagation();
    openTab(tab);
  },true);

  window.ToonValleyUILayerFix=Object.freeze({
    active:true,
    styleId:style.id,
    desktopShortcuts:{phone:'P',inventory:'I',tasks:'T'},
    pointerLockSafe:true,
    desktopDock:true,
    gpuSafePopoverCompositing:true,
    keepsWebGLRenderingUnderModal:true,
    freezesWebGLDrawsUnderModal:false,
    replacesRendererRender:false,
    canvasRemainsMounted:true,
    beginPopoverTransition,
    endPopoverTransition,
    transitionPending:()=>modalTransition,
    transitionCount:()=>transitions,
    suppressedFrames:()=>0,
    openTab
  });
  console.info('Toon Valley UI layer fix ready');
})();
