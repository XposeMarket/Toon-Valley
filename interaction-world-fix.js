(() => {
  'use strict';
  const TV = window.ToonValley;
  if (!TV) return;
  const proxies = [];
  const scratch = new TV.THREE.Vector3();
  function makeProxy(source) {
    const proxy = {
      position: new TV.THREE.Vector3(),
      get userData() { return source.userData; },
      get children() { return source.children; },
      get parent() { return source.parent; },
      clear() { source.clear(); return proxy; },
      add(...objects) { source.add(...objects); return proxy; },
      traverse(callback) { source.traverse(callback); },
      getWorldPosition(target) { return source.getWorldPosition(target); }
    };
    source.getWorldPosition(proxy.position);
    return proxy;
  }
  function repair() {
    for (const item of TV.interactables) {
      if (!item.object || item._worldProxy || !item.object.parent || item.object.parent === TV.scene) continue;
      const source = item.object;
      const proxy = makeProxy(source);
      item.object = proxy;
      item._worldProxy = true;
      item._worldSource = source;
      proxies.push({ item, source, proxy });
    }
  }
  repair();
  TV.registerUpdateHook(() => {
    repair();
    for (const entry of proxies) {
      if (!entry.source.parent) continue;
      entry.source.getWorldPosition(scratch);
      entry.proxy.position.copy(scratch);
    }
  });
  window.ToonValleyInteractionFix = Object.freeze({ get repaired() { return proxies.length; }, preservesObjectBehavior: true });
  console.info('Toon Valley nested interaction coordinate repair ready', { repaired: proxies.length });
})();
