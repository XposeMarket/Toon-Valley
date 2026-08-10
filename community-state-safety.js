(() => {
  'use strict';
  const KEY = 'toon-valley-community-life-v1';
  const defaults = {
    trailDay: -1, trailStarted: false, trailVisited: [], trailAwaitingSignoff: false, trailDone: false,
    errandDay: -1, errandIndex: 0, errandStarted: false, errandVisited: [], errandAwaitingSignoff: false, errandDone: false
  };
  let repaired = false;
  let parseFailed = false;

  function bool(value) { return value === true; }
  function integer(value, fallback = -1) { return Number.isInteger(value) ? value : fallback; }
  function stages(value, max) {
    if (!Array.isArray(value)) { repaired = true; return []; }
    const clean = [...new Set(value.filter(v => Number.isInteger(v) && v >= 0 && v < max))].sort((a, b) => a - b);
    const sequential = clean.filter((v, i) => v === i);
    if (sequential.length !== value.length || sequential.some((v, i) => v !== value[i])) repaired = true;
    return sequential;
  }

  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) { raw = {}; repaired = true; }
  } catch (_) {
    raw = {};
    parseFailed = true;
    repaired = true;
  }

  const next = { ...defaults, ...raw };
  next.trailDay = integer(raw.trailDay, -1);
  next.errandDay = integer(raw.errandDay, -1);
  next.trailStarted = bool(raw.trailStarted);
  next.trailAwaitingSignoff = bool(raw.trailAwaitingSignoff);
  next.trailDone = bool(raw.trailDone);
  next.errandStarted = bool(raw.errandStarted);
  next.errandAwaitingSignoff = bool(raw.errandAwaitingSignoff);
  next.errandDone = bool(raw.errandDone);
  next.trailVisited = stages(raw.trailVisited, 4);
  next.errandVisited = stages(raw.errandVisited, 3);
  const rawErrandIndex = Number.isInteger(raw.errandIndex) ? raw.errandIndex : 0;
  next.errandIndex = ((rawErrandIndex % 3) + 3) % 3;
  if (next.errandIndex !== raw.errandIndex) repaired = true;

  if (next.trailDone) {
    if (next.trailStarted || next.trailAwaitingSignoff) repaired = true;
    next.trailStarted = false;
    next.trailAwaitingSignoff = false;
  } else if (next.trailAwaitingSignoff) {
    if (next.trailVisited.length !== 4) {
      next.trailAwaitingSignoff = false;
      repaired = true;
    } else {
      next.trailStarted = true;
    }
  } else if (!next.trailStarted && next.trailVisited.length) {
    next.trailVisited = [];
    repaired = true;
  }

  if (next.errandDone) {
    if (next.errandStarted || next.errandAwaitingSignoff) repaired = true;
    next.errandStarted = false;
    next.errandAwaitingSignoff = false;
  } else if (next.errandAwaitingSignoff) {
    if (next.errandVisited.length !== 3) {
      next.errandAwaitingSignoff = false;
      repaired = true;
    } else {
      next.errandStarted = true;
    }
  } else if (!next.errandStarted && next.errandVisited.length) {
    next.errandVisited = [];
    repaired = true;
  }

  const normalized = JSON.stringify(next);
  const original = (() => { try { return JSON.stringify(raw); } catch (_) { return ''; } })();
  if (normalized !== original) repaired = true;
  if (repaired) {
    try { localStorage.setItem(KEY, normalized); } catch (_) {}
  }

  window.ToonValleyCommunityStateSafety = Object.freeze({
    active: true,
    storageKey: KEY,
    repaired,
    parseFailed,
    getState: () => ({ ...next, trailVisited: [...next.trailVisited], errandVisited: [...next.errandVisited] })
  });
})();