import {
  BUILDINGS, CLASSES, ENEMY_TYPES, EXPEDITIONS, INCIDENTS, RACES, RESEARCH,
  RESOURCE_META, SEASONS, SKILLS, TERRAIN_INFO, TRAITS, WORK_TYPES,
} from './content.js';
import {
  buildFeatureIndex, buildingAt, clamp, dist, findAdjacentWalkable, findPath,
  generateFeatures, generateWorld, getBuildingTiles, isWalkable, key, mulberry32,
  pick, range,
} from './world.js';

const FIRST_NAMES = ['Elara', 'Bram', 'Nia', 'Finn', 'Sera', 'Corin', 'Maelis', 'Doran', 'Yara', 'Rook', 'Tamsin', 'Orin', 'Ilyra', 'Gorm', 'Perrin', 'Sable', 'Wren', 'Kael', 'Mira', 'Bryn', 'Ash', 'Liora', 'Vey', 'Tobias'];
const LAST_NAMES = ['Voss', 'Ironfoot', 'Emberkin', 'Mosswood', 'Vale', 'Thorne', 'Ashford', 'Briar', 'Hollow', 'Gale', 'Marsh', 'Cinder', 'Fenn', 'Ward', 'Reeve', 'Blackbriar', 'Dusk', 'Oakenshield'];
const RACE_KEYS = Object.keys(RACES);
const CLASS_KEYS = Object.keys(CLASSES);

const DEFAULT_PRIORITIES = {
  firefight: 1, patient: 2, doctor: 3, cook: 3, hunt: 4, construct: 3, mine: 3,
  chop: 3, plant: 3, harvest: 3, haul: 3, craft: 4, research: 4, guard: 3,
};

const NAME_PAIRS = [
  ['Elara', 'Voss'], ['Bram', 'Ironfoot'], ['Nia', 'Emberkin'], ['Finn', 'Mosswood'], ['Sera', 'Vale'],
];

const ROSTER = [
  {
    name: 'Elara Voss', race: 'human', cls: 'ranger',
    traits: ['quick', 'kind'],
    skills: { construction: 4, mining: 2, plants: 5, cooking: 4, crafting: 5, medicine: 3, research: 3, combat: 7, social: 4, survival: 7 },
    priorities: { hunt: 1, chop: 2, cook: 2, guard: 2 },
  },
  {
    name: 'Bram Ironfoot', race: 'dwarf', cls: 'guardian',
    traits: ['ironwilled', 'sluggish'],
    skills: { construction: 7, mining: 8, plants: 1, cooking: 2, crafting: 6, medicine: 2, research: 1, combat: 8, social: 3, survival: 4 },
    priorities: { construct: 1, mine: 1, guard: 1, craft: 2 },
  },
  {
    name: 'Nia Emberkin', race: 'tiefling', cls: 'sorcerer',
    traits: ['nightOwl', 'pyromaniac'],
    skills: { construction: 2, mining: 2, plants: 3, cooking: 3, crafting: 4, medicine: 4, research: 9, combat: 5, social: 5, survival: 3 },
    priorities: { research: 1, doctor: 2, craft: 3, guard: 3 },
  },
  {
    name: 'Finn Mosswood', race: 'halfling', cls: 'druid',
    traits: ['greenThumb', 'glutton'],
    skills: { construction: 3, mining: 1, plants: 9, cooking: 7, crafting: 3, medicine: 5, research: 3, combat: 4, social: 5, survival: 6 },
    priorities: { plant: 1, harvest: 1, cook: 1, hunt: 2 },
  },
  {
    name: 'Sera Vale', race: 'halfelf', cls: 'cleric',
    traits: ['empathetic', 'frail'],
    skills: { construction: 3, mining: 2, plants: 6, cooking: 5, crafting: 2, medicine: 9, research: 5, combat: 3, social: 8, survival: 4 },
    priorities: { doctor: 1, patient: 1, cook: 2, research: 2 },
  },
];

const PRAISE = ['Well done', 'A fine hand', 'The fire holds', 'Better than nothing', 'Keep at it'];

function dateOrdinal(n) {
  if (n % 10 === 1 && n !== 11) return n + 'st';
  if (n % 10 === 2 && n !== 12) return n + 'nd';
  if (n % 10 === 3 && n !== 13) return n + 'rd';
  return n + 'th';
}

export function phaseForHour(hour) {
  if (hour < 5) return 'Witching hour';
  if (hour < 8) return 'Dawn';
  if (hour < 12) return 'Morning';
  if (hour < 15) return 'Midday';
  if (hour < 18) return 'Afternoon';
  if (hour < 21) return 'Dusk';
  return 'Night';
}

export function dateLabel(time) {
  return `${dateOrdinal(time.dayInSeason)} of ${SEASONS[time.season].name}`;
}

export function timeLabel(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createGame(seed = 732) {
  const world = generateWorld(seed);
  const rng = mulberry32(seed + 97);
  const features = generateFeatures(world, rng);
  const state = {
    seed,
    world,
    defs: { buildings: BUILDINGS, research: RESEARCH },
    features,
    featureIndex: buildFeatureIndex(features),
    buildings: [],
    colonists: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floats: [],
    resources: { wood: 180, stone: 110, food: 55, meals: 12, herbs: 8, crystal: 3, silver: 42 },
    resourceCap: 380,
    researchPoints: 24,
    researchActive: 'agriculture',
    completedResearch: [],
    time: { day: 1, dayInSeason: 1, season: 0, year: 732, hour: 7.15, weather: 'Clear skies', weatherTtl: 9 },
    speed: 1,
    prevSpeed: 1,
    tick: 0,
    simTime: 0,
    threat: 0,
    selected: null,
    hover: null,
    buildMode: null,
    buildCategory: 'All',
    uiTab: 'colony',
    expedition: null,
    stats: { gathered: 0, built: 0, kills: 0, mealsCooked: 0, researchDone: 0, daysSurvived: 1 },
    nextIncident: { day: 1, hour: 20.4 },
    recentDeath: 0,
    mood: 58,
    notifications: [],
    banner: null,
    log: [],
    quests: [
      { id: 'home', title: 'A Fire in the Dark', desc: 'Raise six new structures around the waystone. A camp becomes a colony one wall at a time.', objective: 'Structures raised', progress: 0, total: 6, status: 'active', reward: 'Research & silver' },
      { id: 'veil', title: 'Teeth in the Fog', desc: 'The Marches are testing you. Cut down five creatures that come for the fire.', objective: 'Creatures slain', progress: 0, total: 5, status: 'active', reward: 'Colony mood' },
      { id: 'shrine', title: 'The Sunken Shrine', desc: 'Something beneath the drowned stones is dreaming. Delve the ruin and silence it — or wake it.', objective: 'Delve the Sunken Shrine', progress: 0, total: 1, status: 'active', reward: 'Arcana & crystal' },
    ],
    choice: null,
    gameOver: false,
    dirty: true,
    mobileInspector: false,
    lastUi: 0,
    nextId: 1,
    version: 1,
  };

  addInitialBuildings(state, rng);
  addInitialColonists(state, rng);
  state.selected = { kind: 'colonist', id: state.colonists[0].id };

  state.log = [
    { t: 'Dawn', icon: '✦', kind: 'epic', text: 'The exiles light the waystone fire. <strong>Ashenreach</strong> is founded.' },
    { t: 'Dawn', icon: '◈', kind: '', text: 'A broken waystone hums beneath the camp. Its dream is not a kind one.' },
    { t: 'Dawn', icon: '❦', kind: 'good', text: 'Sunwheat is sown. The first harvest will decide how the winter tastes.' },
  ];

  notify(state, 'The colony of Ashenreach is founded. Keep the fire burning.', 'epic');
  showBanner(state, 'A Fire in the Dark', 'The Marches are wide, hungry, and full of old promises. Five exiles have claimed a broken waystone. Build. Survive. Belong.', 'Chronicle begins');
  return state;
}

function addInitialBuildings(state, rng) {
  const place = (type, x, y, extra = {}) => {
    const def = BUILDINGS[type];
    const b = {
      id: 'b' + (state.nextId++), type, x, y, w: def.w, h: def.h,
      complete: true, progress: 100, active: true, ...extra,
    };
    state.buildings.push(b);
    return b;
  };
  place('campfire', 29, 22);
  place('tent', 26, 18);
  place('bed', 25, 21);
  place('bed', 25, 22);
  place('bed', 31, 22);
  place('bed', 32, 22);
  place('bed', 25, 23);
  place('stockpile', 23, 24);
  place('workbench', 32, 24);
  place('researchDesk', 33, 21);
  place('well', 35, 22);
  for (const [x, y] of [[27, 17], [28, 17], [29, 17], [27, 16], [28, 16], [29, 16]]) {
    const b = place('farm', x, y);
    b.crop = 0.35 + rng() * 0.45;
    state.world.tiles[y * state.world.w + x] = 7;
  }
  for (const [x, y] of [[28, 15], [29, 15], [30, 15], [31, 15], [27, 15]]) {
    place('palisade', x, y);
  }
}

function addInitialColonists(state, rng) {
  const spots = [[28, 23], [27, 23], [30, 23], [31, 23], [30, 21]];
  ROSTER.forEach((t, i) => {
    const [first, last] = t.name.split(' ');
    const c = makeColonist(state, {
      id: 'c' + (i + 1), first, last, race: t.race, cls: t.cls, traits: t.traits,
      skills: t.skills, priorities: { ...DEFAULT_PRIORITIES, ...t.priorities },
      x: spots[i][0], y: spots[i][1], rng,
    });
    state.colonists.push(c);
  });
}

export function makeColonist(state, opts) {
  const rng = opts.rng || Math.random;
  const race = opts.race || pick(rng, RACE_KEYS);
  const cls = opts.cls || pick(rng, CLASS_KEYS);
  const first = opts.first || pick(rng, FIRST_NAMES);
  const last = opts.last || pick(rng, LAST_NAMES);
  const skills = opts.skills || {};
  if (!opts.skills) for (const s of SKILLS) skills[s.id] = 1 + Math.floor(rng() * 7);
  for (const t of opts.traits || []) {
    const trait = TRAITS[t];
    if (trait?.skills) for (const [s, n] of Object.entries(trait.skills)) skills[s] = (skills[s] || 1) + n;
  }
  const frail = (opts.traits || []).includes('frail');
  const maxHp = 72 + (skills.combat || 4) * 4 - (frail ? 22 : 0);
  return {
    id: opts.id || 'c' + (state.nextId++),
    name: `${first} ${last}`,
    first, last, race, cls,
    traits: opts.traits || [],
    skills,
    priorities: { ...DEFAULT_PRIORITIES, ...(opts.priorities || {}) },
    x: opts.x, y: opts.y, homeX: opts.x, homeY: opts.y,
    path: [], pathIndex: 0,
    job: null, jobTarget: null,
    hp: maxHp, maxHp, bleeding: 0, downed: false, dead: false, downTimer: 0,
    hunger: 68 + rng() * 25, rest: 66 + rng() * 24, mood: 58 + rng() * 12,
    moodBase: 50, attackTimer: 0, movePhase: rng() * 6, facing: 1,
    status: 'Idle', thought: 'Watching the horizon.',
    onExpedition: false, xp: {}, level: 1,
    lastSocial: 0, breakTimer: 0,
    color: CLASSES[cls].color,
    skin: RACES[race].color,
  };
}

export function addColonist(state, rng = Math.random) {
  const used = new Set(state.colonists.map(c => c.name));
  let first = pick(rng, FIRST_NAMES), last = pick(rng, LAST_NAMES);
  let tries = 0;
  while (used.has(`${first} ${last}`) && tries++ < 20) { first = pick(rng, FIRST_NAMES); last = pick(rng, LAST_NAMES); }
  const traits = [];
  const keys = Object.keys(TRAITS);
  while (traits.length < 2) {
    const t = pick(rng, keys);
    if (!traits.includes(t)) traits.push(t);
  }
  const c = makeColonist(state, {
    first, last, traits, x: state.world.campX + 4, y: state.world.campY + 4, rng,
    race: pick(rng, RACE_KEYS), cls: pick(rng, CLASS_KEYS),
  });
  state.colonists.push(c);
  logEvent(state, `${c.name} joins the colony.`, '◈', 'good');
  notify(state, `<strong>${c.name}</strong> joins the colony as a ${RACES[c.race].name} ${CLASSES[c.cls].name}.`, 'good');
  return c;
}

export function logEvent(state, html, icon = '·', kind = '') {
  state.log.unshift({ t: timeLabel(state.time.hour), icon, kind, text: html });
  if (state.log.length > 90) state.log.pop();
  state.dirty = true;
}

export function notify(state, text, kind = '') {
  state.notifications.push({ id: 'n' + (state.nextId++), text, kind, ttl: 5.2 });
  if (state.notifications.length > 4) state.notifications.shift();
}

export function showBanner(state, title, text, kicker = 'Incident') {
  state.banner = { title, text, kicker, ttl: 6.3, max: 6.3 };
}

function addFloat(state, x, y, text, color = '#e9c987') {
  state.floats.push({ x, y, text, color, ttl: 1.2, max: 1.2, vy: -0.6 });
  if (state.floats.length > 40) state.floats.shift();
}

export function spawnParticles(state, x, y, count, colors, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (opts.speed || 1.2) * (0.3 + Math.random());
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.lift || 0.2),
      life: (opts.life || 0.7) * (0.5 + Math.random()),
      max: opts.life || 0.7,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: (opts.size || 2) * (0.5 + Math.random()),
      gravity: opts.gravity ?? 0.6,
    });
  }
  if (state.particles.length > 360) state.particles.splice(0, state.particles.length - 360);
}

export function costString(cost) {
  return Object.entries(cost).map(([r, n]) => `${n} ${RESOURCE_META[r]?.name || r}`).join(' · ');
}

export function canAfford(state, cost) {
  return Object.entries(cost || {}).every(([r, n]) => (state.resources[r] || 0) >= n);
}

export function spend(state, cost) {
  if (!canAfford(state, cost)) return false;
  for (const [r, n] of Object.entries(cost)) state.resources[r] -= n;
  state.dirty = true;
  return true;
}

export function addResource(state, resource, amount, quiet = false) {
  if (!(resource in state.resources)) return;
  state.resources[resource] = Math.max(0, Math.min(state.resourceCap, state.resources[resource] + amount));
  if (!quiet) state.dirty = true;
}

export function addResearch(state, amount) {
  state.researchPoints += amount;
  state.dirty = true;
  const r = RESEARCH[state.researchActive];
  if (r && state.researchPoints >= r.cost && !state.completedResearch.includes(state.researchActive)) {
    finishResearch(state, state.researchActive);
  }
}

export function finishResearch(state, id) {
  const r = RESEARCH[id];
  if (!r || state.completedResearch.includes(id)) return;
  if (state.researchPoints < r.cost) return;
  state.researchPoints -= r.cost;
  state.completedResearch.push(id);
  state.stats.researchDone++;
  state.researchActive = Object.keys(RESEARCH).find(k => !state.completedResearch.includes(k) && (!RESEARCH[k].requires || state.completedResearch.includes(RESEARCH[k].requires))) || null;
  logEvent(state, `<strong>${r.name}</strong> is understood. ${r.effect}`, '✦', 'epic');
  notify(state, `<strong>${r.name}</strong> researched. ${r.effect}`, 'epic');
  spawnParticles(state, state.world.campX, state.world.campY, 30, ['#e9c987', '#a27dc4', '#f4e3b5'], { speed: 2.4, life: 1.4, lift: 0.7, gravity: .05 });
  state.dirty = true;
  checkQuests(state);
}

export function setResearch(state, id) {
  const r = RESEARCH[id];
  if (!r || state.completedResearch.includes(id)) return;
  if (r.requires && !state.completedResearch.includes(r.requires)) {
    notify(state, `Requires ${RESEARCH[r.requires].name} first.`, 'bad');
    return;
  }
  state.researchActive = id;
  state.dirty = true;
}

export function getBuildingDef(state, type) {
  return BUILDINGS[type];
}

export function buildingsOfType(state, type) {
  return state.buildings.filter(b => b.type === type && b.complete);
}

export function hasBuilding(state, type) {
  return state.buildings.some(b => b.type === type && b.complete);
}

export function isUnlocked(state, type) {
  const def = BUILDINGS[type];
  if (!def) return false;
  return !def.requires || state.completedResearch.includes(def.requires);
}

export function canPlace(state, type, x, y) {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, reason: 'Unknown structure.' };
  for (let yy = 0; yy < def.h; yy++) {
    for (let xx = 0; xx < def.w; xx++) {
      const tx = x + xx, ty = y + yy;
      if (tx < 0 || ty < 0 || tx >= state.world.w || ty >= state.world.h) return { ok: false, reason: 'Beyond the map.' };
      if (!TERRAIN_INFO[state.world.tiles[ty * state.world.w + tx]].walk) return { ok: false, reason: 'Unbuildable ground.' };
      const f = state.featureIndex.get(key(tx, ty));
      if (f) return { ok: false, reason: f.type === 'tree' ? 'A tree stands here. Mark it for chopping.' : 'Something already occupies this ground.' };
      const b = buildingAt(state.buildings, tx, ty);
      if (b) return { ok: false, reason: 'Structure overlap.' };
    }
  }
  return { ok: true };
}

export function placeBuilding(state, type, x, y) {
  const def = BUILDINGS[type];
  if (!def) return false;
  if (!isUnlocked(state, type)) { notify(state, `${def.name} has not been researched.`, 'bad'); return false; }
  const check = canPlace(state, type, x, y);
  if (!check.ok) { notify(state, check.reason, 'bad'); return false; }
  if (!canAfford(state, def.cost)) { notify(state, `Not enough materials for ${def.name}.`, 'bad'); return false; }
  spend(state, def.cost);
  const b = {
    id: 'b' + (state.nextId++), type, x, y, w: def.w, h: def.h,
    complete: false, progress: 0, active: true,
  };
  if (type === 'farm') b.crop = 0;
  state.buildings.push(b);
  state.buildMode = { type };
  spawnParticles(state, x + def.w / 2, y + def.h / 2, 8, ['#c9a15c', '#9c8255', '#e6d4ae'], { speed: .8, size: 1.3, life: .5 });
  state.dirty = true;
  return true;
}

export function cancelBuilding(state, id) {
  const b = state.buildings.find(v => v.id === id);
  if (!b) return;
  if (b.complete) {
    notify(state, 'Completed structures cannot be cancelled. Use deconstruct.', 'bad');
    return;
  }
  const def = BUILDINGS[b.type];
  for (const [r, n] of Object.entries(def.cost)) addResource(state, r, Math.floor(n / 2), true);
  state.buildings = state.buildings.filter(v => v.id !== id);
  if (state.selected?.id === id) state.selected = null;
  logEvent(state, `Cancelled ${def.name}. Half the materials recovered.`, '⌫');
  state.dirty = true;
}

export function markFeature(state, feature) {
  if (!feature) return;
  feature.marked = !feature.marked;
  state.dirty = true;
}

export function setPriority(state, colonistId, work, value) {
  const c = state.colonists.find(v => v.id === colonistId);
  if (!c) return;
  c.priorities[work] = value;
  if (c.job && c.job.workType === work && value === 4) clearJob(state, c);
  state.dirty = true;
}

export function select(state, kind, id) {
  state.selected = kind ? { kind, id } : null;
  state.dirty = true;
}

export function setSpeed(state, speed) {
  if (speed === 0) {
    if (state.speed !== 0) state.prevSpeed = state.speed;
    state.speed = 0;
  } else {
    state.speed = speed;
    state.prevSpeed = speed;
  }
  state.dirty = true;
}

export function togglePause(state) {
  setSpeed(state, state.speed === 0 ? state.prevSpeed || 1 : 0);
}

export function startExpedition(state, id) {
  if (state.expedition) { notify(state, 'A party is already in the field.', 'bad'); return; }
  const exp = EXPEDITIONS.find(e => e.id === id);
  if (!exp) return;
  if (exp.requires) {
    const loc = state.quests.find(q => q.id === exp.requires);
    if (!loc || loc.status !== 'complete') { notify(state, 'That place has not been discovered.', 'bad'); return; }
  }
  if (!canAfford(state, exp.cost)) { notify(state, 'The party lacks supplies.', 'bad'); return; }
  spend(state, exp.cost);
  const candidates = [...state.colonists].filter(c => !c.dead && !c.downed).sort((a, b) => (b.skills[exp.skill] || 0) - (a.skills[exp.skill] || 0));
  const party = candidates.slice(0, Math.min(2, candidates.length));
  for (const c of party) { c.onExpedition = true; clearJob(state, c); c.status = 'On expedition'; }
  state.expedition = {
    id, name: exp.name, daysLeft: Math.max(1, Math.round(exp.days * 1.5)), risk: exp.risk,
    party: party.map(c => c.id), started: state.time.day, reward: exp.reward, quest: exp.quest,
    progress: 0, total: Math.max(1, Math.round(exp.days * 1.5)),
  };
  logEvent(state, `A party sets out for <strong>${exp.name}</strong>.`, '◈', 'epic');
  notify(state, `Expedition departed: ${exp.name}.`, 'epic');
  showBanner(state, exp.name, exp.desc, 'Expedition');
  state.dirty = true;
}

function completeExpedition(state) {
  const exp = state.expedition;
  if (!exp) return;
  for (const [r, n] of Object.entries(exp.reward)) {
    if (r === 'research') addResearch(state, n);
    else addResource(state, r, n);
  }
  for (const id of exp.party) {
    const c = state.colonists.find(v => v.id === id);
    if (c) {
      c.onExpedition = false;
      c.x = state.world.campX + (Math.random() - .5) * 2;
      c.y = state.world.campY + 2;
      c.hunger = Math.max(12, c.hunger - 20);
      c.rest = Math.max(8, c.rest - 25);
      c.status = 'Returned';
      c.skills[exp.skill] = Math.min(10, (c.skills[exp.skill] || 1) + 0.4);
    }
  }
  logEvent(state, `The party returns from <strong>${exp.name}</strong>. ${Object.entries(exp.reward).map(([r, n]) => `+${n} ${RESOURCE_META[r]?.name || 'research'}`).join(', ')}.`, '◈', 'epic');
  notify(state, `Expedition returned from ${exp.name}.`, 'epic');
  if (exp.quest) {
    const q = state.quests.find(v => v.id === exp.quest);
    if (q) { q.progress = 1; q.status = 'complete'; }
  }
  state.expedition = null;
  checkQuests(state);
  state.dirty = true;
}

export function checkQuests(state) {
  for (const q of state.quests) {
    if (q.status !== 'active') continue;
    if (q.id === 'home') q.progress = Math.min(q.total, state.stats.built);
    if (q.id === 'veil') q.progress = Math.min(q.total, state.stats.kills);
    if (q.id === 'shrine' && q.progress >= 1) q.status = 'complete';
    if (q.progress >= q.total) {
      q.status = 'complete';
      if (q.id === 'home') { addResearch(state, 30); addResource(state, 'silver', 30); }
      if (q.id === 'veil') { for (const c of state.colonists) c.mood = Math.min(100, c.mood + 10); addResource(state, 'crystal', 3); }
      if (q.id === 'shrine') { addResearch(state, 40); addResource(state, 'crystal', 6); state.quests.find(v => v.id === 'shrine').status = 'complete'; }
      logEvent(state, `Quest complete: <strong>${q.title}</strong>.`, '✦', 'epic');
      notify(state, `Quest complete — ${q.title}.`, 'epic');
      showBanner(state, q.title, 'The chronicle remembers this deed. Your people will tell it around the fire for years.', 'Quest Complete');
      spawnParticles(state, state.world.campX, state.world.campY, 24, ['#e9c987', '#f4e3b5'], { speed: 1.5, life: 1.5, lift: .6, gravity: .05 });
    }
  }
}

function updateTime(state, dt) {
  const t = state.time;
  const before = t.hour;
  t.hour += dt * (24 / 300); // one day = five minutes at 1x
  t.weatherTtl -= dt;
  const crossed = Math.floor(before) !== Math.floor(t.hour);
  if (crossed) onHour(state, Math.floor(t.hour) % 24);
  if (t.hour >= 24) {
    t.hour -= 24;
    t.day++;
    t.dayInSeason++;
    state.stats.daysSurvived = t.day;
    if (t.dayInSeason > 12) {
      t.dayInSeason = 1;
      t.season = (t.season + 1) % SEASONS.length;
      logEvent(state, `The season turns. <strong>${SEASONS[t.season].name}</strong> settles over the Marches.`, '◐', 'epic');
    }
    if (t.day === 4) {
      const q = state.quests.find(v => v.id === 'barrow');
      if (!q) state.quests.push({ id: 'barrow', title: 'Kingsbarrow', desc: 'A hill that was not always a hill. Its door has opened.', objective: 'Open Kingsbarrow', progress: 0, total: 1, status: 'active', reward: 'Treasure' });
    }
    logEvent(state, `Dawn breaks on day ${state.stats.daysSurvived}. The colony endures.`, '☼', 'good');
    for (const c of state.colonists) if (!c.dead) c.mood = Math.min(100, c.mood + 2);
    checkQuests(state);
  }
  if (t.weatherTtl <= 0) {
    const season = SEASONS[t.season];
    t.weather = pick(Math.random, season.weather);
    t.weatherTtl = 7 + Math.random() * 10;
    if (t.weather.includes('rain') || t.weather.includes('sleet') || t.weather.includes('Mist')) {
      for (const c of state.colonists) c.mood = Math.max(0, c.mood - 1);
    }
    state.dirty = true;
  }
  if (state.nextIncident && t.day >= state.nextIncident.day && t.hour >= state.nextIncident.hour) {
    state.nextIncident = null;
    triggerIncident(state);
  }
  if (state.expedition) {
    state.expedition.progress += dt / (300 * 0.45);
    if (state.expedition.progress >= state.expedition.total) completeExpedition(state);
  }
}

function onHour(state, hour) {
  state.dirty = true;
  if (hour === 6) {
    // New day checks and a small chance of discovery.
    if (Math.random() < 0.32) {
      const amount = 3 + Math.floor(Math.random() * 6);
      addResource(state, 'food', amount, true);
      logEvent(state, `Foragers return with ${amount} food from the riverbank.`, '❦', 'good');
    }
  }
  if (hour === 21 && state.stats.daysSurvived > 1 && Math.random() < 0.35) {
    logEvent(state, 'Something howls beyond the palisade. The watch doubles.', '◈');
  }
  if (state.nextIncident === null && !state.expedition && hour >= 6 && Math.random() < 0.14) {
    const days = state.stats.daysSurvived;
    state.nextIncident = { day: state.time.day, hour: Math.min(23.5, hour + 3 + Math.random() * 5) };
  }
}

export function triggerIncident(state, forced = null) {
  const day = state.time.day;
  const pool = INCIDENTS.filter(i => !forced && day >= i.minDay) || [];
  if (forced) {
    const chosen = INCIDENTS.find(i => i.id === forced);
    if (chosen) resolveIncident(state, chosen);
    return;
  }
  let total = pool.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  let chosen = pool[0] || INCIDENTS[0];
  for (const i of pool) { roll -= i.weight; if (roll <= 0) { chosen = i; break; } }
  resolveIncident(state, chosen);
  const nextDelay = 7 + Math.random() * 14;
  state.nextIncident = { day: state.time.day + Math.floor((state.time.hour + nextDelay) / 24), hour: (state.time.hour + nextDelay) % 24 };
}

function resolveIncident(state, incident) {
  showBanner(state, incident.title, incident.text, incident.kicker);
  logEvent(state, `<strong>${incident.title}.</strong> ${incident.text}`, '◈', incident.spawn ? 'bad' : 'epic');
  if (incident.spawn) {
    const count = incident.count[0] + Math.floor(Math.random() * (incident.count[1] - incident.count[0] + 1));
    for (let i = 0; i < count; i++) spawnEnemy(state, incident.spawn, i);
    notify(state, `${incident.title} — ${count} hostiles approach.`, 'bad');
    state.speed = state.speed === 0 ? 0 : 1;
    return;
  }
  switch (incident.action) {
    case 'traveler': {
      if (state.colonists.filter(c => !c.dead).length >= 9) {
        addResource(state, 'silver', 9);
        notify(state, 'The traveler leaves a small pouch of silver and moves on.', '');
        logEvent(state, 'A traveler shares news, then walks on. <strong>+9 silver</strong>.', '◈', 'good');
      } else {
        addColonist(state, Math.random);
        logEvent(state, 'The traveler chooses to stay. Another chair by the fire.', '◈', 'good');
      }
      break;
    }
    case 'merchant': {
      if (state.resources.silver >= 18) {
        state.resources.silver -= 18;
        addResource(state, 'herbs', 6, true);
        addResource(state, 'crystal', 2, true);
        notify(state, 'The masked merchant sells 6 herbs and 2 crystal for 18 silver.', 'good');
        logEvent(state, 'A masked merchant trades <strong>6 herbs, 2 crystal</strong> for 18 silver.', '◈', 'good');
      } else {
        notify(state, 'The merchant scoffs at your empty purse and moves on.', 'bad');
      }
      break;
    }
    case 'eclipse': {
      state.time.weather = 'Eclipse';
      state.time.weatherTtl = 20;
      for (const c of state.colonists) c.mood = Math.max(0, c.mood - 9);
      notify(state, 'An unnatural eclipse. Moods sour; shadows move.', 'bad');
      break;
    }
    case 'cache': {
      const rewards = { wood: 18, stone: 12, food: 10, silver: 8 };
      for (const [r, n] of Object.entries(rewards)) addResource(state, r, n, true);
      notify(state, 'A sealed cache yields timber, stone, food and silver.', 'good');
      logEvent(state, 'A rain-sealed cache is opened: <strong>+18 wood, +12 stone, +10 food, +8 silver</strong>.', '◈', 'good');
      break;
    }
    case 'omen': {
      addResearch(state, 12);
      notify(state, 'The waystone murmurs. +12 research; the shrine calls.', 'epic');
      break;
    }
    case 'festival': {
      for (const c of state.colonists) c.mood = Math.min(100, c.mood + 13);
      state.resources.meals += 4;
      notify(state, 'A small festival. Mood rises; four meals appear from nowhere.', 'good');
      logEvent(state, 'Honey, bad singing, and a night of defiant joy. <strong>Mood rises.</strong>', '❦', 'good');
      break;
    }
  }
  state.dirty = true;
}

export function spawnEnemy(state, type, index = 0) {
  const info = ENEMY_TYPES[type];
  const edge = Math.floor(Math.random() * 4);
  let x, y, tries = 0;
  do {
    if (edge === 0) { x = 2 + Math.floor(Math.random() * (state.world.w - 4)); y = 2; }
    else if (edge === 1) { x = state.world.w - 3; y = 2 + Math.floor(Math.random() * (state.world.h - 4)); }
    else if (edge === 2) { x = 2 + Math.floor(Math.random() * (state.world.w - 4)); y = state.world.h - 3; }
    else { x = 2; y = 2 + Math.floor(Math.random() * (state.world.h - 4)); }
    tries++;
  } while (!isWalkable(state, x, y) && tries < 80);
  if (!isWalkable(state, x, y)) { x = state.world.campX + 12; y = state.world.campY; }
  const scale = 1 + Math.max(0, state.time.day - 1) * 0.055;
  const e = {
    id: 'e' + (state.nextId++), type, name: info.name,
    x, y, hp: Math.round(info.hp * scale), maxHp: Math.round(info.hp * scale),
    damage: info.damage, range: info.range, speed: info.speed, color: info.color,
    accent: info.accent, shape: info.shape, cooldown: 1 + index * .25, path: [],
    pathTimer: 0, targetId: null, dead: false, hitFlash: 0, facing: 1, bob: Math.random() * 6,
    xp: info.xp, loot: info.loot,
  };
  state.enemies.push(e);
  return e;
}

export function simulate(state, rawDt) {
  if (state.speed === 0 || state.gameOver) {
    updateVisuals(state, rawDt);
    return;
  }
  const speedScale = state.speed === 1 ? 1 : state.speed === 2 ? 2.8 : 7;
  const dt = Math.min(rawDt, .08) * speedScale;
  state.simTime += dt;
  state.threat = state.enemies.filter(e => !e.dead).length;
  updateTime(state, dt);
  updateFarms(state, dt);
  updateFeatures(state, dt);
  updateColonists(state, dt);
  updateEnemies(state, dt);
  updateProjectiles(state, dt);
  updateFloats(state, dt);
  updateVisuals(state, rawDt);
  updateMood(state, dt);
  state.tick++;
  if (state.tick % 6 === 0) state.dirty = true;
}

function updateVisuals(state, dt) {
  const pdt = Math.min(dt, .1);
  for (const p of state.particles) {
    p.life -= pdt;
    p.x += p.vx * pdt;
    p.y += p.vy * pdt;
    p.vy += p.gravity * pdt;
    p.vx *= .985;
    p.vy *= .985;
  }
  state.particles = state.particles.filter(p => p.life > 0);
  for (const f of state.floats) { f.ttl -= pdt; f.y += f.vy * pdt; f.vy *= .96; }
  state.floats = state.floats.filter(f => f.ttl > 0);
  if (state.banner) {
    state.banner.ttl -= dt;
    if (state.banner.ttl <= 0) state.banner = null;
  }
  state.notifications = state.notifications.filter(n => { n.ttl -= dt; return n.ttl > 0; });
  for (const c of state.colonists) { c.attackTimer = Math.max(0, c.attackTimer - dt); c.movePhase += dt * 7; }
  for (const e of state.enemies) { e.cooldown = Math.max(0, e.cooldown - dt); e.hitFlash = Math.max(0, e.hitFlash - dt); e.bob += dt * 4; }
}

function updateFarms(state, dt) {
  for (const b of state.buildings) {
    if (b.type !== 'farm' || !b.complete) continue;
    const growthRate = state.completedResearch.includes('agriculture') ? 0.0062 : 0.0048;
    b.crop = Math.min(1, (b.crop || 0) + dt * growthRate * (0.8 + (state.time.season === 2 ? -0.3 : state.time.season === 0 ? 0.2 : 0)));
  }
}

function updateFeatures(state, dt) {
  for (const f of state.features) {
    if (f.type === 'bush' && f.amount < f.max && f.regrow) {
      f.regrowTimer += dt;
      if (f.regrowTimer > f.regrow) {
        f.amount = f.max;
        f.regrowTimer = 0;
        state.dirty = true;
      }
    }
  }
}

function updateMood(state, dt) {
  if (state.tick % 8 !== 0) return;
  const campX = state.world.campX, campY = state.world.campY;
  const hasFire = state.buildings.some(b => b.type === 'campfire' && b.complete);
  const hasShrine = state.buildings.some(b => b.type === 'shrine' && b.complete);
  const hasWell = state.buildings.some(b => b.type === 'well' && b.complete);
  const beds = state.buildings.filter(b => b.type === 'bed' && b.complete).length;
  const night = state.time.hour < 6 || state.time.hour > 21;
  let total = 0, alive = 0;
  for (const c of state.colonists) {
    if (c.dead || c.onExpedition) continue;
    alive++;
    let target = c.moodBase;
    target += (c.hunger - 55) * .13;
    target += (c.rest - 55) * .09;
    if (hasFire) target += 4;
    if (hasShrine) target += 8;
    if (hasWell) target += 3;
    if (beds >= state.colonists.filter(v => !v.dead).length) target += 3;
    if (state.time.weather.includes('rain') || state.time.weather.includes('sleet')) target -= 5;
    if (state.time.weather === 'Eclipse') target -= 12;
    if (state.recentDeath > 0) target -= state.recentDeath;
    for (const tr of c.traits) {
      const td = TRAITS[tr];
      if (td?.mood) target += td.mood;
      if (tr === 'nightOwl' && night) target += 5;
      if (tr === 'wanderlust' && c.job?.type === 'idle') target -= 4;
      if (tr === 'scarred' && state.time.weather.includes('rain')) target -= 6;
    }
    const home = dist(c.x, c.y, campX, campY);
    if (home < 6) target += 2;
    target = clamp(target, 0, 100);
    c.mood += (target - c.mood) * .07;
    c.mood = clamp(c.mood, 0, 100);
    total += c.mood;
    c.thought = thoughtFor(c, state);
    if (c.mood < 16 && c.breakTimer <= 0) {
      c.breakTimer = 30;
      logEvent(state, `<strong>${c.name}</strong> is overcome by despair and wanders from their duties.`, '☹', 'bad');
      clearJob(state, c);
    }
    if (c.breakTimer > 0) c.breakTimer -= dt;
  }
  state.mood = alive ? total / alive : 0;
  if (state.recentDeath > 0) state.recentDeath = Math.max(0, state.recentDeath - 0.03);
}

function thoughtFor(c, state) {
  if (c.downed) return 'Bleeding into the dirt.';
  if (c.bleeding > 0) return 'Wounded and bleeding.';
  if (c.hunger < 22) return 'Hungry enough to chew leather.';
  if (c.rest < 20) return 'Exhausted.';
  if (c.job?.type === 'fight') return 'Standing between the dark and the fire.';
  if (state.time.weather === 'Eclipse') return 'The sun has turned its face away.';
  if (c.mood > 78) return 'Grateful for this strange, stubborn home.';
  if (c.mood < 30) return 'Wondering what they left behind.';
  if (c.job?.type === 'research') return 'Chasing a thought through old symbols.';
  if (c.job?.type === 'cook') return 'Something warm, at last.';
  return 'Watching the horizon.';
}

function updateColonists(state, dt) {
  for (const c of state.colonists) {
    if (c.dead) continue;
    if (c.onExpedition) { c.status = 'On expedition'; continue; }
    if (c.downed) {
      c.downTimer += dt;
      if (c.bleeding > 0) {
        c.bleeding = Math.max(0, c.bleeding - dt * .04);
        c.hp -= dt * .35;
      }
      if (c.hp <= -8 || c.downTimer > 150) killColonist(state, c);
      continue;
    }
    c.hunger = Math.max(0, c.hunger - dt * .17);
    c.rest = Math.max(0, c.rest - dt * .105);
    if (c.hunger <= 0) { c.hp -= dt * .35; c.bleeding = Math.max(c.bleeding, .2); }
    if (c.bleeding > 0) {
      c.hp -= dt * c.bleeding * .11;
      c.bleeding = Math.max(0, c.bleeding - dt * .055);
      if (c.hp <= 0) downColonist(state, c, 'bled out');
    } else if (c.hp < c.maxHp && c.job?.type !== 'sleep') {
      c.hp = Math.min(c.maxHp, c.hp + dt * .06);
    }
    if (c.breakTimer > 0) {
      c.breakTimer -= dt;
      if (!c.job || c.job.type === 'idle') { c.status = 'Despairing'; continue; }
    }
    if (state.threat > 0 && c.hp > 18 && (c.priorities.guard || 4) < 4) {
      if (!c.job || c.job.type !== 'fight') {
        const target = nearestEnemy(state, c.x, c.y);
        if (target) { startFight(state, c, target); continue; }
      }
    }
    if (c.job?.type === 'fight' && (state.threat === 0 || !state.enemies.some(e => e.id === c.job.targetId && !e.dead))) {
      clearJob(state, c); c.job = null;
    }
    if (!c.job) chooseActivity(state, c);
    if (!c.job) { c.status = c.breakTimer > 0 ? 'Despairing' : 'Idle'; continue; }
    if (c.job.type === 'fight') { updateFight(state, c, dt); continue; }
    if (c.job.type === 'sleep') { updateSleep(state, c, dt); continue; }
    if (c.job.type === 'eat') { updateEat(state, c, dt); continue; }
    updateWork(state, c, dt);
  }
}

function nearestEnemy(state, x, y) {
  let best = null, bd = 99;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function nearestColonist(state, x, y) {
  let best = null, bd = 99;
  for (const c of state.colonists) {
    if (c.dead || c.downed || c.onExpedition) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function startFight(state, c, enemy) {
  clearJob(state, c);
  c.job = { type: 'fight', targetId: enemy.id, workType: 'guard', x: enemy.x, y: enemy.y };
  c.status = CLASSES[c.cls].ranged ? 'Loosing arrows' : 'Charging';
  c.path = [];
  c.pathTimer = 0;
}

function updateFight(state, c, dt) {
  const e = state.enemies.find(v => v.id === c.job.targetId && !v.dead);
  if (!e) { clearJob(state, c); return; }
  const cls = CLASSES[c.cls];
  const d = dist(c.x, c.y, e.x, e.y);
  c.facing = e.x < c.x ? -1 : 1;
  c.pathTimer -= dt;
  const desired = cls.ranged ? Math.max(2.8, cls.range * .62) : 1.05;
  if (d > desired && c.pathTimer <= 0) {
    c.pathTimer = .7;
    const spot = findAdjacentWalkable(state, Math.round(e.x), Math.round(e.y));
    if (spot) {
      const path = findPath(state, Math.round(c.x), Math.round(c.y), spot.x, spot.y, 1800);
      if (path) c.path = path;
      c.pathIndex = 0;
    }
  }
  if (d > desired) { moveAlongPath(state, c, dt, 1.15); c.status = 'Closing'; }
  else { c.status = cls.ranged ? 'Firing' : 'Fighting'; }
  if (c.attackTimer <= 0 && d <= (cls.ranged ? cls.range : 1.45)) {
    c.attackTimer = cls.ranged ? 1.45 : 1.0;
    const bonus = 1 + (c.skills.combat || 1) * .075;
    let dmg = range(Math.random, cls.damage[0], cls.damage[1]) * bonus;
    if (cls.ranged) {
      const color = c.cls === 'sorcerer' ? '#c79ae8' : c.cls === 'cleric' ? '#f0dfaa' : '#d7b477';
      state.projectiles.push({
        x: c.x, y: c.y - .25, targetId: e.id, tx: e.x, ty: e.y, speed: 9,
        damage: dmg, color, type: c.cls === 'sorcerer' ? 'orb' : 'arrow', life: 2.2,
      });
      spawnParticles(state, c.x + c.facing * .3, c.y - .3, 3, [color], { speed: .5, life: .3, size: 1 });
    } else {
      hurtEnemy(state, e, dmg, c);
      spawnParticles(state, e.x, e.y - .2, 5, ['#8d3c31', '#b25343', '#5b2d25'], { speed: .9, life: .55, size: 1.5, gravity: 1.2 });
    }
  }
}

function hurtEnemy(state, e, dmg, source) {
  if (e.dead) return;
  e.hp -= dmg;
  e.hitFlash = .15;
  addFloat(state, e.x, e.y - .8, Math.round(dmg), '#e7b08a');
  if (e.hp <= 0) {
    e.dead = true;
    state.stats.kills++;
    if (source) source.skills.combat = Math.min(10, (source.skills.combat || 1) + .08);
    spawnParticles(state, e.x, e.y - .2, 16, ['#7a2d25', '#a54636', '#d0b58b'], { speed: 1.5, life: .9, size: 2, gravity: 1.2 });
    for (const [r, n] of Object.entries(ENEMY_TYPES[e.type].loot)) addResource(state, r, n, true);
    if (e.type === 'ogre' || e.type === 'wraith') logEvent(state, `<strong>${source?.name || 'The colony'}</strong> fells a ${e.name}.`, '⚔', 'good');
    checkQuests(state);
    if (state.enemies.every(v => v.dead)) {
      notify(state, 'The attack is broken. The fire still burns.', 'good');
      logEvent(state, 'The last hostile falls. Silence returns to the Marches.', '⚔', 'good');
      for (const c of state.colonists) if (!c.dead) c.mood = Math.min(100, c.mood + 5);
    }
  }
}

function downColonist(state, c, reason) {
  if (c.downed || c.dead) return;
  c.downed = true;
  c.hp = 0;
  c.bleeding = Math.max(c.bleeding, 1.4);
  c.downTimer = 0;
  clearJob(state, c);
  c.status = 'Downed';
  logEvent(state, `<strong>${c.name}</strong> is downed — ${reason}.`, '✚', 'bad');
  notify(state, `${c.name} is down and bleeding.`, 'bad');
  spawnParticles(state, c.x, c.y, 12, ['#8d3c31', '#b25343'], { speed: 1.1, life: .8, size: 1.6, gravity: 1.1 });
}

function killColonist(state, c) {
  if (c.dead) return;
  c.dead = true;
  c.downed = false;
  clearJob(state, c);
  c.status = 'Dead';
  state.recentDeath = Math.min(28, state.recentDeath + 14);
  logEvent(state, `<strong>${c.name}</strong> has died. The colony will carry the weight of it.`, '†', 'bad');
  notify(state, `${c.name} is dead.`, 'bad');
  showBanner(state, 'A Life Ends', `${c.name} has died. The Marches do not apologize.`, 'Death in the Colony');
  const f = { id: 'f' + (state.nextId++), type: 'grave', x: Math.round(c.x), y: Math.round(c.y), amount: 1, max: 1, marked: false, regrow: 0, sway: 0, size: 1, variant: 0 };
  state.features.push(f);
  state.featureIndex.set(key(f.x, f.y), f);
  if (state.selected?.id === c.id) state.selected = null;
  if (state.colonists.every(v => v.dead)) {
    state.gameOver = true;
    setTimeout(() => {}, 0);
  }
}

function clearJob(state, c) {
  c.job = null;
  c.path = [];
  c.pathIndex = 0;
  c.status = 'Idle';
}

function chooseActivity(state, c) {
  if (state.threat > 0 && (c.priorities.guard || 4) < 4 && c.hp > 18) {
    const target = nearestEnemy(state, c.x, c.y);
    if (target) { startFight(state, c, target); return; }
  }
  // Critical needs.
  if (c.hunger < 24 && (state.resources.meals > 0 || state.resources.food > 0)) {
    startEat(state, c); return;
  }
  const sleepy = c.rest < 16 || ((state.time.hour >= 22 || state.time.hour < 5) && c.rest < 68);
  if (sleepy && state.threat === 0) { startSleep(state, c); return; }
  if (c.hp < c.maxHp * .35 && c.bleeding > 0 && state.threat === 0) {
    startSleep(state, c, true); return;
  }
  if (c.breakTimer > 0) { startWander(state, c); return; }
  const job = findJob(state, c);
  if (job) { startJob(state, c, job); return; }
  startWander(state, c);
}

function startEat(state, c) {
  let spot = state.buildings.find(b => b.type === 'campfire' && b.complete);
  if (!spot) spot = state.buildings.find(b => b.type === 'stockpile' && b.complete);
  const target = spot ? { x: spot.x + Math.floor(spot.w / 2), y: spot.y + Math.floor(spot.h / 2) } : { x: c.x, y: c.y };
  clearJob(state, c);
  const path = findPath(state, Math.round(c.x), Math.round(c.y), target.x, target.y, 2000);
  c.job = { type: 'eat', x: target.x, y: target.y, phase: 'moving', progress: 0, workType: 'patient', duration: 3.2 };
  c.path = path || [];
  c.pathIndex = 0;
  c.status = 'Hungry';
  if (!path && dist(c.x, c.y, target.x, target.y) > 1.5) { c.job.phase = 'working'; }
}

function updateEat(state, c, dt) {
  if (c.job.phase === 'moving') {
    if (moveAlongPath(state, c, dt)) c.job.phase = 'working';
    c.status = 'Heading to eat';
    if (!c.path.length) c.job.phase = 'working';
    return;
  }
  c.job.progress += dt;
  c.status = 'Eating';
  if (c.job.progress >= c.job.duration) {
    if (state.resources.meals > 0) {
      state.resources.meals--;
      c.hunger = Math.min(100, c.hunger + 62);
      c.mood = Math.min(100, c.mood + 4);
      addFloat(state, c.x, c.y - .9, 'Meal', '#e9c987');
    } else if (state.resources.food > 0) {
      state.resources.food--;
      c.hunger = Math.min(100, c.hunger + 38);
      addFloat(state, c.x, c.y - .9, 'Raw food', '#b8a378');
    }
    c.hunger = Math.min(100, c.hunger + 5);
    clearJob(state, c);
  }
}

function startSleep(state, c, medical = false) {
  const beds = state.buildings.filter(b => (b.type === 'bed' || b.type === 'infirmary') && b.complete);
  const occupied = new Set(state.colonists.filter(v => v !== c && v.job?.type === 'sleep' && v.job.buildingId).map(v => v.job.buildingId));
  const bed = beds.find(b => !occupied.has(b.id)) || null;
  const tx = bed ? bed.x + Math.floor(bed.w / 2) : state.world.campX;
  const ty = bed ? bed.y + Math.floor(bed.h / 2) : state.world.campY + 1;
  clearJob(state, c);
  const path = findPath(state, Math.round(c.x), Math.round(c.y), tx, ty, 2200);
  c.job = { type: 'sleep', x: tx, y: ty, phase: 'moving', progress: 0, workType: 'patient', buildingId: bed?.id, medical };
  c.path = path || [];
  c.pathIndex = 0;
  c.status = 'Seeking rest';
}

function updateSleep(state, c, dt) {
  if (c.job.phase === 'moving') {
    c.status = 'Seeking a bed';
    if (moveAlongPath(state, c, dt) || !c.path.length) c.job.phase = 'sleeping';
    return;
  }
  c.status = 'Sleeping';
  const comfort = c.job.buildingId ? (state.completedResearch.includes('medicine') ? 4.4 : 3.6) : 2.0;
  c.rest = Math.min(100, c.rest + dt * comfort);
  if (c.job.medical) { c.hp = Math.min(c.maxHp, c.hp + dt * .35); c.bleeding = Math.max(0, c.bleeding - dt * .12); }
  else c.hp = Math.min(c.maxHp, c.hp + dt * .08);
  if (c.rest >= 92 || (state.threat > 0 && c.rest > 30)) {
    clearJob(state, c);
    c.status = 'Rested';
  }
}

function startWander(state, c) {
  const angle = Math.random() * Math.PI * 2;
  const r = 1.5 + Math.random() * 4.5;
  let tx = Math.round(state.world.campX + Math.cos(angle) * r);
  let ty = Math.round(state.world.campY + Math.sin(angle) * r);
  if (!isWalkable(state, tx, ty)) { tx = Math.round(c.x); ty = Math.round(c.y); }
  const path = findPath(state, Math.round(c.x), Math.round(c.y), tx, ty, 800) || [];
  c.job = { type: 'idle', x: tx, y: ty, path: null, phase: 'moving', wait: .5 + Math.random() * 2, workType: 'haul' };
  c.path = path;
  c.pathIndex = 0;
  c.status = c.breakTimer > 0 ? 'Despairing' : 'Wandering';
}

function findJob(state, c) {
  const candidates = createJobs(state).filter(j => (c.priorities[j.workType] || 4) < 4);
  if (!candidates.length) return null;
  let best = null, bestScore = Infinity;
  for (const j of candidates) {
    if (j.claimedBy && j.claimedBy !== c.id) continue;
    const d = dist(c.x, c.y, j.x, j.y);
    const skill = WORK_TYPES.find(w => w.id === j.workType)?.skill;
    const sk = skill ? c.skills[skill] || 1 : 4;
    const score = (c.priorities[j.workType] || 4) * 90 + d * 3 - sk * 2.2 + (j.urgency || 0);
    if (score < bestScore) { bestScore = score; best = j; }
  }
  return best;
}

function createJobs(state) {
  const jobs = [];
  const claimed = new Set();
  for (const c of state.colonists) {
    if (c.job?.jobKey) claimed.add(c.job.jobKey);
  }
  const add = (job) => {
    if (!job.jobKey) job.jobKey = job.type + ':' + (job.targetId || job.featureId || job.buildingId || `${job.x},${job.y}`);
    if (claimed.has(job.jobKey)) return;
    claimed.add(job.jobKey);
    jobs.push(job);
  };

  // Construction first — the colony needs walls more than another story.
  for (const b of state.buildings) {
    if (b.complete) continue;
    const def = BUILDINGS[b.type];
    add({ type: 'construct', workType: 'construct', buildingId: b.id, x: b.x, y: b.y, targetId: b.id, urgency: -40, duration: def.time });
  }

  // Marked resources.
  for (const f of state.features) {
    if (!f.marked || f.amount <= 0 || f.type === 'grave' || f.type === 'waystone') continue;
    let workType = 'chop', label = 'Chopping';
    if (f.type === 'rock' || f.type === 'crystal' || f.type === 'ruinStone') { workType = 'mine'; label = 'Mining'; }
    if (f.type === 'bush') { workType = 'harvest'; label = 'Foraging'; }
    add({ type: 'gather', workType, featureId: f.id, x: f.x, y: f.y, targetId: f.id, urgency: -10, label });
  }

  // Farms: plant empty plots, harvest ripe ones.
  for (const b of state.buildings) {
    if (b.type !== 'farm' || !b.complete) continue;
    if ((b.crop || 0) >= 1) add({ type: 'harvest', workType: 'harvest', buildingId: b.id, targetId: b.id, x: b.x, y: b.y, urgency: -30, label: 'Harvesting' });
    else if ((b.crop || 0) <= 0) add({ type: 'plant', workType: 'plant', buildingId: b.id, targetId: b.id, x: b.x, y: b.y, urgency: -5, label: 'Sowing' });
  }

  // Cooking.
  const fire = state.buildings.find(b => b.type === 'campfire' && b.complete);
  if (fire && state.resources.food >= 2 && state.resources.meals < Math.max(6, state.colonists.filter(c => !c.dead).length * 2)) {
    add({ type: 'cook', workType: 'cook', buildingId: fire.id, targetId: fire.id, x: fire.x, y: fire.y, urgency: -15, duration: 6.5, label: 'Cooking' });
  }

  // Research.
  const desk = state.buildings.find(b => b.type === 'researchDesk' && b.complete);
  if (desk && state.researchActive && !state.completedResearch.includes(state.researchActive)) {
    add({ type: 'research', workType: 'research', buildingId: desk.id, targetId: desk.id, x: desk.x, y: desk.y, urgency: 10, duration: 15, label: 'Researching' });
  }

  // Crafting.
  const bench = state.buildings.find(b => (b.type === 'workbench' || b.type === 'forge') && b.complete);
  if (bench && state.resources.wood >= 4 && state.resources.silver < 160) {
    add({ type: 'craft', workType: 'craft', buildingId: bench.id, targetId: bench.id, x: bench.x, y: bench.y, urgency: 25, duration: 14, label: 'Crafting' });
  }

  // Doctor.
  const patient = state.colonists.find(v => !v.dead && !v.onExpedition && (v.bleeding > 0 || v.hp < v.maxHp * .7) && v.id !== '');
  if (patient) {
    add({ type: 'doctor', workType: 'doctor', patientId: patient.id, targetId: patient.id, x: patient.x, y: patient.y, urgency: -55, duration: 8, label: 'Healing' });
  }

  return jobs;
}

function findWorkSpot(state, x, y, def) {
  if (!def?.blocks && isWalkable(state, x, y)) return { x, y };
  return findAdjacentWalkable(state, x, y) || { x, y };
}

function startJob(state, c, job) {
  clearJob(state, c);
  const def = job.buildingId ? BUILDINGS[state.buildings.find(b => b.id === job.buildingId)?.type] : null;
  let spot;
  if (job.type === 'doctor') {
    const patient = state.colonists.find(v => v.id === job.patientId);
    spot = patient ? findAdjacentWalkable(state, Math.round(patient.x), Math.round(patient.y)) : null;
  } else if (job.type === 'gather') {
    spot = findAdjacentWalkable(state, job.x, job.y);
  } else {
    spot = findWorkSpot(state, job.x, job.y, def);
  }
  if (!spot) return;
  const path = findPath(state, Math.round(c.x), Math.round(c.y), spot.x, spot.y, 2600);
  if (!path) {
    if (c.job?.type !== 'idle') c.status = 'No path';
    return;
  }
  const skill = WORK_TYPES.find(w => w.id === job.workType)?.skill;
  const sk = skill ? c.skills[skill] || 1 : 4;
  job.phase = 'moving';
  job.progress = 0;
  job.duration = (job.duration || 7) * (1.15 - sk * .045);
  if (job.type === 'construct') {
    job.duration *= state.completedResearch.includes('stonecraft') ? .85 : 1;
    job.duration *= 1.15 - sk * .05;
  }
  job.startX = c.x; job.startY = c.y;
  c.job = job;
  c.path = path;
  c.pathIndex = 0;
  c.status = job.label || 'Working';
  if (job.type === 'plant') c.status = 'Sowing';
}

function moveAlongPath(state, c, dt, speedMult = 1) {
  if (!c.path || c.pathIndex >= c.path.length) return true;
  const speedTrait = c.traits.includes('sluggish') ? .88 : c.traits.includes('quick') ? 1.15 : 1;
  const speed = 2.15 * speedTrait * speedMult * dt;
  let remaining = speed;
  while (remaining > 0 && c.pathIndex < c.path.length) {
    const node = c.path[c.pathIndex];
    const dx = node.x - c.x, dy = node.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= remaining) {
      c.x = node.x; c.y = node.y;
      c.pathIndex++;
      remaining -= d;
    } else {
      c.x += dx / d * remaining;
      c.y += dy / d * remaining;
      if (Math.abs(dx) > .05) c.facing = dx < 0 ? -1 : 1;
      remaining = 0;
    }
  }
  if (c.pathIndex >= c.path.length) { c.path = []; return true; }
  return false;
}

function updateWork(state, c, dt) {
  if (c.job.phase === 'moving') {
    c.status = c.job.type === 'construct' ? 'Building' : c.job.label || 'Working';
    if (moveAlongPath(state, c, dt)) c.job.phase = 'working';
    return;
  }
  const job = c.job;
  if (job.type === 'idle') {
    job.wait -= dt;
    c.status = c.breakTimer > 0 ? 'Despairing' : 'Wandering';
    if (job.wait <= 0) clearJob(state, c);
    return;
  }
  c.status = job.label || jobStatus(job);
  const skill = WORK_TYPES.find(w => w.id === job.workType)?.skill;
  const sk = skill ? c.skills[skill] || 1 : 4;
  job.progress += dt * (0.75 + sk * .04);
  if (job.type === 'sleep') return;
  if (job.progress < job.duration) return;

  switch (job.type) {
    case 'gather': completeGather(state, c, job); break;
    case 'construct': completeConstruct(state, c, job); break;
    case 'harvest': completeHarvest(state, c, job); break;
    case 'plant': completePlant(state, c, job); break;
    case 'cook': completeCook(state, c, job); break;
    case 'research': completeResearchWork(state, c, job); break;
    case 'craft': completeCraft(state, c, job); break;
    case 'doctor': completeDoctor(state, c, job); break;
  }
}

function jobStatus(job) {
  return {
    gather: job.label || 'Gathering', construct: 'Building', harvest: 'Harvesting',
    plant: 'Sowing', cook: 'Cooking', research: 'Researching', craft: 'Crafting',
    doctor: 'Healing', sleep: 'Sleeping', eat: 'Eating', idle: 'Wandering', fight: 'Fighting',
  }[job.type] || 'Working';
}

function completeGather(state, c, job) {
  const f = state.features.find(v => v.id === job.featureId);
  if (!f || f.amount <= 0) { clearJob(state, c); return; }
  const sk = c.skills[job.workType === 'chop' ? 'survival' : 'mining'] || 3;
  const take = Math.min(f.amount, 2 + Math.floor(sk / 2.5) + Math.floor(Math.random() * 3));
  f.amount -= take;
  const res = f.type === 'tree' ? 'wood' : f.type === 'rock' || f.type === 'ruinStone' ? 'stone' : f.type === 'crystal' ? 'crystal' : 'food';
  addResource(state, res, take, true);
  state.stats.gathered += take;
  state.dirty = true;
  c.skills[job.workType === 'chop' ? 'survival' : 'mining'] = Math.min(10, sk + .05);
  addFloat(state, f.x, f.y - .8, `+${take}`, res === 'wood' ? '#c7a56c' : res === 'stone' ? '#b8b0a0' : res === 'crystal' ? '#c79ae8' : '#9db078');
  spawnParticles(state, f.x, f.y - .3, 7, res === 'wood' ? ['#7a633d', '#ad8b50', '#5e633d'] : res === 'crystal' ? ['#a27dc4', '#d0b7e8'] : ['#8e8878', '#c2bbaa'], { speed: 1, life: .6, size: 1.5, gravity: .9 });
  if (f.amount <= 0) {
    state.featureIndex.delete(key(f.x, f.y));
    state.features = state.features.filter(v => v.id !== f.id);
  }
  clearJob(state, c);
}

function completeConstruct(state, c, job) {
  const b = state.buildings.find(v => v.id === job.buildingId);
  if (!b) { clearJob(state, c); return; }
  b.complete = true;
  b.progress = 100;
  state.stats.built++;
  const def = BUILDINGS[b.type];
  spawnParticles(state, b.x + b.w / 2, b.y + b.h / 2, 15, ['#c9a15c', '#e6d4ae', '#8c7b5b'], { speed: 1.3, life: .8, size: 1.6, gravity: .7 });
  addFloat(state, b.x + .5, b.y, def.name, '#e9c987');
  if (b.type === 'shrine') {
    logEvent(state, '<strong>The waystone shrine is restored.</strong> The air tastes of rain and old metal.', '◈', 'epic');
    showBanner(state, 'The Ward Restored', 'The waystone answers. Somewhere below, something ancient turns in its sleep.', 'Colony Milestone');
  } else {
    logEvent(state, `${def.name} completed.`, '⌂', 'good');
  }
  checkQuests(state);
  clearJob(state, c);
}

function completeHarvest(state, c, job) {
  const b = state.buildings.find(v => v.id === job.buildingId);
  if (!b) { clearJob(state, c); return; }
  const bonus = state.completedResearch.includes('agriculture') ? 1.35 : 1;
  const amount = Math.round((7 + Math.random() * 5) * bonus * (0.85 + (c.skills.plants || 3) * .025));
  addResource(state, 'food', amount, true);
  b.crop = 0;
  b.harvests = (b.harvests || 0) + 1;
  addFloat(state, b.x, b.y - .6, `+${amount} food`, '#a8b981');
  spawnParticles(state, b.x, b.y, 10, ['#c7b36d', '#8fa35f', '#e0c26f'], { speed: 1, life: .7, size: 1.4, gravity: .8 });
  c.skills.plants = Math.min(10, (c.skills.plants || 1) + .08);
  state.dirty = true;
  clearJob(state, c);
}

function completePlant(state, c, job) {
  const b = state.buildings.find(v => v.id === job.buildingId);
  if (!b) { clearJob(state, c); return; }
  b.crop = .06;
  addFloat(state, b.x, b.y - .5, 'Sown', '#a8b981');
  state.dirty = true;
  clearJob(state, c);
}

function completeCook(state, c, job) {
  if (state.resources.food < 2) { clearJob(state, c); return; }
  state.resources.food -= 2;
  const meals = 2 + (c.skills.cooking > 7 ? 2 : 1);
  addResource(state, 'meals', meals, true);
  state.stats.mealsCooked += meals;
  addFloat(state, c.x, c.y - .9, `+${meals} meals`, '#e9c987');
  spawnParticles(state, c.x, c.y - .4, 8, ['#d9a95b', '#f0d494', '#9a6d3c'], { speed: .7, life: .7, size: 1.3, gravity: -.1, lift: .2 });
  c.skills.cooking = Math.min(10, (c.skills.cooking || 1) + .07);
  state.dirty = true;
  clearJob(state, c);
}

function completeResearchWork(state, c, job) {
  const gain = 1.2 + (c.skills.research || 1) * .5 + Math.random() * .9;
  addResearch(state, gain);
  addFloat(state, c.x, c.y - .8, `+${Math.round(gain)}`, '#c79ae8');
  spawnParticles(state, c.x, c.y - .4, 5, ['#a27dc4', '#d0b7e8', '#7f8fb3'], { speed: .6, life: .8, size: 1.2, gravity: -.2, lift: .1 });
  c.skills.research = Math.min(10, (c.skills.research || 1) + .06);
  state.dirty = true;
  clearJob(state, c);
}

function completeCraft(state, c, job) {
  if (state.resources.wood < 4) { clearJob(state, c); return; }
  state.resources.wood -= 4;
  const silver = 4 + Math.floor((c.skills.crafting || 3) * .9);
  addResource(state, 'silver', silver, true);
  addFloat(state, c.x, c.y - .8, `+${silver} silver`, '#e9c987');
  c.skills.crafting = Math.min(10, (c.skills.crafting || 1) + .08);
  state.dirty = true;
  clearJob(state, c);
}

function completeDoctor(state, c, job) {
  const patient = state.colonists.find(v => v.id === job.patientId);
  if (!patient || patient.dead) { clearJob(state, c); return; }
  const heal = 14 + (c.skills.medicine || 2) * 3.1;
  patient.hp = Math.min(patient.maxHp, patient.hp + heal);
  patient.bleeding = Math.max(0, patient.bleeding - 1.4);
  if (patient.downed) { patient.downed = false; patient.hp = Math.max(8, patient.hp); patient.status = 'Recovering'; }
  addFloat(state, patient.x, patient.y - .9, `+${Math.round(heal)}`, '#9eb080');
  spawnParticles(state, patient.x, patient.y - .3, 6, ['#9eb080', '#e6d4ae'], { speed: .5, life: .7, size: 1.2, gravity: -.1 });
  c.skills.medicine = Math.min(10, (c.skills.medicine || 1) + .07);
  state.dirty = true;
  clearJob(state, c);
}

function updateEnemies(state, dt) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const target = nearestColonist(state, e.x, e.y);
    if (!target) { e.idle = true; continue; }
    const d = dist(e.x, e.y, target.x, target.y);
    e.facing = target.x < e.x ? -1 : 1;
    if (d > e.range * .9) {
      e.pathTimer -= dt;
      if (e.pathTimer <= 0) {
        e.pathTimer = .8 + Math.random() * .5;
        const spot = findAdjacentWalkable(state, Math.round(target.x), Math.round(target.y));
        if (spot) {
          const path = findPath(state, Math.round(e.x), Math.round(e.y), spot.x, spot.y, 1900);
          if (path) { e.path = path; e.pathIndex = 0; }
        }
      }
      if (e.path?.length) {
        const node = e.path[e.pathIndex];
        if (!node) { e.path = []; continue; }
        const dx = node.x - e.x, dy = node.y - e.y;
        const len = Math.hypot(dx, dy);
        const step = e.speed * dt;
        if (len <= step) { e.x = node.x; e.y = node.y; e.pathIndex++; }
        else { e.x += dx / len * step; e.y += dy / len * step; }
      } else {
        e.x += (target.x - e.x) / (d || 1) * e.speed * dt * .4;
        e.y += (target.y - e.y) / (d || 1) * e.speed * dt * .4;
      }
    } else if (e.cooldown <= 0) {
      e.cooldown = 1.25 + Math.random() * .5;
      let dmg = range(Math.random, e.damage[0], e.damage[1]);
      if (state.completedResearch.includes('wards')) dmg *= .8;
      target.hp -= dmg;
      target.bleeding = Math.min(4, target.bleeding + .7);
      target.mood = Math.max(0, target.mood - 2);
      addFloat(state, target.x, target.y - .9, `-${Math.round(dmg)}`, '#d27a64');
      spawnParticles(state, target.x, target.y - .3, 5, ['#8d3c31', '#b25343'], { speed: .8, life: .5, size: 1.4, gravity: 1 });
      if (target.hp <= 0) downColonist(state, target, `struck down by a ${e.name}`);
      else if (Math.random() < .15) logEvent(state, `<strong>${target.name}</strong> is wounded by a ${e.name}.`, '⚔', 'bad');
    }
  }
  state.enemies = state.enemies.filter(e => !e.dead || e.hitFlash > 0);
}

function updateProjectiles(state, dt) {
  for (const p of state.projectiles) {
    p.life -= dt;
    const target = state.enemies.find(e => e.id === p.targetId && !e.dead);
    if (target) { p.tx = target.x; p.ty = target.y - .15; }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step || d < .2) {
      if (target) hurtEnemy(state, target, p.damage, state.colonists.find(c => c.job?.type === 'fight' && c.job.targetId === target.id) || null);
      spawnParticles(state, p.tx, p.ty, 4, [p.color, '#e6d4ae'], { speed: .6, life: .4, size: 1.2 });
      p.life = 0;
    } else {
      p.x += dx / d * step;
      p.y += dy / d * step;
    }
  }
  state.projectiles = state.projectiles.filter(p => p.life > 0);
}

function updateFloats(state, dt) {
  // Floats are aged in updateVisuals; kept for symmetry.
}

export function getStatus(state) {
  const alive = state.colonists.filter(c => !c.dead).length;
  const threat = state.enemies.filter(e => !e.dead).length;
  return { alive, threat };
}

export function getProgress(state, building) {
  if (building.complete) return 1;
  const def = BUILDINGS[building.type];
  return clamp((building.progress || 0) / 100, 0, 1);
}

export function selectedEntity(state) {
  if (!state.selected) return null;
  if (state.selected.kind === 'colonist') return state.colonists.find(c => c.id === state.selected.id) || null;
  if (state.selected.kind === 'building') return state.buildings.find(b => b.id === state.selected.id) || null;
  if (state.selected.kind === 'enemy') return state.enemies.find(e => e.id === state.selected.id) || null;
  return null;
}
