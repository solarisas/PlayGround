import { TERRAIN, TERRAIN_INFO } from './content.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng, min, max) => min + rng() * (max - min);
export const irange = (rng, min, max) => Math.floor(range(rng, min, max + 1));
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
export const key = (x, y) => x + ',' + y;

export function generateWorld(seed = 732, spawn = null) {
  const rng = mulberry32(seed);
  const w = 64, h = 44;
  const tiles = new Uint8Array(w * h);
  const variant = new Uint8Array(w * h);
  const campX = clamp(Math.round(spawn?.x ?? 29), 8, w - 9);
  const campY = clamp(Math.round(spawn?.y ?? 22), 7, h - 6);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let t = TERRAIN.GRASS;
      const edgeNoise = Math.sin(x * 0.31 + seed) * Math.cos(y * 0.24) * 2.2;
      if (y < 4 + edgeNoise + rng() * 2) t = TERRAIN.FOREST;
      if (y > h - 4 + edgeNoise + rng() * 2) t = TERRAIN.FOREST;
      if (x < 3 + edgeNoise + rng() * 2) t = TERRAIN.FOREST;
      if (x > w - 4 + edgeNoise + rng() * 2) t = TERRAIN.FOREST;
      tiles[y * w + x] = t;
      variant[y * w + x] = Math.floor(rng() * 255);
    }
  }

  // River along the western verge, with a stony ford.
  for (let y = 0; y < h; y++) {
    const cx = Math.round(9 + Math.sin(y * 0.25 + 1.1) * 3.1 + Math.sin(y * 0.07) * 1.8);
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= w) continue;
      tiles[y * w + x] = Math.abs(dx) >= 2 ? TERRAIN.SAND : TERRAIN.WATER;
    }
  }

  // Northern crags and a jagged spine to the north-east.
  for (let y = 2; y < 12; y++) {
    for (let x = 40; x < 63; x++) {
      const n = Math.sin(x * 0.55) * 1.8 + Math.cos(y * 0.4) * 1.2 + rng() * 1.4;
      if (y < 5 + n || (x > 50 && y < 12 + n * 0.6)) tiles[y * w + x] = TERRAIN.MOUNTAIN;
    }
  }
  // A small crag island south-west.
  for (let i = 0; i < 24; i++) {
    const x = 18 + Math.floor(rng() * 9), y = 35 + Math.floor(rng() * 6);
    tiles[y * w + x] = TERRAIN.MOUNTAIN;
  }

  // Forest patches.
  const forestPatches = [
    [13, 12, 7], [20, 9, 5], [44, 20, 8], [50, 34, 6], [17, 29, 5], [36, 8, 6],
  ];
  for (const [cx, cy, r] of forestPatches) {
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        if (dist(x, y, cx, cy) < r * (0.7 + rng() * 0.45) && tiles[y * w + x] === TERRAIN.GRASS) {
          tiles[y * w + x] = TERRAIN.FOREST;
        }
      }
    }
  }

  // The old road: camp -> south road, camp -> shrine, camp -> grove.
  const roads = [
    [[campX, campY], [campX + 1, 30], [campX + 4, 38], [campX + 6, 43]],
    [[campX, campY], [35, 25], [41, 27], [47, 29]],
    [[campX, campY], [23, 18], [16, 15], [13, 12]],
  ];
  for (const points of roads) {
    for (let p = 0; p < points.length - 1; p++) {
      const [x1, y1] = points[p], [x2, y2] = points[p + 1];
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(x1 + (x2 - x1) * i / steps);
        const y = Math.round(y1 + (y2 - y1) * i / steps);
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) {
          const px = x + ox, py = y + oy;
          if (px >= 0 && px < w && py >= 0 && py < h && tiles[py * w + px] !== TERRAIN.WATER) {
            tiles[py * w + px] = TERRAIN.DIRT;
          }
        }
      }
    }
  }

  // Camp clearing.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist(x, y, campX, campY) < 6.2) {
        if (tiles[y * w + x] !== TERRAIN.WATER) tiles[y * w + x] = TERRAIN.GRASS;
      }
    }
  }

  // Sunken shrine ruin clearing.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist(x, y, 47, 29) < 4.6) {
        if (tiles[y * w + x] !== TERRAIN.WATER) tiles[y * w + x] = TERRAIN.RUIN;
      }
    }
  }

  // Ford stones across the western river.
  for (let x = 5; x <= 14; x++) {
    if (tiles[28 * w + x] === TERRAIN.WATER || tiles[29 * w + x] === TERRAIN.WATER) {
      tiles[28 * w + x] = TERRAIN.SAND;
      tiles[29 * w + x] = TERRAIN.SAND;
      tiles[30 * w + x] = TERRAIN.SAND;
    }
  }

  // Ruined arch stones around the shrine.
  for (const [x, y] of [[44, 27], [44, 31], [50, 27], [50, 31], [47, 25], [47, 33]]) {
    tiles[y * w + x] = TERRAIN.RUIN;
  }

  return { w, h, tiles, variant, campX, campY };
}

export function buildFeatureIndex(features) {
  const index = new Map();
  for (const f of features) if (f.amount > 0) index.set(key(f.x, f.y), f);
  return index;
}

export function generateFeatures(world, rng) {
  const { w, h, tiles, campX, campY } = world;
  const features = [];
  let id = 0;
  const add = (type, x, y, amount, marked = false) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    features.push({
      id: 'f' + (id++), type, x, y, amount,
      max: amount, marked, regrow: type === 'bush' ? 220 : 0, regrowTimer: 0,
      sway: rng() * Math.PI * 2, size: 0.8 + rng() * 0.45, variant: Math.floor(rng() * 4),
    });
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x];
      const d = dist(x, y, campX, campY);
      const inCamp = d < 6.3;
      if (inCamp) continue;
      if (t === TERRAIN.FOREST) {
        if (rng() < 0.43) add('tree', x, y, 9 + Math.floor(rng() * 7), d < 12);
      } else if (t === TERRAIN.MOUNTAIN) {
        if (rng() < 0.54) add('rock', x, y, 8 + Math.floor(rng() * 8), d < 12);
      } else if (t === TERRAIN.GRASS) {
        const r = rng();
        if (r < 0.035) add('tree', x, y, 8 + Math.floor(rng() * 6), d < 10);
        else if (r < 0.055) add('bush', x, y, 5 + Math.floor(rng() * 5), d < 10);
        else if (r < 0.062) add('rock', x, y, 6 + Math.floor(rng() * 5), false);
      } else if (t === TERRAIN.RUIN) {
        if (rng() < 0.10) add('crystal', x, y, 2 + Math.floor(rng() * 3), d < 16);
      }
    }
  }

  // Guaranteed early resources around the camp, all marked for gathering.
  const ring = [
    ['tree', 23, 17], ['tree', 25, 16], ['tree', 35, 18], ['tree', 37, 21],
    ['tree', 35, 27], ['tree', 25, 28], ['tree', 21, 23], ['tree', 33, 16],
    ['rock', 36, 26], ['rock', 38, 24], ['rock', 32, 28], ['rock', 20, 19],
    ['bush', 24, 26], ['bush', 34, 24], ['bush', 27, 17], ['bush', 32, 27],
  ];
  for (const [type, x, y] of ring) {
    if (features.some(f => f.x === x && f.y === y)) continue;
    if (tiles[y * w + x] === TERRAIN.WATER) continue;
    add(type, x, y, type === 'tree' ? 13 : type === 'rock' ? 11 : 7, true);
  }
  // A few crystal shards within reach of the shrine.
  add('crystal', 45, 28, 3, false);
  add('crystal', 49, 30, 4, false);
  add('ruinStone', 45, 30, 5, false);

  return features;
}

export function makeTerrainLookup(world) {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= world.w || y >= world.h) return -1;
    return world.tiles[y * world.w + x];
  };
}

export function buildingAt(buildings, x, y) {
  for (const b of buildings) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}

export function buildingAtTile(state, x, y) {
  return buildingAt(state.buildings, x, y);
}

export function isWalkable(state, x, y, ignoreBuilding = null) {
  if (x < 0 || y < 0 || x >= state.world.w || y >= state.world.h) return false;
  if (!TERRAIN_INFO[state.world.tiles[y * state.world.w + x]].walk) return false;
  const f = state.featureIndex?.get(key(x, y));
  if (f && f.type === 'rock') return false;
  const b = buildingAt(state.buildings, x, y);
  if (b && b !== ignoreBuilding && b.complete) {
    const def = state.defs.buildings[b.type];
    if (def?.blocks) return false;
  }
  return true;
}

export function neighbors(x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]];
}

export function findPath(state, sx, sy, tx, ty, maxNodes = 3200) {
  sx = Math.round(sx); sy = Math.round(sy); tx = Math.round(tx); ty = Math.round(ty);
  if (sx === tx && sy === ty) return [];
  if (tx < 0 || ty < 0 || tx >= state.world.w || ty >= state.world.h) return null;
  const open = [{ x: sx, y: sy, f: 0 }];
  const openMap = new Map([[key(sx, sy), open[0]]]);
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  let found = false;
  let iterations = 0;

  while (open.length && iterations++ < maxNodes) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0];
    openMap.delete(key(cur.x, cur.y));
    if (cur.x === tx && cur.y === ty) { found = true; break; }
    closed.add(key(cur.x, cur.y));
    for (const [dx, dy] of neighbors()) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const isGoal = nx === tx && ny === ty;
      if (!isGoal && !isWalkable(state, nx, ny)) continue;
      if (isGoal && !isWalkable(state, nx, ny)) continue;
      const tentative = (gScore.get(key(cur.x, cur.y)) || 0) + 1;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      came.set(nk, key(cur.x, cur.y));
      gScore.set(nk, tentative);
      const hval = Math.abs(nx - tx) + Math.abs(ny - ty);
      const node = { x: nx, y: ny, f: tentative + hval * 1.05 };
      if (openMap.has(nk)) {
        const existing = openMap.get(nk);
        existing.f = node.f;
      } else {
        open.push(node);
        openMap.set(nk, node);
      }
    }
  }
  if (!found) return null;
  const path = [];
  let cur = key(tx, ty);
  while (cur) {
    const [x, y] = cur.split(',').map(Number);
    path.push({ x, y });
    cur = came.get(cur);
  }
  path.reverse();
  return path.slice(1);
}

export function findAdjacentWalkable(state, x, y) {
  if (isWalkable(state, x, y)) return { x, y };
  for (const [dx, dy] of neighbors()) {
    if (isWalkable(state, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (isWalkable(state, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  }
  return null;
}

export function getBuildingTiles(b) {
  const arr = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) arr.push({ x: b.x + x, y: b.y + y });
  return arr;
}
