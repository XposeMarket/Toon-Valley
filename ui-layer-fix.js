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
  window.ToonValleyUILayerFix=Object.freeze({active:true,styleId:style.id});
  console.info('Toon Valley UI layer fix ready');
})();