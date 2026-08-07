(() => {
  'use strict';
  // Compatibility shim for older cached loaders. Lost-pet escort state is now owned
  // exclusively by valley-services.js; do not replace its physical interaction action.
  const services=window.ToonValleyServices;
  window.ToonValleySideQuestInteractionFix=Object.freeze({
    compatibilityShim:true,
    canonicalPetService:Boolean(services),
    immediatePetEscorts:false
  });
})();
