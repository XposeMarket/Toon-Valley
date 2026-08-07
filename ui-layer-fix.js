(() => {
  'use strict';
  const style=document.createElement('style');
  style.id='toon-valley-ui-layer-fix';
  style.textContent=`
    #game{z-index:0!important}
    #hud{z-index:100!important}
    #life-hud{z-index:200!important}
    #life-hud .life-actions{z-index:4!important;pointer-events:auto!important}
    #life-hud .life-actions button{pointer-events:auto!important;position:relative;z-index:5}
    .overlay{z-index:10000!important}
    .life-overlay,.mb-overlay,.ohx{z-index:12000!important}
    #build-controls,#ohbuild,#bl-controls{z-index:13000!important}
  `;
  document.head.appendChild(style);

  // Pointer Lock owns desktop mouse input. Release it first and only open the
  // requested life UI after pointerlockchange completes; opening a modal from the
  // same key event that exits Pointer Lock can deadlock Chromium/Safari's input
  // state and used to make the phone appear frozen.
  const shortcuts={KeyP:'phone-button',KeyI:'inventory-button',KeyT:'tasks-button'};
  let pendingButton=null;
  const openPending=()=>{
    if(!pendingButton)return;
    const button=pendingButton; pendingButton=null;
    requestAnimationFrame(()=>button.click());
  };
  document.addEventListener('pointerlockchange',()=>{
    if(!document.pointerLockElement&&pendingButton)openPending();
  });
  document.addEventListener('keydown',(event)=>{
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
    const id=shortcuts[event.code];
    if(!id||!window.ToonValley?.state?.started||window.ToonValley.state.modalOpen)return;
    const button=document.getElementById(id);if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(document.pointerLockElement){
      pendingButton=button;
      window.ToonValley.setModalOpen(true);
      document.exitPointerLock?.();
      setTimeout(()=>{if(pendingButton&&!document.pointerLockElement)openPending();},80);
    }else button.click();
  },true);

  window.ToonValleyUILayerFix=Object.freeze({active:true,styleId:style.id,desktopShortcuts:{phone:'P',inventory:'I',tasks:'T'},pointerLockSafe:true});
  console.info('Toon Valley UI layer fix ready');
})();