import './style.css';
import { BUILDINGS, RESOURCE_META } from './content.js';
import { createGame, logEvent, placeBuilding, select, setPriority, setResearch, setSpeed, simulate, spawnParticles, startExpedition, addResource, notify } from './sim.js';
import { createRenderer, drawOverview } from './render.js';
import { createUI } from './ui.js';
import { key } from './world.js';

const state = createGame(732);
state.speed = 0;
state.prevSpeed = 1;

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas, state);

let started = false;
let overviewOpen = false;
let lastUI = 0;
let lastOverview = 0;
let hoverFeature = null;
let pointers = new Map();
let panPointer = null;
let panStart = null;
let panCam = null;
let pinchState = null;

const actions = {
  select(kind, id) {
    select(state, kind, id);
    state.mobileInspector = Boolean(kind);
    state.dirty = true;
  },
  build(type) {
    const def = BUILDINGS[type];
    if (!def) return;
    state.buildMode = { type };
    state.uiTab = 'build';
    state.dirty = true;
    ui.forceLeft();
    ui.forceRight();
    renderer.cam.targetZoom = Math.max(renderer.cam.targetZoom, 1.05);
  },
  stopBuild() {
    state.buildMode = null;
    state.placeCheck = null;
    state.dirty = true;
  },
  priority(cid, work, val) {
    setPriority(state, cid, work, val);
    ui.forceLeft();
  },
  research(id) {
    setResearch(state, id);
    ui.forceLeft();
  },
  expedition(id) {
    startExpedition(state, id);
    state.uiTab = 'world';
    state.dirty = true;
    ui.forceLeft();
  },
  markFeature(id) {
    const f = state.features.find(v => v.id === id);
    if (!f) return;
    f.marked = !f.marked;
    state.dirty = true;
    ui.forceRight();
    notify(state, `${f.type === 'tree' ? 'Timber' : f.type === 'rock' ? 'Stone' : f.type === 'crystal' ? 'Crystal' : 'Foraging'} ${f.marked ? 'marked for harvest.' : 'unmarked.'}`, '');
  },
  cancelBuilding(id) {
    const b = state.buildings.find(v => v.id === id);
    if (!b) return;
    if (b.complete) return;
    const def = BUILDINGS[b.type];
    for (const [r, n] of Object.entries(def.cost)) addResource(state, r, Math.floor(n / 2), true);
    state.buildings = state.buildings.filter(v => v.id !== id);
    state.selected = null;
    logEvent(state, `Cancelled ${def.name}. Half the materials recovered.`, '⌫');
    state.dirty = true;
    ui.forceRight();
  },
  deconstruct(id) {
    const b = state.buildings.find(v => v.id === id);
    if (!b || !b.complete) return;
    const def = BUILDINGS[b.type];
    for (const [r, n] of Object.entries(def.cost)) addResource(state, r, Math.max(1, Math.floor(n * .5)), true);
    state.buildings = state.buildings.filter(v => v.id !== id);
    spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, 12, ['#a78b62', '#6b5a43', '#e6d4ae'], { speed: 1, life: .7, size: 1.5 });
    state.selected = null;
    logEvent(state, `${def.name} deconstructed. Half the materials recovered.`, '⌫', '');
    state.dirty = true;
    ui.forceRight();
    ui.forceLeft();
  },
  toggleBuilding(id) {
    const b = state.buildings.find(v => v.id === id);
    if (!b) return;
    b.active = !b.active;
    notify(state, `${BUILDINGS[b.type].name} switched ${b.active ? 'on' : 'off'}.`, '');
    state.dirty = true;
    ui.forceRight();
  },
  focus(kind, id) {
    const entity = kind === 'colonist' ? state.colonists.find(c => c.id === id) : kind === 'enemy' ? state.enemies.find(e => e.id === id) : state.buildings.find(b => b.id === id);
    if (!entity) return;
    select(state, kind, id);
    renderer.centerOn(kind === 'building' ? entity.x + (entity.w || 1) / 2 : entity.x, kind === 'building' ? entity.y + (entity.h || 1) / 2 : entity.y);
    if (kind === 'enemy') renderer.cam.targetZoom = Math.max(renderer.cam.targetZoom, 1.25);
  },
  rest(id) {
    const c = state.colonists.find(v => v.id === id);
    if (!c) return;
    c.job = null;
    c.path = [];
    c.rest = Math.min(c.rest, 4);
    notify(state, `${c.first} has been ordered to rest.`, '');
    state.dirty = true;
  },
  togglePriority(cid, work) {
    const c = state.colonists.find(v => v.id === cid);
    if (!c) return;
    c.priorities[work] = (c.priorities[work] || 4) < 4 ? 4 : 3;
    if (c.priorities[work] === 4 && c.job?.type === 'fight') c.job = null;
    state.dirty = true;
    ui.forceRight();
  },
  openOverview() {
    overviewOpen = true;
    document.getElementById('overview').classList.remove('hidden');
    drawOverview(document.getElementById('overview-canvas'), state);
  },
  closeOverview() {
    overviewOpen = false;
    document.getElementById('overview').classList.add('hidden');
  },
  speed(n) {
    setSpeed(state, n);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === n));
  },
  restart() {
    window.location.reload();
  },
};

const ui = createUI(state, actions);
ui.bind();
ui.renderAll();

/* ------------------------------------------------------------------ input */
function tileFromEvent(e) {
  return renderer.screenToWorld(e.clientX, e.clientY);
}

function updateHover(e) {
  const w = tileFromEvent(e);
  const tx = Math.floor(w.x), ty = Math.floor(w.y);
  state.hover = { x: tx, y: ty };
  if (state.buildMode) {
    const def = BUILDINGS[state.buildMode.type];
    const check = canPlaceSafe(state.buildMode.type, tx, ty);
    state.placeCheck = check;
  } else {
    state.placeCheck = null;
  }
  const f = state.featureIndex.get(key(tx, ty)) || null;
  hoverFeature = f;
  const tooltip = document.getElementById('tooltip');
  if (f && !state.buildMode) {
    const names = { tree: 'Old Timber', rock: 'Stone Outcrop', bush: 'Berry Bush', crystal: 'Crystal Vein', ruinStone: 'Fallen Masonry', grave: 'Grave', waystone: 'Broken Waystone' };
    tooltip.innerHTML = `<b>${names[f.type] || f.type}</b> · ${Math.floor(f.amount)} ${f.type === 'tree' ? 'wood' : f.type === 'crystal' ? 'crystal' : f.type === 'bush' ? 'food' : 'stone'}${f.marked ? ' · marked' : ''}`;
    tooltip.style.left = `${Math.min(window.innerWidth - 230, e.clientX + 14)}px`;
    tooltip.style.top = `${Math.max(84, e.clientY - 30)}px`;
    tooltip.classList.remove('hidden');
  } else {
    tooltip.classList.add('hidden');
  }
}

function canPlaceSafe(type, x, y) {
  return canPlaceLocal(type, x, y);
}

function canPlaceLocal(type, x, y) {
  const def = BUILDINGS[type];
  if (!def) return { ok: false };
  for (let yy = 0; yy < def.h; yy++) {
    for (let xx = 0; xx < def.w; xx++) {
      const tx = x + xx, ty = y + yy;
      if (tx < 0 || ty < 0 || tx >= state.world.w || ty >= state.world.h) return { ok: false, reason: 'Beyond the map.' };
      const terr = state.world.tiles[ty * state.world.w + tx];
      if (terr === 3 || terr === 4) return { ok: false, reason: 'Unbuildable ground.' };
      if (state.featureIndex.get(key(tx, ty))) return { ok: false, reason: 'Something already occupies this ground.' };
      if (state.buildings.some(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h)) return { ok: false, reason: 'Structure overlap.' };
    }
  }
  return { ok: true };
}

function handleMapClick(clientX, clientY) {
  const world = renderer.screenToWorld(clientX, clientY);
  const tx = Math.floor(world.x), ty = Math.floor(world.y);
  if (state.buildMode) {
    const ok = placeBuilding(state, state.buildMode.type, tx, ty);
    if (ok) {
      state.dirty = true;
      ui.forceLeft();
    }
    return;
  }
  // Enemy nearest.
  let best = null, bd = .8;
  for (const en of state.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(en.x - world.x, en.y - world.y);
    if (d < bd) { bd = d; best = en; }
  }
  if (best) { actions.select('enemy', best.id); return; }
  // Colonist nearest.
  best = null; bd = .65;
  for (const c of state.colonists) {
    if (c.dead || c.onExpedition) continue;
    const d = Math.hypot(c.x - world.x, c.y - world.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (best) { actions.select('colonist', best.id); return; }
  // Building.
  const b = state.buildings.find(v => tx >= v.x && tx < v.x + v.w && ty >= v.y && ty < v.y + v.h);
  if (b) { actions.select('building', b.id); return; }
  // Feature.
  const f = state.featureIndex.get(key(tx, ty));
  if (f) { actions.select('feature', f.id); return; }
  actions.select(null, null);
}

canvas.addEventListener('pointerdown', e => {
  if (!started) return;
  const p = { x: e.clientX, y: e.clientY, type: e.pointerType };
  pointers.set(e.pointerId, p);
  canvas.setPointerCapture?.(e.pointerId);
  if (pointers.size === 2) {
    const pts = [...pointers.values()];
    pinchState = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), zoom: renderer.cam.targetZoom };
    panPointer = null;
    return;
  }
  if (e.button === 0 || e.button === 1 || e.button === 2) {
    panPointer = e.pointerId;
    panStart = { x: e.clientX, y: e.clientY };
    panCam = { x: renderer.cam.x, y: renderer.cam.y };
    p.dragged = false;
    p.button = e.button;
  }
});

canvas.addEventListener('pointermove', e => {
  if (!started) return;
  if (!panPointer && !pinchState) updateHover(e);
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  if (pinchState && pointers.size >= 2) {
    const pts = [...pointers.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const scale = d / pinchState.dist;
    renderer.cam.targetZoom = Math.max(.55, Math.min(2.4, pinchState.zoom * scale));
    return;
  }
  if (panPointer === e.pointerId && panStart) {
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if (Math.hypot(dx, dy) > 5) {
      if (p) p.dragged = true;
      const t = 32 * renderer.cam.zoom;
      renderer.cam.x = Math.max(4, Math.min(state.world.w - 4, panCam.x - dx / t));
      renderer.cam.y = Math.max(4, Math.min(state.world.h - 4, panCam.y - dy / t));
      canvas.style.cursor = 'grabbing';
    }
  }
});

function endPointer(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchState = null;
  if (panPointer === e.pointerId) {
    const moved = p?.dragged;
    const button = p?.button ?? 0;
    panPointer = null;
    panStart = null;
    panCam = null;
    canvas.style.cursor = 'crosshair';
    if (!moved && e.type === 'pointerup') {
      if (e.button === 2) {
        if (state.buildMode) { state.buildMode = null; state.placeCheck = null; state.dirty = true; }
      } else {
        const mm = renderer.minimapHit(e.clientX, e.clientY);
        if (mm) { renderer.centerOn(mm.x + 1, mm.y + .5); return; }
        if (button === 0 || e.pointerType === 'touch') handleMapClick(e.clientX, e.clientY);
      }
    }
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => {
  pointers.delete(e.pointerId);
  if (panPointer === e.pointerId) { panPointer = null; panStart = null; panCam = null; }
  pinchState = null;
});
canvas.addEventListener('pointerleave', e => {
  if (!panPointer) document.getElementById('tooltip').classList.add('hidden');
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  renderer.zoomBy(e.deltaY);
}, { passive: false });

window.addEventListener('keydown', e => {
  if (!started) {
    if (e.key === 'Enter' || e.key === ' ') startGame();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') {
    if (state.buildMode) { state.buildMode = null; state.placeCheck = null; state.dirty = true; }
    const modal = document.getElementById('modal-layer');
    if (!modal.classList.contains('hidden')) ui.closeModal();
    if (overviewOpen) actions.closeOverview();
  } else if (e.key === ' ') { e.preventDefault(); actions.speed(state.speed === 0 ? state.prevSpeed || 1 : 0); }
  else if (e.key === '1') actions.speed(1);
  else if (e.key === '2') actions.speed(2);
  else if (e.key === '3') actions.speed(3);
  else if (e.key === '0') actions.speed(0);
  else if (e.key === 'b' || e.key === 'B') { state.uiTab = 'build'; state.dirty = true; ui.forceLeft(); }
  else if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') renderer.panBy(0, 90);
  else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') renderer.panBy(0, -90);
  else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') renderer.panBy(90, 0);
  else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') renderer.panBy(-90, 0);
});

window.addEventListener('resize', () => {
  renderer.resize();
  if (overviewOpen) drawOverview(document.getElementById('overview-canvas'), state);
});

/* -------------------------------------------------------------- overview */
const overviewCanvas = document.getElementById('overview-canvas');
overviewCanvas.addEventListener('mousemove', e => {
  if (!overviewOpen) return;
  const rect = overviewCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const mapW = Math.min(rect.width * .72, state.world.w * 18);
  const mapH = mapW * state.world.h / state.world.w;
  const mx = rect.width / 2 - mapW / 2, my = rect.height / 2 - mapH / 2;
  const wx = (e.clientX - rect.left - mx) / mapW * state.world.w;
  const wy = (e.clientY - rect.top - my) / mapH * state.world.h;
  if (wx >= 0 && wy >= 0 && wx <= state.world.w && wy <= state.world.h) {
    overviewCanvas.style.cursor = 'crosshair';
  } else overviewCanvas.style.cursor = 'default';
});
overviewCanvas.addEventListener('click', e => {
  if (!overviewOpen) return;
  const rect = overviewCanvas.getBoundingClientRect();
  const mapW = Math.min(rect.width * .72, state.world.w * 18);
  const mapH = mapW * state.world.h / state.world.w;
  const mx = rect.width / 2 - mapW / 2, my = rect.height / 2 - mapH / 2;
  const wx = (e.clientX - rect.left - mx) / mapW * state.world.w;
  const wy = (e.clientY - rect.top - my) / mapH * state.world.h;
  if (wx >= 0 && wy >= 0 && wx <= state.world.w && wy <= state.world.h) {
    renderer.centerOn(wx, wy);
    actions.closeOverview();
  }
});

/* ------------------------------------------------------------------- loop */
function startGame() {
  if (started) return;
  started = true;
  state.speed = 1;
  state.prevSpeed = 1;
  state.dirty = true;
  if (window.innerWidth <= 860) state.mobileInspector = false;
  const screen = document.getElementById('start-screen');
  screen.classList.add('dismiss');
  setTimeout(() => { screen.style.display = 'none'; }, 900);
  setTimeout(() => {
    state.dirty = true;
    ui.renderAll();
  }, 120);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(ctx.destination);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 220;
    o1.connect(filter); o2.connect(filter); filter.connect(gain);
    o1.start(); o2.start();
  } catch { /* no audio is still a story */ }
}

document.getElementById('start-btn').addEventListener('click', startGame);

function frame(now) {
  const dt = Math.min(.1, (now - (frame.last || now)) / 1000);
  frame.last = now;
  if (started) simulate(state, dt);
  renderer.draw(now);
  if (started && now - lastUI > 180) {
    lastUI = now;
    ui.tick();
  }
  if (overviewOpen && now - lastOverview > 450) {
    lastOverview = now;
    drawOverview(document.getElementById('overview-canvas'), state);
  }
  requestAnimationFrame(frame);
}

// Set the initial camera a little above the camp so both panels and the fire read well.
renderer.centerOn(state.world.campX + 1, state.world.campY + .5, true);
requestAnimationFrame(frame);

// Expose for browser verification and debugging, without affecting play.
window.__ashenreach = {
  state,
  renderer,
  start: startGame,
  actions,
  simulate,
  get ui() { return ui; },
};
