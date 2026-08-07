(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV) return;

  const isPhone = TV.DEVICE.touch || matchMedia('(max-width: 760px)').matches;
  if (!isPhone) {
    window.ToonValleyMobilePolish = Object.freeze({ active:false });
    return;
  }

  // Keep the cel-shaded art direction but stop rendering modern phones at a tiny
  // fraction of their physical resolution. Adaptive scaling may still step down,
  // but never to the old visibly blocky 0.55 DPR floor.
  Object.assign(TV.CONFIG.mobile, {
    pixelRatio: 1.65,
    minPixelRatio: 1.15,
    far: 205,
    grass: Math.max(TV.CONFIG.mobile.grass, 650),
    trees: Math.max(TV.CONFIG.mobile.trees, 100),
    rocks: Math.max(TV.CONFIG.mobile.rocks, 50),
    npcs: Math.max(TV.CONFIG.mobile.npcs, 12),
    flowers: Math.max(TV.CONFIG.mobile.flowers, 92),
    lamps: Math.max(TV.CONFIG.mobile.lamps, 28),
    targetFPS: 30
  });
  TV.CONFIG.low.pixelRatio = Math.max(TV.CONFIG.low.pixelRatio, 1.5);
  TV.CONFIG.low.minPixelRatio = Math.max(TV.CONFIG.low.minPixelRatio, 1.1);
  TV.CONFIG.medium.pixelRatio = Math.max(TV.CONFIG.medium.pixelRatio, 1.85);
  TV.CONFIG.medium.minPixelRatio = Math.max(TV.CONFIG.medium.minPixelRatio, 1.25);

  TV.renderer.domElement.style.imageRendering = 'auto';
  TV.renderer.domElement.style.transform = 'translateZ(0)';
  TV.renderer.domElement.style.backfaceVisibility = 'hidden';
  TV.applyQuality(TV.state.quality);

  // iOS Safari can lose a synthesized click when a button is inside a full-screen
  // touch surface. Toggle sprint on pointer-down instead and suppress the delayed
  // click so it cannot immediately toggle back off.
  const sprint = document.getElementById('mobile-sprint');
  let sprintPointerAt = -Infinity;
  if (sprint) {
    sprint.style.touchAction = 'manipulation';
    sprint.addEventListener('pointerdown', (event) => {
      sprintPointerAt = performance.now();
      TV.setMobileSprint(!TV.state.mobileSprint);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    sprint.addEventListener('click', (event) => {
      if (performance.now() - sprintPointerAt < 900) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  const style = document.createElement('style');
  style.id = 'toon-valley-mobile-polish';
  style.textContent = `
    @media (max-width:760px), (pointer:coarse) {
      #hud .top-left,#hud .location{display:none!important}
      #hud .top-right{top:calc(8px + var(--safe-top))!important;right:calc(8px + var(--safe-right))!important;padding:7px 9px!important;font-size:10px!important;z-index:18}
      #life-hud .life-top{top:calc(8px + var(--safe-top))!important;left:calc(8px + var(--safe-left))!important;width:min(196px,calc(100vw - 116px))!important;gap:4px!important}
      #life-hud .life-chip{min-height:27px!important;padding:3px 8px!important;border-radius:10px!important;box-shadow:0 3px 0 rgba(0,0,0,.2)!important}
      #life-hud .life-money{font-size:13px!important} #life-hud .life-clock{font-size:9px!important;line-height:1.25!important}
      #life-hud .life-needs{gap:3px!important} #life-hud .need{height:18px!important} #life-hud .need span:last-child{font-size:7px!important}
      #life-hud .life-actions{top:calc(54px + var(--safe-top))!important;right:calc(8px + var(--safe-right))!important;grid-template-columns:repeat(2,40px)!important;gap:6px!important}
      #life-hud .life-round{width:40px!important;height:40px!important;border-radius:12px!important;border-width:2px!important;font-size:16px!important;box-shadow:0 4px 0 rgba(0,0,0,.25)!important}
      #look-pad{top:0!important;width:62%!important}
      #joystick-zone{width:132px!important;height:132px!important;left:calc(10px + var(--safe-left))!important;bottom:calc(10px + var(--safe-bottom))!important}
      .joystick-ring{width:98px!important;height:98px!important} #joystick-knob{width:46px!important;height:46px!important}
      .mobile-button{width:60px!important;height:60px!important;border-width:3px!important;touch-action:manipulation!important}
      .mobile-button.jump{width:68px!important;height:68px!important;right:calc(18px + var(--safe-right))!important;bottom:calc(26px + var(--safe-bottom))!important}
      .mobile-button.sprint{right:calc(94px + var(--safe-right))!important;bottom:calc(16px + var(--safe-bottom))!important}
      .mobile-button.interact{right:calc(26px + var(--safe-right))!important;bottom:calc(108px + var(--safe-bottom))!important}
      .interaction-prompt{bottom:calc(176px + var(--safe-bottom))!important;max-width:74vw!important;font-size:10px!important;padding:8px 12px!important}
      .toast{top:28%!important}
    }
    @media (max-width:390px) {
      #life-hud .life-top{width:min(180px,calc(100vw - 104px))!important}
      #life-hud .life-actions{grid-template-columns:repeat(2,37px)!important} #life-hud .life-round{width:37px!important;height:37px!important}
      #joystick-zone{width:120px!important;height:120px!important}.joystick-ring{width:90px!important;height:90px!important}
      .mobile-button{width:56px!important;height:56px!important}.mobile-button.jump{width:64px!important;height:64px!important}
    }
    @media (orientation:landscape) and (max-height:600px) {
      #hud .top-right{top:calc(5px + var(--safe-top))!important;right:calc(6px + var(--safe-right))!important}
      #life-hud .life-top{top:calc(5px + var(--safe-top))!important;left:calc(6px + var(--safe-left))!important;width:170px!important}
      #life-hud .life-clock{display:none!important}
      #life-hud .life-actions{top:calc(38px + var(--safe-top))!important;right:calc(6px + var(--safe-right))!important;grid-template-columns:repeat(4,35px)!important}
      #life-hud .life-round{width:35px!important;height:35px!important;font-size:14px!important}
      #joystick-zone{width:108px!important;height:108px!important;left:calc(4px + var(--safe-left))!important;bottom:calc(2px + var(--safe-bottom))!important}
      .joystick-ring{width:80px!important;height:80px!important} #joystick-knob{width:38px!important;height:38px!important}
      .mobile-button{width:50px!important;height:50px!important}.mobile-button span{font-size:19px!important}.mobile-button small{font-size:7px!important}
      .mobile-button.jump{width:56px!important;height:56px!important;right:calc(10px + var(--safe-right))!important;bottom:calc(8px + var(--safe-bottom))!important}
      .mobile-button.sprint{right:calc(72px + var(--safe-right))!important;bottom:calc(6px + var(--safe-bottom))!important}
      .mobile-button.interact{right:calc(12px + var(--safe-right))!important;bottom:calc(70px + var(--safe-bottom))!important}
      .interaction-prompt{bottom:calc(72px + var(--safe-bottom))!important;max-width:52vw!important}
      .toast{top:24%!important;max-width:60vw!important}
      #look-pad{width:68%!important;top:0!important}
    }
  `;
  document.head.appendChild(style);

  const refreshViewport = () => setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (TV.state.quality === 'mobile' || TV.state.quality === 'low' || TV.state.quality === 'medium') TV.applyQuality(TV.state.quality);
  }, 80);
  window.addEventListener('orientationchange', refreshViewport, { passive:true });
  window.visualViewport?.addEventListener('resize', refreshViewport, { passive:true });

  window.ToonValleyMobilePolish = Object.freeze({
    active:true,
    mobilePixelRatio:TV.CONFIG.mobile.pixelRatio,
    mobileMinPixelRatio:TV.CONFIG.mobile.minPixelRatio,
    portraitLandscape:true,
    sprintPointerFix:true,
    hudStyleId:style.id
  });
  console.info('Toon Valley mobile polish ready',window.ToonValleyMobilePolish);
})();
