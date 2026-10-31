import { BUILDINGS, CLASSES, RACES, SEASONS, TERRAIN, TERRAIN_INFO, TRAITS } from './content.js';

const TILE_BASE = 32;
const hash = (x, y) => {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
};
const lerp = (a, b, t) => a + (b - a) * t;

export function createRenderer(canvas, state) {
  const ctx = canvas.getContext('2d');
  const cam = { x: state.world.campX + 1, y: state.world.campY, zoom: 1.15, targetZoom: 1.15 };
  let W = 0, H = 0, dpr = 1;
  let last = performance.now();
  let rainSeeds = Array.from({ length: 180 }, () => ({
    x: Math.random(), y: Math.random(), l: .012 + Math.random() * .02, s: .5 + Math.random() * .8,
  }));
  let fireflies = Array.from({ length: 42 }, () => ({
    x: Math.random(), y: Math.random(), p: Math.random() * 6.28, s: .1 + Math.random() * .3,
  }));
  let minimapState = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    if (!resize.done) {
      cam.zoom = cam.targetZoom = W < 700 ? .78 : W < 1100 ? 1.02 : 1.22;
      resize.done = true;
    }
  }
  resize();

  function tilePx() { return TILE_BASE * cam.zoom; }
  function worldToScreen(x, y) {
    const t = tilePx();
    return { x: (x - cam.x) * t + W / 2, y: (y - cam.y) * t + H / 2 };
  }
  function screenToWorld(sx, sy) {
    const t = tilePx();
    return { x: (sx - W / 2) / t + cam.x, y: (sy - H / 2) / t + cam.y };
  }
  function centerOn(x, y, instant = false) {
    if (instant) { cam.x = x; cam.y = y; }
    else { cam.x = lerp(cam.x, x, .15); cam.y = lerp(cam.y, y, .15); }
  }

  function draw(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    cam.zoom += (cam.targetZoom - cam.zoom) * .12;
    drawBackdrop();
    drawTerrain();
    drawGridHints();
    drawBuildings(false);
    drawFeatures();
    drawBuildings(true);
    drawProjectiles();
    drawColonists();
    drawEnemies();
    drawParticles();
    drawFloats();
    drawLighting();
    drawWeather();
    drawSelectionAndGhost();
    drawHudHints();
    drawMinimap();
    return { cam, W, H, tilePx: tilePx() };
  }

  function drawBackdrop() {
    ctx.fillStyle = '#10130f';
    ctx.fillRect(0, 0, W, H);
  }

  function visibleBounds() {
    const t = tilePx();
    const x0 = Math.max(0, Math.floor(cam.x - W / 2 / t) - 2);
    const y0 = Math.max(0, Math.floor(cam.y - H / 2 / t) - 2);
    const x1 = Math.min(state.world.w, Math.ceil(cam.x + W / 2 / t) + 2);
    const y1 = Math.min(state.world.h, Math.ceil(cam.y + H / 2 / t) + 2);
    return { x0, y0, x1, y1 };
  }

  function terrainColor(t, x, y) {
    const v = hash(x, y);
    const v2 = state.world.variant[y * state.world.w + x] / 255;
    switch (t) {
      case TERRAIN.GRASS: return shade('#52613e', (v - .5) * .11 + (v2 - .5) * .05);
      case TERRAIN.FOREST: return shade('#445236', (v - .5) * .12);
      case TERRAIN.DIRT: return shade('#68533a', (v - .5) * .13);
      case TERRAIN.WATER: return shade('#2f4d55', (v - .5) * .08);
      case TERRAIN.MOUNTAIN: return shade('#4a4841', (v - .5) * .14);
      case TERRAIN.SAND: return shade('#75694d', (v - .5) * .1);
      case TERRAIN.RUIN: return shade('#59564b', (v - .5) * .12);
      case TERRAIN.FARM: return shade('#5c452e', (v - .5) * .1);
      default: return '#4d573b';
    }
  }

  function drawTerrain() {
    const t = tilePx();
    const { x0, y0, x1, y1 } = visibleBounds();
    const time = state.simTime + performance.now() / 1000;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const terrain = state.world.tiles[y * state.world.w + x];
        const sx = (x - cam.x) * t + W / 2;
        const sy = (y - cam.y) * t + H / 2;
        ctx.fillStyle = terrainColor(terrain, x, y);
        ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(t + 1), Math.ceil(t + 1));

        if (terrain === TERRAIN.WATER) {
          const wob = Math.sin(time * 1.4 + x * .7 + y * .5) * t * .08;
          ctx.strokeStyle = `rgba(150,190,193,${.10 + hash(x, y) * .06})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + t * .16, sy + t * .4 + wob);
          ctx.quadraticCurveTo(sx + t * .45, sy + t * .33 - wob, sx + t * .78, sy + t * .44 + wob);
          ctx.stroke();
          if (hash(x + 3, y + 8) > .55) {
            ctx.strokeStyle = 'rgba(205,224,215,.11)';
            ctx.beginPath();
            ctx.moveTo(sx + t * .2, sy + t * .7);
            ctx.lineTo(sx + t * .48, sy + t * .68);
            ctx.stroke();
          }
        } else if (terrain === TERRAIN.GRASS) {
          if (hash(x + 5, y + 9) > .52) {
            ctx.strokeStyle = 'rgba(174,187,121,.14)';
            ctx.lineWidth = .8;
            const ox = hash(x, y + 4) * t * .7 + t * .12;
            const oy = hash(x + 9, y) * t * .7 + t * .12;
            ctx.beginPath();
            ctx.moveTo(sx + ox, sy + oy + t * .13);
            ctx.lineTo(sx + ox + t * .03, sy + oy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx + ox + t * .04, sy + oy + t * .13);
            ctx.lineTo(sx + ox + t * .08, sy + oy + t * .02);
            ctx.stroke();
          }
          if (hash(x + 12, y + 22) > .82) {
            ctx.fillStyle = 'rgba(201,183,123,.42)';
            ctx.beginPath();
            ctx.arc(sx + t * .65, sy + t * .3, 1.2, 0, 7);
            ctx.fill();
          }
        } else if (terrain === TERRAIN.DIRT) {
          ctx.fillStyle = 'rgba(30,22,15,.12)';
          if (hash(x + 2, y + 5) > .48) ctx.fillRect(sx + t * .2, sy + t * .6, t * .06, t * .03);
          if (hash(x + 7, y + 1) > .66) ctx.fillRect(sx + t * .67, sy + t * .32, t * .05, t * .04);
        } else if (terrain === TERRAIN.MOUNTAIN) {
          ctx.fillStyle = 'rgba(196,190,168,.08)';
          ctx.beginPath();
          ctx.moveTo(sx + t * .16, sy + t * .76);
          ctx.lineTo(sx + t * .45, sy + t * .16);
          ctx.lineTo(sx + t * .7, sy + t * .7);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(24,24,22,.18)';
          ctx.beginPath();
          ctx.moveTo(sx + t * .45, sy + t * .16);
          ctx.lineTo(sx + t * .4, sy + t * .7);
          ctx.stroke();
        } else if (terrain === TERRAIN.RUIN) {
          ctx.strokeStyle = 'rgba(28,26,21,.2)';
          ctx.lineWidth = 1;
          if (hash(x, y) > .4) {
            ctx.beginPath();
            ctx.moveTo(sx + t * .1, sy + t * .15);
            ctx.lineTo(sx + t * .1, sy + t * .85);
            ctx.stroke();
          }
          if (hash(x + 4, y + 3) > .55) {
            ctx.beginPath();
            ctx.moveTo(sx + t * .3, sy + t * .8);
            ctx.lineTo(sx + t * .73, sy + t * .8);
            ctx.stroke();
          }
        } else if (terrain === TERRAIN.FARM) {
          ctx.strokeStyle = 'rgba(37,27,17,.35)';
          for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(sx + t * .08, sy + t * i / 4);
            ctx.lineTo(sx + t * .92, sy + t * i / 4);
            ctx.stroke();
          }
        }
        // Subtle transitions.
        if (x > 0) {
          const left = state.world.tiles[y * state.world.w + x - 1];
          if (left !== terrain) {
            ctx.fillStyle = terrainColor(left, x - 1, y);
            ctx.globalAlpha = .16;
            ctx.fillRect(sx, sy, 2, t);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    // Map border.
    const c0 = worldToScreen(0, 0), c1 = worldToScreen(state.world.w, state.world.h);
    ctx.strokeStyle = 'rgba(201,161,92,.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
  }

  function drawGridHints() {
    if (!state.buildMode && !state.hover) return;
    const t = tilePx();
    if (state.buildMode) {
      const { x0, y0, x1, y1 } = visibleBounds();
      ctx.strokeStyle = 'rgba(230,212,174,.025)';
      ctx.lineWidth = .5;
      for (let x = x0; x < x1; x++) {
        const sx = (x - cam.x) * t + W / 2;
        ctx.beginPath(); ctx.moveTo(sx, y0 * t - cam.y * t + H / 2); ctx.lineTo(sx, y1 * t - cam.y * t + H / 2); ctx.stroke();
      }
      for (let y = y0; y < y1; y++) {
        const sy = (y - cam.y) * t + H / 2;
        ctx.beginPath(); ctx.moveTo(x0 * t - cam.x * t + W / 2, sy); ctx.lineTo(x1 * t - cam.x * t + W / 2, sy); ctx.stroke();
      }
    }
  }

  function drawFeatures() {
    const t = tilePx();
    const { x0, y0, x1, y1 } = visibleBounds();
    const time = state.simTime;
    const list = state.features.filter(f => f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1).sort((a, b) => a.y - b.y);
    for (const f of list) {
      const sx = (f.x - cam.x) * t + W / 2;
      const sy = (f.y - cam.y) * t + H / 2;
      const sway = Math.sin(time * 1.2 + f.sway) * t * .025;
      if (f.marked) {
        ctx.strokeStyle = 'rgba(233,201,135,.7)';
        ctx.lineWidth = 1;
        const b = t * .09;
        ctx.beginPath();
        ctx.moveTo(sx + b, sy + 2); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx + 2, sy + b);
        ctx.moveTo(sx + t - b, sy + 2); ctx.lineTo(sx + t - 2, sy + 2); ctx.lineTo(sx + t - 2, sy + b);
        ctx.moveTo(sx + 2, sy + t - b); ctx.lineTo(sx + 2, sy + t - 2); ctx.lineTo(sx + b, sy + t - 2);
        ctx.moveTo(sx + t - b, sy + t - 2); ctx.lineTo(sx + t - 2, sy + t - 2); ctx.lineTo(sx + t - 2, sy + t - b);
        ctx.stroke();
      }
      switch (f.type) {
        case 'tree': drawTree(sx + sway, sy, t, f, time); break;
        case 'rock': drawRock(sx, sy, t, f); break;
        case 'bush': drawBush(sx + sway * .4, sy, t, f, time); break;
        case 'crystal': drawCrystal(sx, sy, t, f, time); break;
        case 'ruinStone': drawRuinStone(sx, sy, t, f); break;
        case 'grave': drawGrave(sx, sy, t); break;
        case 'waystone': drawWaystone(sx, sy, t, time); break;
      }
    }
  }

  function drawTree(sx, sy, t, f, time) {
    const s = f.size;
    const cx = sx + t * .5, base = sy + t * .83;
    ctx.fillStyle = 'rgba(10,14,10,.28)';
    ctx.beginPath(); ctx.ellipse(cx, base + t * .02, t * .28 * s, t * .09 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2d1c';
    ctx.lineWidth = Math.max(1, t * .055 * s);
    ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx - t * .015, base - t * .28 * s); ctx.stroke();
    const shades = f.variant % 3 === 0 ? ['#364b31', '#435c39', '#526c40', '#607b47'] : f.variant % 3 === 1 ? ['#3d4d2e', '#4d6037', '#5c7040', '#6b7e47'] : ['#314831', '#3e573b', '#4d6745', '#5d794f'];
    const cy = base - t * .47 * s;
    const r = t * .25 * s;
    ctx.fillStyle = shades[0];
    ctx.beginPath(); ctx.arc(cx - r * .65, cy + r * .38, r * .83, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * .68, cy + r * .33, r * .8, 0, 7); ctx.fill();
    ctx.fillStyle = shades[1];
    ctx.beginPath(); ctx.arc(cx, cy - r * .18, r * 1.05, 0, 7); ctx.fill();
    ctx.fillStyle = shades[2];
    ctx.beginPath(); ctx.arc(cx - r * .22, cy - r * .45, r * .68, 0, 7); ctx.fill();
    ctx.fillStyle = shades[3];
    ctx.beginPath(); ctx.arc(cx - r * .42, cy - r * .62, r * .29, 0, 7); ctx.fill();
    if (f.amount < f.max) {
      ctx.fillStyle = '#3d2f20';
      ctx.fillRect(cx - t * .06, base - t * .05, t * .12, t * .07);
    }
  }

  function drawRock(sx, sy, t, f) {
    const s = f.size;
    ctx.fillStyle = 'rgba(10,10,9,.28)';
    ctx.beginPath(); ctx.ellipse(sx + t * .5, sy + t * .8, t * .3 * s, t * .1, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a5850';
    ctx.beginPath();
    ctx.moveTo(sx + t * .17, sy + t * .75);
    ctx.lineTo(sx + t * .25, sy + t * .38);
    ctx.lineTo(sx + t * .48, sy + t * .2 * s + .12 * t);
    ctx.lineTo(sx + t * .77, sy + t * .33);
    ctx.lineTo(sx + t * .85, sy + t * .72);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6d6b61';
    ctx.beginPath();
    ctx.moveTo(sx + t * .27, sy + t * .38);
    ctx.lineTo(sx + t * .48, sy + t * .22 * s + .12 * t);
    ctx.lineTo(sx + t * .67, sy + t * .41);
    ctx.lineTo(sx + t * .46, sy + t * .57);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(32,31,28,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + t * .48, sy + t * .22 * s + .12 * t); ctx.lineTo(sx + t * .44, sy + t * .7); ctx.stroke();
    if (f.amount < f.max) {
      ctx.fillStyle = '#45443d'; ctx.fillRect(sx + t * .32, sy + t * .72, t * .18, t * .05);
    }
  }

  function drawBush(sx, sy, t, f, time) {
    const s = f.size;
    const cx = sx + t * .5, cy = sy + t * .63;
    ctx.fillStyle = 'rgba(10,14,10,.2)';
    ctx.beginPath(); ctx.ellipse(cx, cy + t * .2, t * .25 * s, t * .07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#435a34';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(cx + Math.cos(i * 1.7) * t * .12 * s, cy + Math.sin(i * 1.7) * t * .06, t * .16 * s, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#5d7441';
    ctx.beginPath(); ctx.arc(cx - t * .06, cy - t * .08, t * .13 * s, 0, 7); ctx.fill();
    if (f.amount > 0) {
      ctx.fillStyle = f.amount < f.max ? '#8b5a43' : '#b46f4e';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(cx + (i - 1) * t * .13, cy + (i % 2) * t * .08 - t * .03, Math.max(1, t * .028), 0, 7); ctx.fill();
      }
    }
  }

  function drawCrystal(sx, sy, t, f, time) {
    const s = f.size;
    const cx = sx + t * .5, base = sy + t * .78;
    const glow = .5 + Math.sin(time * 2 + f.sway) * .2;
    const grd = ctx.createRadialGradient(cx, base - t * .2, 1, cx, base - t * .2, t * .42);
    grd.addColorStop(0, `rgba(167,118,211,${.25 + glow * .12})`);
    grd.addColorStop(1, 'rgba(167,118,211,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, base - t * .2, t * .42, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const ox = (i - 1.5) * t * .1 * s;
      const h = t * (.2 + (i % 2) * .12) * s;
      ctx.fillStyle = i % 2 ? '#9d72c0' : '#b78bd4';
      ctx.beginPath();
      ctx.moveTo(cx + ox, base);
      ctx.lineTo(cx + ox + t * .055, base - h);
      ctx.lineTo(cx + ox + t * .09, base);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(235,216,250,.5)';
      ctx.beginPath();
      ctx.moveTo(cx + ox + t * .055, base - h);
      ctx.lineTo(cx + ox + t * .07, base - h * .55);
      ctx.lineTo(cx + ox + t * .058, base - h * .35);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawRuinStone(sx, sy, t, f) {
    ctx.fillStyle = '#666257';
    ctx.fillRect(sx + t * .22, sy + t * .3, t * .22, t * .48);
    ctx.fillStyle = '#777266';
    ctx.fillRect(sx + t * .55, sy + t * .44, t * .19, t * .34);
    ctx.strokeStyle = 'rgba(35,33,28,.4)';
    ctx.beginPath(); ctx.moveTo(sx + t * .3, sy + t * .38); ctx.lineTo(sx + t * .36, sy + t * .65); ctx.stroke();
  }

  function drawGrave(sx, sy, t) {
    ctx.fillStyle = 'rgba(10,10,9,.3)';
    ctx.beginPath(); ctx.ellipse(sx + t * .5, sy + t * .8, t * .2, t * .06, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5b574d';
    ctx.beginPath();
    ctx.moveTo(sx + t * .34, sy + t * .78);
    ctx.lineTo(sx + t * .34, sy + t * .34);
    ctx.quadraticCurveTo(sx + t * .5, sy + t * .2, sx + t * .66, sy + t * .34);
    ctx.lineTo(sx + t * .66, sy + t * .78);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(201,161,92,.35)';
    ctx.beginPath(); ctx.moveTo(sx + t * .5, sy + t * .38); ctx.lineTo(sx + t * .5, sy + t * .62); ctx.moveTo(sx + t * .43, sy + t * .47); ctx.lineTo(sx + t * .57, sy + t * .47); ctx.stroke();
  }

  function drawWaystone(sx, sy, t, time) {
    const cx = sx + t * .5, base = sy + t * .8;
    const pulse = Math.sin(time * 1.6) * .15 + .55;
    const grd = ctx.createRadialGradient(cx, base - t * .35, 1, cx, base - t * .35, t * .6);
    grd.addColorStop(0, `rgba(167,118,211,${.2 * pulse})`);
    grd.addColorStop(1, 'rgba(167,118,211,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, base - t * .35, t * .6, 0, 7); ctx.fill();
    ctx.fillStyle = '#5e5b53';
    ctx.beginPath();
    ctx.moveTo(cx - t * .14, base);
    ctx.lineTo(cx - t * .1, sy + t * .22);
    ctx.lineTo(cx + t * .04, sy + t * .13);
    ctx.lineTo(cx + t * .13, sy + t * .3);
    ctx.lineTo(cx + t * .17, base);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(180,137,220,${.4 + pulse * .4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - t * .02, base - t * .14); ctx.lineTo(cx + t * .06, base - t * .28); ctx.lineTo(cx - t * .03, base - t * .4); ctx.lineTo(cx + t * .05, base - t * .53);
    ctx.stroke();
  }

  function drawBuildings(foreground) {
    const t = tilePx();
    const list = state.buildings.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const b of list) {
      const def = BUILDINGS[b.type];
      const tall = ['wall', 'palisade', 'watchtower', 'forge', 'tent'].includes(b.type);
      if (foreground !== tall) continue;
      const sx = (b.x - cam.x) * t + W / 2;
      const sy = (b.y - cam.y) * t + H / 2;
      if (sx < -t * 6 || sy < -t * 8 || sx > W + t * 4 || sy > H + t * 4) continue;
      drawBuilding(b, def, sx, sy, t);
    }
  }

  function drawBuilding(b, def, sx, sy, t) {
    const w = b.w * t, h = b.h * t;
    if (!b.complete) {
      ctx.fillStyle = 'rgba(201,161,92,.055)';
      ctx.fillRect(sx + 2, sy + 2, w - 4, h - 4);
      ctx.strokeStyle = 'rgba(233,201,135,.58)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(sx + 3, sy + 3, w - 6, h - 6);
      ctx.setLineDash([]);
      // scaffolding
      ctx.strokeStyle = 'rgba(176,137,81,.55)';
      ctx.beginPath();
      ctx.moveTo(sx + w * .18, sy + h * .85); ctx.lineTo(sx + w * .18, sy + h * .2);
      ctx.moveTo(sx + w * .82, sy + h * .85); ctx.lineTo(sx + w * .82, sy + h * .2);
      ctx.moveTo(sx + w * .12, sy + h * .36); ctx.lineTo(sx + w * .88, sy + h * .36);
      ctx.stroke();
      ctx.fillStyle = 'rgba(14,11,8,.8)';
      ctx.fillRect(sx + w * .22, sy + h * .88, w * .56, Math.max(3, t * .11));
      const grd = ctx.createLinearGradient(sx, 0, sx + w, 0);
      grd.addColorStop(0, '#9d7947'); grd.addColorStop(1, '#e9c987');
      ctx.fillStyle = grd;
      ctx.fillRect(sx + w * .22, sy + h * .88, w * .56 * ((b.progress || 0) / 100), Math.max(3, t * .11));
      ctx.fillStyle = 'rgba(233,201,135,.9)';
      ctx.font = `${Math.max(7, t * .22)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(def.name, sx + w / 2, sy + h * .15);
      return;
    }
    ctx.save();
    switch (b.type) {
      case 'bed': {
        ctx.fillStyle = 'rgba(10,9,7,.3)';
        ctx.beginPath(); ctx.ellipse(sx + w * .5, sy + h * .82, w * .42, h * .09, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#4e3a26';
        ctx.fillRect(sx + w * .13, sy + h * .2, w * .74, h * .64);
        ctx.fillStyle = '#796044';
        ctx.fillRect(sx + w * .17, sy + h * .24, w * .66, h * .54);
        ctx.fillStyle = '#8e6d4c';
        ctx.fillRect(sx + w * .2, sy + h * .42, w * .6, h * .35);
        ctx.fillStyle = '#d2c39f';
        ctx.fillRect(sx + w * .22, sy + h * .27, w * .25, h * .17);
        ctx.strokeStyle = 'rgba(38,28,18,.45)';
        ctx.strokeRect(sx + w * .13, sy + h * .2, w * .74, h * .64);
        break;
      }
      case 'tent': {
        ctx.fillStyle = 'rgba(10,9,7,.3)';
        ctx.beginPath(); ctx.ellipse(sx + w * .5, sy + h * .88, w * .43, h * .08, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#726147';
        ctx.beginPath(); ctx.moveTo(sx + w * .5, sy + h * .08); ctx.lineTo(sx + w * .94, sy + h * .84); ctx.lineTo(sx + w * .06, sy + h * .84); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8b7856';
        ctx.beginPath(); ctx.moveTo(sx + w * .5, sy + h * .11); ctx.lineTo(sx + w * .78, sy + h * .8); ctx.lineTo(sx + w * .5, sy + h * .8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1c1711';
        ctx.beginPath(); ctx.moveTo(sx + w * .5, sy + h * .35); ctx.lineTo(sx + w * .63, sy + h * .8); ctx.lineTo(sx + w * .37, sy + h * .8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a28e68'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx + w * .5, sy + h * .06); ctx.lineTo(sx + w * .5, sy + h * .1); ctx.stroke();
        break;
      }
      case 'campfire': {
        const time = state.simTime + performance.now() / 1000;
        const cx = sx + w * .5, cy = sy + h * .63;
        const grd = ctx.createRadialGradient(cx, cy, t * .05, cx, cy, t * 2.2);
        grd.addColorStop(0, 'rgba(244,170,76,.32)');
        grd.addColorStop(.4, 'rgba(214,114,48,.1)');
        grd.addColorStop(1, 'rgba(214,114,48,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, t * 2.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#4e4a40';
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * 6.28;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * t * .24, cy + Math.sin(a) * t * .11, t * .045, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = '#3a2a1b'; ctx.lineWidth = t * .06;
        ctx.beginPath(); ctx.moveTo(cx - t * .15, cy + t * .05); ctx.lineTo(cx + t * .15, cy - t * .06); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - t * .13, cy - t * .06); ctx.lineTo(cx + t * .14, cy + t * .06); ctx.stroke();
        const flick = Math.sin(time * 12) * .04;
        ctx.fillStyle = '#d76b36';
        ctx.beginPath();
        ctx.moveTo(cx - t * .13, cy);
        ctx.quadraticCurveTo(cx - t * .18, cy - t * .25, cx + flick * t, cy - t * .6 - Math.sin(time * 6) * t * .06);
        ctx.quadraticCurveTo(cx + t * .18, cy - t * .22, cx + t * .13, cy);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2bd62';
        ctx.beginPath();
        ctx.moveTo(cx - t * .07, cy);
        ctx.quadraticCurveTo(cx - t * .08, cy - t * .2, cx + flick * t * .3, cy - t * .37);
        ctx.quadraticCurveTo(cx + t * .09, cy - t * .15, cx + t * .07, cy);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'stockpile': {
        ctx.fillStyle = 'rgba(10,9,7,.18)';
        ctx.fillRect(sx + 3, sy + 3, w - 6, h - 6);
        ctx.strokeStyle = 'rgba(194,162,104,.14)'; ctx.lineWidth = 1;
        ctx.strokeRect(sx + 4, sy + 4, w - 8, h - 8);
        for (let i = 0; i < 4; i++) {
          const bx = sx + t * (.18 + (i % 2) * .38);
          const by = sy + t * (.18 + Math.floor(i / 2) * .4);
          ctx.fillStyle = ['#6f5232', '#7d5e3a', '#5a452c', '#86653e'][i];
          ctx.fillRect(bx, by, t * .29, t * .27);
          ctx.strokeStyle = '#3e2d1b'; ctx.strokeRect(bx, by, t * .29, t * .27);
          ctx.strokeStyle = 'rgba(201,161,92,.35)';
          ctx.beginPath(); ctx.moveTo(bx, by + t * .13); ctx.lineTo(bx + t * .29, by + t * .13); ctx.stroke();
        }
        break;
      }
      case 'farm': {
        const crop = b.crop || 0;
        ctx.fillStyle = 'rgba(285,205,106,.03)';
        if (crop > .1) {
          ctx.strokeStyle = crop >= 1 ? '#c9b35c' : crop > .55 ? '#8f9b4f' : '#5f753f';
          ctx.lineWidth = Math.max(.8, t * .025);
          for (let row = 0; row < 3; row++) {
            const yy = sy + t * (.27 + row * .23);
            for (let i = 0; i < 4; i++) {
              const xx = sx + t * (.13 + i * .22);
              ctx.beginPath(); ctx.moveTo(xx, yy + t * .05); ctx.lineTo(xx + t * .02, yy - t * .1 * crop); ctx.stroke();
              if (crop > .55) {
                ctx.fillStyle = crop >= 1 ? '#dec56d' : '#a8b34f';
                ctx.beginPath(); ctx.arc(xx + t * .02, yy - t * .1 * crop, Math.max(1, t * .025), 0, 7); ctx.fill();
              }
            }
          }
        }
        break;
      }
      case 'workbench': {
        ctx.fillStyle = '#4d3823';
        ctx.fillRect(sx + t * .12, sy + t * .34, t * .76, t * .19);
        ctx.fillStyle = '#6d5030';
        ctx.fillRect(sx + t * .16, sy + t * .37, t * .68, t * .11);
        ctx.fillStyle = '#3d2b1b';
        ctx.fillRect(sx + t * .2, sy + t * .53, t * .07, t * .3);
        ctx.fillRect(sx + t * .73, sy + t * .53, t * .07, t * .3);
        ctx.strokeStyle = '#a8a09a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx + t * .62, sy + t * .34); ctx.lineTo(sx + t * .7, sy + t * .22); ctx.stroke();
        ctx.fillStyle = '#7f817a';
        ctx.beginPath(); ctx.moveTo(sx + t * .67, sy + t * .29); ctx.lineTo(sx + t * .76, sy + t * .35); ctx.lineTo(sx + t * .67, sy + t * .37); ctx.closePath(); ctx.fill();
        break;
      }
      case 'researchDesk': {
        ctx.fillStyle = '#4b3825';
        ctx.fillRect(sx + t * .1, sy + t * .33, t * .8, t * .17);
        ctx.fillStyle = '#6f5437';
        ctx.fillRect(sx + t * .14, sy + t * .35, t * .72, t * .1);
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(sx + t * .18, sy + t * .5, t * .05, t * .32);
        ctx.fillRect(sx + t * .77, sy + t * .5, t * .05, t * .32);
        ctx.fillStyle = '#c8bd9d';
        ctx.beginPath(); ctx.moveTo(sx + t * .36, sy + t * .35); ctx.lineTo(sx + t * .48, sy + t * .35); ctx.lineTo(sx + t * .45, sy + t * .27); ctx.lineTo(sx + t * .34, sy + t * .27); ctx.closePath(); ctx.fill();
        const pulse = .7 + Math.sin(state.simTime * 2) * .2;
        ctx.fillStyle = `rgba(167,118,211,${pulse})`;
        ctx.beginPath(); ctx.arc(sx + t * .65, sy + t * .27, t * .045, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(167,118,211,.15)`;
        ctx.beginPath(); ctx.arc(sx + t * .65, sy + t * .27, t * .15, 0, 7); ctx.fill();
        break;
      }
      case 'palisade': {
        ctx.fillStyle = 'rgba(10,9,7,.25)';
        ctx.fillRect(sx + t * .1, sy + t * .7, t * .8, t * .12);
        for (let i = 0; i < 4; i++) {
          const xx = sx + t * (.14 + i * .2);
          ctx.fillStyle = i % 2 ? '#5e4329' : '#6d4f30';
          ctx.beginPath();
          ctx.moveTo(xx, sy + t * .86);
          ctx.lineTo(xx + t * .03, sy + t * .12);
          ctx.lineTo(xx + t * .16, sy + t * .06);
          ctx.lineTo(xx + t * .19, sy + t * .86);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(36,24,13,.5)'; ctx.stroke();
        }
        ctx.fillStyle = '#49331f';
        ctx.fillRect(sx + t * .08, sy + t * .39, t * .84, t * .06);
        break;
      }
      case 'watchtower': {
        ctx.fillStyle = 'rgba(10,9,7,.3)';
        ctx.beginPath(); ctx.ellipse(sx + w * .5, sy + h * .9, w * .38, h * .06, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#4b3926';
        ctx.fillRect(sx + w * .16, sy + h * .3, w * .12, h * .55);
        ctx.fillRect(sx + w * .72, sy + h * .3, w * .12, h * .55);
        ctx.fillStyle = '#6b4f33';
        ctx.fillRect(sx + w * .08, sy + h * .2, w * .84, h * .14);
        ctx.fillRect(sx + w * .12, sy + h * .5, w * .76, h * .08);
        ctx.fillStyle = '#3b2a1c';
        ctx.fillRect(sx + w * .3, sy + h * .53, w * .4, h * .3);
        ctx.fillStyle = 'rgba(233,201,135,.2)';
        ctx.beginPath(); ctx.arc(sx + w * .5, sy + h * .62, w * .12, 0, 7); ctx.fill();
        ctx.strokeStyle = '#87795e'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx + w * .5, sy + h * .2); ctx.lineTo(sx + w * .5, sy + h * .05); ctx.stroke();
        break;
      }
      case 'infirmary': {
        ctx.fillStyle = '#5b4a33';
        ctx.fillRect(sx + t * .13, sy + t * .24, t * .74, t * .58);
        ctx.fillStyle = '#b9ad8d';
        ctx.fillRect(sx + t * .17, sy + t * .28, t * .66, t * .5);
        ctx.fillStyle = '#d5c8a6';
        ctx.fillRect(sx + t * .22, sy + t * .32, t * .2, t * .13);
        ctx.fillStyle = '#8e3d35';
        ctx.fillRect(sx + t * .55, sy + t * .48, t * .16, t * .05);
        ctx.fillRect(sx + t * .605, sy + t * .425, t * .05, t * .16);
        break;
      }
      case 'forge': {
        ctx.fillStyle = 'rgba(10,9,7,.3)';
        ctx.fillRect(sx + w * .1, sy + h * .72, w * .8, h * .16);
        ctx.fillStyle = '#56524a';
        ctx.fillRect(sx + w * .12, sy + h * .3, w * .3, h * .52);
        ctx.fillStyle = '#68635a';
        ctx.fillRect(sx + w * .16, sy + h * .26, w * .22, h * .08);
        ctx.fillStyle = '#2f2c28';
        ctx.beginPath(); ctx.arc(sx + w * .27, sy + h * .58, w * .09, 0, 7); ctx.fill();
        const fire = .55 + Math.sin(state.simTime * 7) * .15;
        ctx.fillStyle = `rgba(235,123,57,${fire})`;
        ctx.beginPath(); ctx.arc(sx + w * .27, sy + h * .58, w * .055, 0, 7); ctx.fill();
        ctx.fillStyle = '#493a2a';
        ctx.fillRect(sx + w * .52, sy + h * .53, w * .32, h * .09);
        ctx.fillRect(sx + w * .56, sy + h * .62, w * .06, h * .2);
        ctx.fillRect(sx + w * .74, sy + h * .62, w * .06, h * .2);
        break;
      }
      case 'shrine': {
        const pulse = .55 + Math.sin(state.simTime * 1.8) * .22;
        const cx = sx + w / 2, cy = sy + h / 2;
        const grd = ctx.createRadialGradient(cx, cy, 2, cx, cy, w * .65);
        grd.addColorStop(0, `rgba(167,118,211,${.24 * pulse})`);
        grd.addColorStop(1, 'rgba(167,118,211,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, w * .65, 0, 7); ctx.fill();
        ctx.strokeStyle = '#77736a'; ctx.lineWidth = Math.max(2, t * .08);
        ctx.beginPath(); ctx.ellipse(cx, cy + h * .18, w * .4, h * .24, 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * 6.28 + state.simTime * .08;
          ctx.fillStyle = i % 2 ? '#716d63' : '#858076';
          ctx.fillRect(cx + Math.cos(a) * w * .43 - t * .06, cy + Math.sin(a) * h * .28 - t * .2, t * .12, t * .35);
        }
        ctx.fillStyle = '#8b8679';
        ctx.beginPath(); ctx.moveTo(cx - w * .12, cy + h * .25); ctx.lineTo(cx - w * .06, cy - h * .28); ctx.lineTo(cx + w * .04, cy - h * .34); ctx.lineTo(cx + w * .12, cy - h * .2); ctx.lineTo(cx + w * .16, cy + h * .25); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(176,131,214,${.4 + pulse * .4})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, cy + h * .15); ctx.lineTo(cx + w * .02, cy - h * .02); ctx.lineTo(cx - w * .03, cy - h * .13); ctx.lineTo(cx + w * .03, cy - h * .26); ctx.stroke();
        break;
      }
      case 'herbGarden': {
        ctx.fillStyle = 'rgba(32,24,15,.18)'; ctx.fillRect(sx + 3, sy + 3, w - 6, h - 6);
        for (let i = 0; i < 6; i++) {
          const xx = sx + t * (.22 + (i % 3) * .26);
          const yy = sy + t * (.3 + Math.floor(i / 3) * .34);
          ctx.strokeStyle = '#617544'; ctx.beginPath(); ctx.moveTo(xx, yy + t * .12); ctx.lineTo(xx, yy); ctx.stroke();
          ctx.fillStyle = i % 2 ? '#7b9259' : '#677e4b';
          ctx.beginPath(); ctx.arc(xx - 2, yy, t * .05, 0, 7); ctx.arc(xx + 2, yy - 2, t * .045, 0, 7); ctx.fill();
        }
        break;
      }
      case 'runeWard': {
        const pulse = .4 + Math.sin(state.simTime * 3) * .25;
        ctx.strokeStyle = `rgba(167,118,211,${pulse + .2})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, w * .3, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx + w / 2, sy + h * .2); ctx.lineTo(sx + w * .78, sy + h * .7); ctx.lineTo(sx + w * .22, sy + h * .7); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = `rgba(167,118,211,${pulse})`; ctx.beginPath(); ctx.arc(sx + w / 2, sy + h / 2, t * .04, 0, 7); ctx.fill();
        break;
      }
      case 'well': {
        ctx.fillStyle = '#514d45';
        ctx.beginPath(); ctx.ellipse(sx + w * .5, sy + h * .72, w * .3, h * .13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a3435';
        ctx.beginPath(); ctx.ellipse(sx + w * .5, sy + h * .67, w * .22, h * .09, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#5f4930'; ctx.lineWidth = t * .06;
        ctx.beginPath(); ctx.moveTo(sx + w * .2, sy + h * .65); ctx.lineTo(sx + w * .2, sy + h * .22); ctx.lineTo(sx + w * .8, sy + h * .22); ctx.lineTo(sx + w * .8, sy + h * .65); ctx.stroke();
        ctx.fillStyle = '#6d5536';
        ctx.beginPath(); ctx.moveTo(sx + w * .14, sy + h * .24); ctx.lineTo(sx + w * .5, sy + h * .06); ctx.lineTo(sx + w * .86, sy + h * .24); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#94774c';
        ctx.fillRect(sx + w * .46, sy + h * .3, w * .08, h * .15);
        break;
      }
    }
    ctx.restore();
    if (b.type !== 'farm' && b.type !== 'stockpile' && b.type !== 'runeWard') {
      ctx.fillStyle = 'rgba(233,201,135,.35)';
      ctx.font = `${Math.max(6, t * .16)}px Georgia, serif`;
      ctx.textAlign = 'center';
      // Only labels when zoomed in and selected.
      if (state.selected?.id === b.id) ctx.fillText(def.name, sx + w / 2, sy - 5);
    }
  }

  function drawColonists() {
    const t = tilePx();
    const list = state.colonists.filter(c => !c.onExpedition).sort((a, b) => a.y - b.y);
    for (const c of list) {
      if (c.dead) continue;
      const sx = (c.x - cam.x) * t + W / 2;
      const sy = (c.y - cam.y) * t + H / 2;
      if (sx < -t * 2 || sy < -t * 2 || sx > W + t * 2 || sy > H + t * 2) continue;
      const selected = state.selected?.kind === 'colonist' && state.selected.id === c.id;
      const bob = c.job?.phase === 'moving' ? Math.sin(c.movePhase) * t * .025 : 0;
      ctx.save();
      ctx.translate(sx, sy + bob);
      // shadow
      ctx.fillStyle = 'rgba(8,8,6,.32)';
      ctx.beginPath(); ctx.ellipse(0, t * .29, t * .2, t * .07, 0, 0, 7); ctx.fill();
      if (c.downed) {
        ctx.rotate(-Math.PI / 2);
        drawPawn(c, t, true);
      } else {
        drawPawn(c, t, false);
      }
      ctx.restore();

      if (selected) {
        ctx.strokeStyle = 'rgba(233,201,135,.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.ellipse(sx, sy + t * .27, t * .28, t * .11, 0, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(233,201,135,.16)';
        ctx.beginPath(); ctx.ellipse(sx, sy + t * .27, t * .38, t * .15, 0, 0, 7); ctx.stroke();
      }
      // name
      if (cam.zoom > .82) {
        ctx.font = `${Math.max(7, t * .19)}px Georgia, serif`;
        ctx.textAlign = 'center';
        const tw = ctx.measureText(c.first).width;
        ctx.fillStyle = 'rgba(12,10,8,.62)';
        ctx.fillRect(sx - tw / 2 - 3, sy - t * .84, tw + 6, t * .26);
        ctx.fillStyle = selected ? '#f2dfb8' : 'rgba(230,212,174,.82)';
        ctx.fillText(c.first, sx, sy - t * .66);
      }
      // health/progress
      const hurt = c.hp < c.maxHp * .95 || c.bleeding > 0 || c.downed;
      if (hurt) {
        const bw = t * .38;
        ctx.fillStyle = 'rgba(10,8,6,.65)';
        ctx.fillRect(sx - bw / 2, sy - t * 1.02, bw, Math.max(2, t * .045));
        ctx.fillStyle = c.downed ? '#9a4134' : '#9b6c5c';
        ctx.fillRect(sx - bw / 2, sy - t * 1.02, bw * Math.max(0, c.hp / c.maxHp), Math.max(2, t * .045));
      }
      if (c.job && c.job.phase === 'working' && c.job.type !== 'idle' && c.job.duration) {
        const bw = t * .34;
        const ratio = Math.min(1, c.job.progress / c.job.duration);
        ctx.fillStyle = 'rgba(10,8,6,.55)'; ctx.fillRect(sx - bw / 2, sy + t * .37, bw, Math.max(1.5, t * .035));
        ctx.fillStyle = '#c9a15c'; ctx.fillRect(sx - bw / 2, sy + t * .37, bw * ratio, Math.max(1.5, t * .035));
      }
      // status icon
      const icon = statusIcon(c);
      if (icon && !c.downed) {
        ctx.fillStyle = 'rgba(18,14,10,.82)';
        ctx.beginPath(); ctx.arc(sx + t * .23, sy - t * .55, t * .12, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(201,161,92,.35)'; ctx.lineWidth = .7; ctx.stroke();
        ctx.fillStyle = icon.color || '#c9a15c';
        ctx.font = `${Math.max(6, t * .15)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(icon.glyph, sx + t * .23, sy - t * .5);
      }
      if (c.mood < 20 && !c.downed) {
        ctx.fillStyle = '#c27f6c';
        ctx.font = `${Math.max(8, t * .2)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', sx - t * .24, sy - t * .55);
      }
    }
  }

  function drawPawn(c, t, downed) {
    const cls = CLASSES[c.cls];
    const facing = c.facing || 1;
    if (downed) {
      ctx.fillStyle = c.skin;
      ctx.beginPath(); ctx.arc(t * .18, 0, t * .1, 0, 7); ctx.fill();
      ctx.fillStyle = cls.color;
      ctx.beginPath(); ctx.ellipse(-t * .04, 0, t * .22, t * .16, 0, 0, 7); ctx.fill();
      return;
    }
    // legs
    ctx.fillStyle = '#2f261c';
    ctx.fillRect(-t * .07, t * .12, t * .05, t * .14);
    ctx.fillRect(t * .02, t * .12, t * .05, t * .14);
    // cloak
    ctx.fillStyle = cls.color;
    ctx.beginPath();
    ctx.moveTo(-t * .13, t * .15);
    ctx.quadraticCurveTo(-t * .2, -t * .08, -t * .1, -t * .2);
    ctx.lineTo(t * .1, -t * .2);
    ctx.quadraticCurveTo(t * .2, -t * .08, t * .13, t * .15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.moveTo(-t * .08, -t * .14);
    ctx.lineTo(-t * .01, -t * .14);
    ctx.lineTo(-t * .03, t * .1);
    ctx.lineTo(-t * .1, t * .1);
    ctx.closePath(); ctx.fill();
    // arms
    ctx.strokeStyle = c.skin;
    ctx.lineWidth = Math.max(1.3, t * .055);
    ctx.beginPath();
    ctx.moveTo(-t * .12, -t * .08); ctx.lineTo(-t * .16, t * .06);
    ctx.moveTo(t * .12, -t * .08); ctx.lineTo(t * .15, t * .06);
    ctx.stroke();
    // head
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(0, -t * .29, t * .098, 0, 7); ctx.fill();
    ctx.fillStyle = c.race === 'dwarf' ? '#5a3c24' : c.race === 'tiefling' ? '#3a2020' : c.race === 'elf' ? '#b0a37c' : '#31251b';
    ctx.beginPath(); ctx.arc(0, -t * .315, t * .1, Math.PI, 0); ctx.fill();
    if (c.race === 'dwarf') { ctx.fillStyle = '#6a4b2d'; ctx.fillRect(-t * .07, -t * .22, t * .14, t * .08); }
    // weapon / focus
    if (cls.ranged) {
      ctx.strokeStyle = '#bc9a66';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(facing * t * .16, -t * .03, t * .1, -1.2, 1.2); ctx.stroke();
    } else {
      ctx.strokeStyle = '#b9b2a3';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(facing * t * .15, t * .1);
      ctx.lineTo(facing * t * .21, -t * .17);
      ctx.stroke();
      ctx.fillStyle = '#775e3e';
      ctx.fillRect(facing * t * .145 - 1, -t * .03, t * .05, t * .03);
    }
    ctx.fillStyle = 'rgba(233,201,135,.5)';
    ctx.beginPath(); ctx.arc(-facing * t * .03, -t * .3, t * .018, 0, 7); ctx.fill();
  }

  function statusIcon(c) {
    if (c.downed) return { glyph: '✚', color: '#d39080' };
    if (c.bleeding > 0) return { glyph: '✚', color: '#c77d6b' };
    const j = c.job?.type;
    if (j === 'sleep') return { glyph: 'z', color: '#8fa8b1' };
    if (j === 'eat') return { glyph: '•', color: '#c9a15c' };
    if (j === 'fight') return { glyph: '⚔', color: '#d39080' };
    if (j === 'cook') return { glyph: '♨', color: '#e0a866' };
    if (j === 'construct') return { glyph: '⚒', color: '#c9a15c' };
    if (j === 'research') return { glyph: '✦', color: '#c79ae8' };
    if (j === 'doctor') return { glyph: '✚', color: '#9eb080' };
    if (j === 'gather') return { glyph: '❦', color: '#aebd76' };
    if (j === 'plant' || j === 'harvest') return { glyph: '❧', color: '#a8b981' };
    if (j === 'craft') return { glyph: '⚒', color: '#d7b477' };
    if (c.breakTimer > 0) return { glyph: '!', color: '#d39080' };
    return null;
  }

  function drawEnemies() {
    const t = tilePx();
    for (const e of state.enemies) {
      if (e.dead) continue;
      const sx = (e.x - cam.x) * t + W / 2;
      const sy = (e.y - cam.y) * t + H / 2;
      if (sx < -t * 2 || sy < -t * 2 || sx > W + t * 2 || sy > H + t * 2) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(8,8,6,.36)';
      ctx.beginPath(); ctx.ellipse(0, t * .29, t * .22, t * .08, 0, 0, 7); ctx.fill();
      if (e.hitFlash > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; }
      drawEnemyShape(e, t);
      ctx.restore();
      const bw = t * .4;
      ctx.fillStyle = 'rgba(10,7,6,.7)'; ctx.fillRect(sx - bw / 2, sy - t * .67, bw, Math.max(2, t * .05));
      ctx.fillStyle = '#a34839'; ctx.fillRect(sx - bw / 2, sy - t * .67, bw * Math.max(0, e.hp / e.maxHp), Math.max(2, t * .05));
      m: {
        // hostility marker
        ctx.fillStyle = 'rgba(163,72,57,.9)';
        ctx.beginPath(); ctx.arc(sx, sy - t * .78, t * .08, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0d1c2'; ctx.font = `bold ${Math.max(6, t * .13)}px Georgia, serif`; ctx.textAlign = 'center';
        ctx.fillText('!', sx, sy - t * .735);
      }
      if (state.selected?.kind === 'enemy' && state.selected.id === e.id) {
        ctx.strokeStyle = 'rgba(163,72,57,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sx, sy + t * .28, t * .3, t * .12, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = '#e6d4ae'; ctx.font = `${Math.max(8, t * .2)}px Georgia, serif`; ctx.textAlign = 'center';
        ctx.fillText(e.name, sx, sy - t * .9);
      }
    }
  }

  function drawEnemyShape(e, t) {
    const f = e.facing || 1;
    if (e.shape === 'wolf') {
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, t * .05, t * .23, t * .11, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(f * t * .2, -t * .04, t * .1, 0, 7); ctx.fill();
      ctx.fillStyle = e.accent;
      ctx.beginPath(); ctx.moveTo(f * t * .18, -t * .1); ctx.lineTo(f * t * .14, -t * .19); ctx.lineTo(f * t * .24, -t * .12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d3c8b2'; ctx.beginPath(); ctx.arc(f * t * .24, -t * .04, t * .012, 0, 7); ctx.fill();
      ctx.strokeStyle = e.color; ctx.lineWidth = t * .035;
      ctx.beginPath(); ctx.moveTo(-t * .2, 0); ctx.lineTo(-t * .34, -t * .09); ctx.stroke();
    } else if (e.shape === 'skeleton') {
      ctx.strokeStyle = e.color; ctx.lineWidth = t * .035;
      ctx.beginPath(); ctx.moveTo(0, -t * .13); ctx.lineTo(0, t * .13); ctx.stroke();
      ctx.fillStyle = e.accent;
      ctx.beginPath(); ctx.arc(0, -t * .25, t * .1, 0, 7); ctx.fill();
      ctx.fillStyle = '#2d2622'; ctx.fillRect(-t * .05, -t * .26, t * .025, t * .025); ctx.fillRect(t * .025, -t * .26, t * .025, t * .025);
      ctx.strokeStyle = e.color;
      ctx.beginPath(); ctx.moveTo(-t * .13, -t * .08); ctx.lineTo(0, -t * .03); ctx.lineTo(t * .13, -t * .1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-t * .09, t * .13); ctx.lineTo(0, t * .02); ctx.lineTo(t * .1, t * .14); ctx.stroke();
    } else if (e.shape === 'cultist') {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -t * .32); ctx.lineTo(t * .2, t * .17); ctx.lineTo(-t * .2, t * .17); ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.accent;
      ctx.beginPath(); ctx.arc(0, -t * .31, t * .09, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1a26'; ctx.beginPath(); ctx.arc(0, -t * .28, t * .065, 0, 7); ctx.fill();
      ctx.fillStyle = '#d17c7c'; ctx.beginPath(); ctx.arc(-t * .022, -t * .29, t * .012, 0, 7); ctx.arc(t * .022, -t * .29, t * .012, 0, 7); ctx.fill();
      ctx.strokeStyle = '#a9779b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(f * t * .22, -t * .01, t * .08, 0, 7); ctx.stroke();
    } else if (e.shape === 'ogre') {
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, t * .03, t * .26, t * .24, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.accent;
      ctx.beginPath(); ctx.arc(0, -t * .28, t * .12, 0, 7); ctx.fill();
      ctx.fillStyle = '#3d3423';
      ctx.beginPath(); ctx.arc(-t * .035, -t * .3, t * .014, 0, 7); ctx.arc(t * .04, -t * .3, t * .014, 0, 7); ctx.fill();
      ctx.fillStyle = '#6a563a';
      ctx.fillRect(-t * .16, -t * .08, t * .09, t * .23);
      ctx.fillRect(t * .08, -t * .08, t * .09, t * .23);
      ctx.strokeStyle = '#5a4b35'; ctx.lineWidth = t * .05;
      ctx.beginPath(); ctx.moveTo(f * t * .18, -t * .1); ctx.lineTo(f * t * .32, t * .14); ctx.stroke();
    } else if (e.shape === 'wraith') {
      const grd = ctx.createRadialGradient(0, 0, 1, 0, 0, t * .36);
      grd.addColorStop(0, 'rgba(176,202,202,.55)'); grd.addColorStop(1, 'rgba(101,117,124,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(0, 0, t * .36, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(145,174,176,.55)';
      ctx.beginPath(); ctx.moveTo(0, -t * .32); ctx.quadraticCurveTo(t * .25, -t * .05, t * .13, t * .18); ctx.quadraticCurveTo(0, t * .05, -t * .13, t * .18); ctx.quadraticCurveTo(-t * .25, -t * .05, 0, -t * .32); ctx.fill();
      ctx.fillStyle = '#e5f1ee'; ctx.fillRect(-t * .055, -t * .23, t * .035, t * .02); ctx.fillRect(t * .025, -t * .23, t * .035, t * .02);
    } else {
      // goblin
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.ellipse(0, t * .06, t * .17, t * .19, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.accent;
      ctx.beginPath(); ctx.arc(0, -t * .2, t * .12, 0, 7); ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.moveTo(-t * .09, -t * .26); ctx.lineTo(-t * .19, -t * .38); ctx.lineTo(-t * .04, -t * .31); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(t * .09, -t * .26); ctx.lineTo(t * .19, -t * .38); ctx.lineTo(t * .04, -t * .31); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#271c1c'; ctx.beginPath(); ctx.arc(-t * .04, -t * .22, t * .012, 0, 7); ctx.arc(t * .04, -t * .22, t * .012, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b7b0a0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(f * t * .18, t * .14); ctx.lineTo(f * t * .24, -t * .15); ctx.stroke();
    }
  }

  function drawProjectiles() {
    const t = tilePx();
    for (const p of state.projectiles) {
      const sx = (p.x - cam.x) * t + W / 2;
      const sy = (p.y - cam.y) * t + H / 2;
      const tx = (p.tx - cam.x) * t + W / 2;
      const ty = (p.ty - cam.y) * t + H / 2;
      if (p.type === 'orb') {
        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, t * .25);
        grd.addColorStop(0, p.color); grd.addColorStop(1, 'rgba(167,118,211,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(sx, sy, t * .25, 0, 7); ctx.fill();
        ctx.fillStyle = '#f0e3ff'; ctx.beginPath(); ctx.arc(sx, sy, t * .04, 0, 7); ctx.fill();
      } else {
        const a = Math.atan2(ty - sy, tx - sx);
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - Math.cos(a) * t * .17, sy - Math.sin(a) * t * .17); ctx.stroke();
      }
    }
  }

  function drawParticles() {
    const t = tilePx();
    for (const p of state.particles) {
      const a = Math.max(0, p.life / p.max);
      const sx = (p.x - cam.x) * t + W / 2;
      const sy = (p.y - cam.y) * t + H / 2;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.size * cam.zoom, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    const t = tilePx();
    for (const f of state.floats) {
      const sx = (f.x - cam.x) * t + W / 2;
      const sy = (f.y - cam.y) * t + H / 2;
      ctx.globalAlpha = Math.min(1, f.ttl / f.max * 1.6);
      ctx.font = `${Math.max(8, t * .25)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,8,6,.55)';
      ctx.fillText(f.text, sx + 1, sy + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  function drawLighting() {
    const hour = state.time.hour;
    let dark = 0;
    if (hour < 5) dark = .48;
    else if (hour < 7) dark = lerp(.48, 0, (hour - 5) / 2);
    else if (hour < 18) dark = 0;
    else if (hour < 21) dark = lerp(0, .46, (hour - 18) / 3);
    else dark = .46;
    if (state.time.weather === 'Eclipse') dark = Math.max(dark, .33);
    if (dark > 0) {
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, `rgba(10,16,28,${dark * .95})`);
      grd.addColorStop(1, `rgba(8,11,19,${dark * .72})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      // firelight
      const t = tilePx();
      for (const b of state.buildings) {
        if (!b.complete) continue;
        if (!['campfire', 'forge', 'shrine'].includes(b.type)) continue;
        const sx = (b.x + b.w / 2 - cam.x) * t + W / 2;
        const sy = (b.y + b.h / 2 - cam.y) * t + H / 2;
        const radius = (b.type === 'shrine' ? 3.3 : 2.9) * t;
        const col = b.type === 'shrine' ? '167,118,211' : '235,151,74';
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
        glow.addColorStop(0, `rgba(${col},${b.type === 'shrine' ? .22 : .28})`);
        glow.addColorStop(.4, `rgba(${col},${b.type === 'shrine' ? .09 : .12})`);
        glow.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy, radius, 0, 7); ctx.fill();
      }
      // fireflies
      if (hour > 19 || hour < 5) {
        for (const f of fireflies) {
          const x = ((f.x + Math.sin(state.simTime * .1 + f.p) * .02 + 1) % 1) * W;
          const y = ((f.y + Math.cos(state.simTime * .08 + f.p) * .02 + 1) % 1) * H * .78 + H * .08;
          const a = .2 + Math.sin(state.simTime * f.s * 3 + f.p) * .16;
          if (a <= 0) continue;
          ctx.fillStyle = `rgba(233,201,135,${a})`;
          ctx.beginPath(); ctx.arc(x, y, 1.2, 0, 7); ctx.fill();
        }
      }
    }
  }

  function drawWeather() {
    const weather = state.time.weather;
    if (weather.includes('rain') || weather.includes('sleet') || weather.includes('Mist')) {
      const raining = weather.includes('rain');
      if (raining) {
        ctx.strokeStyle = weather.includes('sleet') ? 'rgba(190,210,215,.24)' : 'rgba(170,194,200,.2)';
        ctx.lineWidth = 1;
        const speed = weather.includes('sleet') ? .55 : .95;
        for (const r of rainSeeds) {
          const x = (r.x * W + state.simTime * 12 * r.s) % W;
          const y = (r.y * H + state.simTime * 310 * speed * r.s) % H;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + r.l * H * .38); ctx.stroke();
        }
      }
      const mist = ctx.createLinearGradient(0, 0, 0, H);
      mist.addColorStop(0, 'rgba(183,198,193,.02)');
      mist.addColorStop(.6, 'rgba(183,198,193,.075)');
      mist.addColorStop(1, 'rgba(183,198,193,.12)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, 0, W, H);
    }
    if (weather === 'Eclipse') {
      const grd = ctx.createRadialGradient(W * .5, H * .4, 0, W * .5, H * .4, W * .7);
      grd.addColorStop(0, 'rgba(36,4,28,.06)');
      grd.addColorStop(1, 'rgba(22,0,18,.42)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawSelectionAndGhost() {
    const t = tilePx();
    if (state.hover) {
      const { x, y } = state.hover;
      const sx = (x - cam.x) * t + W / 2;
      const sy = (y - cam.y) * t + H / 2;
      if (state.buildMode) {
        const def = BUILDINGS[state.buildMode.type];
        const check = state.placeCheck;
        const ok = check?.ok;
        ctx.fillStyle = ok ? 'rgba(115,140,91,.2)' : 'rgba(163,72,57,.22)';
        ctx.strokeStyle = ok ? 'rgba(166,197,131,.8)' : 'rgba(211,125,104,.75)';
        ctx.lineWidth = 1;
        ctx.fillRect(sx, sy, def.w * t, def.h * t);
        ctx.strokeRect(sx + .5, sy + .5, def.w * t - 1, def.h * t - 1);
        // ghost silhouette
        ctx.globalAlpha = .4;
        ctx.fillStyle = '#e6d4ae';
        ctx.font = `${Math.max(14, t * .5)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(def.icon, sx + def.w * t / 2, sy + def.h * t / 2 + t * .18);
        ctx.globalAlpha = 1;
      } else {
        const selected = state.selected;
        if (!selected || selected.kind !== 'building' || selected.id !== buildingIdAt(x, y)) {
          ctx.strokeStyle = 'rgba(233,201,135,.28)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 1, sy + 1, t - 2, t - 2);
        }
      }
    }
    // selected building
    if (state.selected?.kind === 'building') {
      const b = state.buildings.find(v => v.id === state.selected.id);
      if (b) {
        const sx = (b.x - cam.x) * t + W / 2;
        const sy = (b.y - cam.y) * t + H / 2;
        ctx.strokeStyle = 'rgba(233,201,135,.62)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(sx - 2, sy - 2, b.w * t + 4, b.h * t + 4);
        ctx.setLineDash([]);
      }
    }
    if (state.selected?.kind === 'enemy') {
      const e = state.enemies.find(v => v.id === state.selected.id);
      if (e) {
        const sx = (e.x - cam.x) * t + W / 2;
        const sy = (e.y - cam.y) * t + H / 2;
        ctx.strokeStyle = 'rgba(211,125,104,.7)';
        ctx.beginPath(); ctx.arc(sx, sy, t * .42, 0, 7); ctx.stroke();
      }
    }
  }

  function buildingIdAt(x, y) {
    const b = state.buildings.find(v => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h);
    return b?.id;
  }

  function drawHudHints() {
    if (!state.buildMode) return;
    const def = BUILDINGS[state.buildMode.type];
    const txt = `Placing ${def.name} — right-click or Esc to cancel`;
    ctx.font = '10px Avenir Next, Segoe UI, sans-serif';
    const w = ctx.measureText(txt).width + 26;
    ctx.fillStyle = 'rgba(16,12,9,.86)';
    ctx.fillRect(W / 2 - w / 2, H - 104, w, 24);
    ctx.strokeStyle = 'rgba(201,161,92,.3)'; ctx.strokeRect(W / 2 - w / 2, H - 104, w, 24);
    ctx.fillStyle = '#e6d4ae';
    ctx.textAlign = 'center';
    ctx.fillText(txt, W / 2, H - 88);
  }

  function drawMinimap() {
    if (W < 861) return;
    const mw = 164, mh = 112;
    const ox = W - 182, oy = H - 68 - mh;
    if (oy < 100) return;
    ctx.save();
    ctx.fillStyle = 'rgba(12,9,7,.8)';
    ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    ctx.strokeStyle = 'rgba(201,161,92,.24)';
    ctx.strokeRect(ox - 3, oy - 3, mw + 6, mh + 6);
    ctx.fillStyle = 'rgba(36,47,30,.9)';
    ctx.fillRect(ox, oy, mw, mh);
    const sx = mw / state.world.w, sy = mh / state.world.h;
    for (let y = 0; y < state.world.h; y += 2) {
      for (let x = 0; x < state.world.w; x += 2) {
        const terr = state.world.tiles[y * state.world.w + x];
        if (terr === TERRAIN.WATER) ctx.fillStyle = '#2c4850';
        else if (terr === TERRAIN.FOREST) ctx.fillStyle = '#34422d';
        else if (terr === TERRAIN.MOUNTAIN) ctx.fillStyle = '#47453f';
        else if (terr === TERRAIN.DIRT) ctx.fillStyle = '#5b4a34';
        else if (terr === TERRAIN.RUIN) ctx.fillStyle = '#575348';
        else continue;
        ctx.fillRect(ox + x * sx, oy + y * sy, sx * 2 + .5, sy * 2 + .5);
      }
    }
    for (const b of state.buildings) {
      if (!b.complete) continue;
      ctx.fillStyle = b.type === 'campfire' ? '#e9a35a' : b.type === 'shrine' ? '#b78bd4' : 'rgba(214,189,147,.65)';
      ctx.fillRect(ox + b.x * sx, oy + b.y * sy, Math.max(1.2, b.w * sx), Math.max(1.2, b.h * sy));
    }
    for (const c of state.colonists) {
      if (c.dead || c.onExpedition) continue;
      ctx.fillStyle = c.downed ? '#9a4134' : '#e9c987';
      ctx.beginPath(); ctx.arc(ox + c.x * sx, oy + c.y * sy, 1.6, 0, 7); ctx.fill();
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = '#c55b48';
      ctx.beginPath(); ctx.arc(ox + e.x * sx, oy + e.y * sy, 1.8, 0, 7); ctx.fill();
    }
    // viewport
    const vw = (W / tilePx()) * sx, vh = (H / tilePx()) * sy;
    ctx.strokeStyle = 'rgba(233,201,135,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + (cam.x - W / 2 / tilePx()) * sx, oy + (cam.y - H / 2 / tilePx()) * sy, vw, vh);
    ctx.fillStyle = 'rgba(230,212,174,.62)';
    ctx.font = '6.5px Avenir Next, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ASHENREACH', ox + 4, oy + mh - 4);
    ctx.restore();
    minimapState = { ox, oy, mw, mh };
  }

  function minimapHit(sx, sy) {
    if (!minimapState) return null;
    const m = minimapState;
    if (sx < m.ox || sy < m.oy || sx > m.ox + m.mw || sy > m.oy + m.mh) return null;
    return { x: (sx - m.ox) / m.mw * state.world.w, y: (sy - m.oy) / m.mh * state.world.h };
  }

  function zoomBy(delta) {
    cam.targetZoom = Math.max(.55, Math.min(2.4, cam.targetZoom * (delta > 0 ? .9 : 1.1)));
  }

  function panBy(dx, dy) {
    const t = tilePx();
    cam.x -= dx / t;
    cam.y -= dy / t;
    cam.x = Math.max(4, Math.min(state.world.w - 4, cam.x));
    cam.y = Math.max(4, Math.min(state.world.h - 4, cam.y));
  }

  return { resize, draw, worldToScreen, screenToWorld, centerOn, zoomBy, panBy, minimapHit, cam, get width() { return W; }, get height() { return H; } };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt * 255));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt * 255));
  const b = Math.max(0, Math.min(255, (n & 255) + amt * 255));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function drawOverview(canvas, state) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width, H = rect.height;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W * .5, H * .46, 20, W * .5, H * .46, W * .72);
  bg.addColorStop(0, '#23231a');
  bg.addColorStop(.65, '#161712');
  bg.addColorStop(1, '#0d0f0c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Parchment contours behind the landmass.
  ctx.save();
  ctx.strokeStyle = 'rgba(201,161,92,.045)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = H * .5 + Math.sin(x * .004 + i * .73) * (22 + i * 6) + (i - 9) * 28;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  const mapW = Math.min(W * .68, 900);
  const mapH = mapW * state.world.h / state.world.w;
  const mx = W * .5 - mapW / 2;
  const my = H * .52 - mapH / 2;
  const sx = mapW / state.world.w, sy = mapH / state.world.h;

  // Build a painted terrain plate from the living world.
  const off = document.createElement('canvas');
  off.width = state.world.w;
  off.height = state.world.h;
  const octx = off.getContext('2d');
  const image = octx.createImageData(state.world.w, state.world.h);
  const palette = {
    0: [83, 96, 63], 1: [60, 75, 49], 2: [101, 82, 57], 3: [39, 60, 65],
    4: [82, 79, 69], 5: [110, 96, 68], 6: [101, 95, 78], 7: [90, 68, 45],
  };
  for (let i = 0; i < state.world.tiles.length; i++) {
    const c = palette[state.world.tiles[i]] || palette[0];
    const n = (hash(i % state.world.w, Math.floor(i / state.world.w)) - .5) * 11;
    image.data[i * 4] = c[0] + n;
    image.data[i * 4 + 1] = c[1] + n;
    image.data[i * 4 + 2] = c[2] + n;
    image.data[i * 4 + 3] = 255;
  }
  octx.putImageData(image, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = 'rgba(0,0,0,.65)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#27241a';
  ctx.fillRect(mx - 7, my - 7, mapW + 14, mapH + 14);
  ctx.shadowBlur = 0;
  ctx.drawImage(off, mx, my, mapW, mapH);
  // deepen water and add a little depth to forests
  ctx.globalAlpha = .23;
  ctx.globalCompositeOperation = 'multiply';
  for (let y = 0; y < state.world.h; y += 2) {
    for (let x = 0; x < state.world.w; x += 2) {
      if (state.world.tiles[y * state.world.w + x] === 3) {
        ctx.fillStyle = '#16323a';
        ctx.fillRect(mx + x * sx, my + y * sy, sx * 2, sy * 2);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();

  // Hand-drawn coastline and bounds.
  ctx.save();
  ctx.strokeStyle = 'rgba(210,178,111,.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 7.5, my - 7.5, mapW + 15, mapH + 15);
  ctx.strokeStyle = 'rgba(210,178,111,.09)';
  ctx.strokeRect(mx - 12.5, my - 12.5, mapW + 25, mapH + 25);
  ctx.restore();

  // Trade roads, as a remembered thread.
  const roads = [
    [[30, 22], [32, 30], [35, 38], [49, 43]],
    [[30, 22], [37, 25], [43, 27], [47, 29]],
    [[30, 22], [23, 18], [17, 15], [13, 12]],
    [[30, 22], [20, 26], [12, 33]],
  ];
  ctx.strokeStyle = 'rgba(222,188,121,.28)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  for (const points of roads) {
    ctx.beginPath();
    curvePath(ctx, points, mx, my, sx, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const locations = [
    { id: 'camp', name: 'Ashenreach', x: 30, y: 19, discovered: true, icon: '✦', danger: 0, blurb: 'The colony fire' },
    { id: 'grove', name: 'Whisperwood', x: 13, y: 12, discovered: true, icon: '❦', danger: 1, blurb: 'Old wood, older eyes' },
    { id: 'road', name: 'Merchant Road', x: 31, y: 37, discovered: true, icon: '⌁', danger: 1, blurb: 'Wagons rarely return' },
    { id: 'ruins', name: 'Sunken Shrine', x: 47, y: 29, discovered: true, icon: '◈', danger: 2, blurb: 'Something is dreaming' },
    { id: 'barrow', name: 'Kingsbarrow', x: 51, y: 9, discovered: state.stats.daysSurvived >= 3, icon: '▴', danger: 3, blurb: 'A hill that breathes' },
    { id: 'tower', name: 'Hollow Watch', x: 8, y: 33, discovered: state.completedResearch.includes('astronomy'), icon: '♜', danger: 2, blurb: 'Its beacon burns green' },
    { id: 'rift', name: 'Sundered Rift', x: 56, y: 37, discovered: state.completedResearch.includes('astronomy'), icon: '◉', danger: 4, blurb: 'A wound in the world' },
  ];
  for (const loc of locations) {
    if (!loc.discovered) continue;
    const lx = mx + loc.x * sx;
    const ly = my + loc.y * sy;
    const isCamp = loc.id === 'camp';
    const pulse = .65 + Math.sin(performance.now() / 700 + loc.x) * .2;
    if (isCamp) {
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34);
      glow.addColorStop(0, 'rgba(233,201,135,.35)');
      glow.addColorStop(1, 'rgba(233,201,135,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(lx, ly, 34, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(233,201,135,${.24 + pulse * .2})`;
      ctx.beginPath(); ctx.arc(lx, ly, 12 + pulse * 3, 0, 7); ctx.stroke();
    }
    // marker
    ctx.fillStyle = isCamp ? '#f2dfb8' : 'rgba(222,192,133,.9)';
    ctx.strokeStyle = isCamp ? 'rgba(233,201,135,.6)' : 'rgba(222,192,133,.28)';
    ctx.beginPath(); ctx.arc(lx, ly, isCamp ? 7 : 5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,7,.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(lx, ly, isCamp ? 9 : 6.5, 0, 7); ctx.stroke();
    ctx.fillStyle = '#14110c';
    ctx.font = `bold ${isCamp ? 10 : 8}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText(loc.icon, lx, ly + (isCamp ? 3.5 : 3));
    // text
    ctx.textAlign = 'center';
    ctx.font = `600 ${isCamp ? 15 : 12}px Georgia, serif`;
    const tw = ctx.measureText(loc.name).width;
    const lyLabel = ly - (isCamp ? 24 : 19);
    ctx.fillStyle = 'rgba(12,10,7,.68)';
    ctx.fillRect(lx - tw / 2 - 7, lyLabel - 11, tw + 14, 17);
    ctx.fillStyle = isCamp ? '#f2dfb8' : 'rgba(239,222,188,.92)';
    ctx.fillText(loc.name, lx, lyLabel);
    ctx.font = 'italic 8.5px Georgia, serif';
    ctx.fillStyle = 'rgba(207,193,163,.58)';
    ctx.fillText(loc.blurb, lx, ly + (isCamp ? 22 : 18));
    if (loc.danger) {
      for (let i = 0; i < loc.danger; i++) {
        ctx.fillStyle = i < 2 ? 'rgba(173,92,67,.85)' : 'rgba(173,92,67,.42)';
        ctx.beginPath();
        ctx.moveTo(lx - 9 + i * 7, ly + 26);
        ctx.lineTo(lx - 5.5 + i * 7, ly + 31);
        ctx.lineTo(lx - 2 + i * 7, ly + 26);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // Compass rose.
  const cx = W - 70, cy = 68;
  ctx.save();
  ctx.strokeStyle = 'rgba(201,161,92,.23)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 29, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 7); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    ctx.lineTo(cx + Math.cos(a) * (i % 2 ? 25 : 33), cy + Math.sin(a) * (i % 2 ? 25 : 33));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(233,201,135,.8)';
  ctx.font = '10px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - 38);
  ctx.restore();

  // Legend and scale, bottom left.
  if (W > 760) {
    const lx = Math.max(28, mx - 180);
    let ly = H - 104;
    ctx.textAlign = 'left';
    ctx.font = '8px Avenir Next, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(201,161,92,.5)';
    ctx.fillText('LANDMARKS', lx, ly);
    ly += 15;
    for (const loc of locations.filter(v => v.discovered)) {
      ctx.fillStyle = 'rgba(201,161,92,.7)';
      ctx.fillText(loc.icon, lx, ly);
      ctx.fillStyle = 'rgba(230,212,174,.58)';
      ctx.fillText(loc.name, lx + 14, ly);
      ly += 14;
    }
    // Scale bar
    ctx.strokeStyle = 'rgba(201,161,92,.35)';
    ctx.beginPath(); ctx.moveTo(lx, H - 24); ctx.lineTo(lx + 44, H - 24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx, H - 28); ctx.lineTo(lx, H - 20); ctx.moveTo(lx + 44, H - 28); ctx.lineTo(lx + 44, H - 20); ctx.stroke();
    ctx.fillStyle = 'rgba(230,212,174,.4)';
    ctx.font = '7px Avenir Next, Segoe UI, sans-serif';
    ctx.fillText('10 LEAGUES', lx + 51, H - 21);
  }

  // Footer annotation.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(201,161,92,.5)';
  ctx.font = 'italic 13px Georgia, serif';
  ctx.fillText('Here be old things. Most of them are sleeping.', W / 2, H - 24);
}

function curvePath(ctx, points, mx, my, sx, sy) {
  ctx.moveTo(mx + points[0][0] * sx, my + points[0][1] * sy);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], cur = points[i];
    const cx = mx + (prev[0] + cur[0]) / 2 * sx;
    const cy = my + (prev[1] + cur[1]) / 2 * sy;
    ctx.quadraticCurveTo(cx, cy, mx + cur[0] * sx, my + cur[1] * sy);
  }
}
