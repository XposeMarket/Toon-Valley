(() => {
  'use strict';
  const directScript = document.currentScript?.src?.includes('/central-plaza.js');
  const repoBase = window.__TOON_VALLEY_SOURCE_BASE__ || 'https://raw.githubusercontent.com/XposeMarket/Toon-Valley/main/';
  const localBase = directScript ? new URL('.', document.currentScript.src).href : repoBase;
  const files = directScript
    ? ['central-plaza-core.js']
    : ['central-plaza-core.js','public-interiors.js','moonbeam-theater.js','owned-home.js','bluebell-lake.js','interaction-world-fix.js','valley-transit.js','community-garden.js','valley-community-life.js','mobile-polish.js'];
  const loaded = {
    'central-plaza-core.js': () => window.ToonValleyCentralPlaza,
    'public-interiors.js': () => window.ToonValleyPublicInteriors,
    'moonbeam-theater.js': () => window.ToonValleyTheater,
    'owned-home.js': () => window.ToonValleyOwnedHome,
    'bluebell-lake.js': () => window.ToonValleyBluebellLake,
    'interaction-world-fix.js': () => window.ToonValleyInteractionFix,
    'valley-transit.js': () => window.ToonValleyTransit,
    'community-garden.js': () => window.ToonValleyCommunityGarden,
    'valley-community-life.js': () => window.ToonValleyCommunityLife,
    'mobile-polish.js': () => window.ToonValleyMobilePolish
  };
  async function boot() {
    for (const file of files) {
      if (loaded[file]?.()) continue;
      const url = `${localBase}${file}${directScript ? '' : `?v=${Date.now()}`}`;
      const response = await fetch(url, { cache: directScript ? 'default' : 'no-store' });
      if (!response.ok) throw new Error(`${file} returned HTTP ${response.status}`);
      const source = await response.text();
      new Function(`${source}\n//# sourceURL=toon-valley/${file}`)();
    }
  }
  window.ToonValleyExpansionBootstrap = boot();
  window.ToonValleyExpansionBootstrap.catch((error) => console.error('Toon Valley expansion bootstrap failed', error));
})();
