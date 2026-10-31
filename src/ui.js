import {
  BUILDINGS, CLASSES, ENEMY_TYPES, EXPEDITIONS, RACES, RESEARCH, RESOURCE_META,
  SEASONS, SKILLS, TRAITS, WORK_TYPES,
} from './content.js';
import {
  canAfford, canPlace, dateLabel, getStatus, isUnlocked, phaseForHour, selectedEntity,
  timeLabel,
} from './sim.js';

const RES_ORDER = ['wood', 'stone', 'food', 'meals', 'herbs', 'crystal', 'silver'];

const GEAR = {
  ranger: [['➶', 'Yew longbow', 'Ashwood, gut string'], ['◈', 'Boiled leathers', 'Scarred but sound'], ['❦', 'Fox-tooth charm', 'Smells of pine']],
  guardian: [['⚒', 'Notched war-axe', 'Dwarven steel'], ['⛨', 'Chain hauberk', 'Heavy, honest iron'], ['◉', 'Clan torc', 'A name worth carrying']],
  sorcerer: [['✦', 'Ember focus', 'Warm to the touch'], ['◈', 'Ashen robes', 'Soot never quite leaves'], ['◉', 'Obsidian ring', 'It whispers at dusk']],
  druid: [['❧', 'Thorn staff', 'Still growing'], ['◈', 'Hide cloak', 'Wolf, boar, and moss'], ['❦', 'Acorn pouch', 'For a forest not yet born']],
  cleric: [['✚', 'Sun sigil', 'Polished brass'], ['⛨', 'Chain shirt', 'Under a plain tabard'], ['◉', 'Prayer beads', 'Forty-one, not forty']],
  bard: [['♪', 'Rosewood lute', 'One string replaced'], ['◈', 'Traveling coat', 'Patched at the elbow'], ['◉', 'Silver tongue', 'Only mostly metaphorical']],
  rogue: [['✧', 'Quick knife', 'No maker\u2019s mark'], ['◈', 'Grey hood', 'Remembers alleys'], ['◉', 'Loaded dice', 'Fortune favors the prepared']],
  wizard: [['◈', 'Bound grimoire', 'Smells of rain'], ['◈', 'Scholar\u2019s coat', 'Ink-stained cuffs'], ['◉', 'Chalk stub', 'For doors that should stay shut']],
};

function svgIcon(name) {
  const paths = {
    wood: '<path d="M3 14h11a3 3 0 0 0 3-3V8H6a3 3 0 0 0-3 3Z"/><path d="M6 16h9a3 3 0 0 0 3-3v-2"/><ellipse cx="7" cy="10.5" rx="2" ry="2.4"/><ellipse cx="12" cy="8.5" rx="1.6" ry="2.2"/>',
    stone: '<path d="m4 14 2-6 4-3 5 2 2 5-3 4H7Z"/><path d="m10 5 1 5 4 2"/><path d="m6 8 4 3-1 5"/>',
    food: '<path d="M12 18V8"/><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 11c3 0 4-2 4-5-3 0-4 2-4 5Z"/><path d="M8 18h8"/>',
    meal: '<path d="M4 11h16a8 8 0 0 1-8 7 8 8 0 0 1-8-7Z"/><path d="M7 8c0-1 1-2 2-3M12 7c0-1 1-2 2-3M9 18h6"/>',
    herb: '<path d="M12 20V9"/><path d="M12 12c-4 0-6-2-6-6 4 0 6 2 6 6Z"/><path d="M12 16c4 0 6-2 6-6-4 0-6 2-6 6Z"/>',
    crystal: '<path d="m12 3 5 5-1 9-4 4-4-4-1-9Z"/><path d="m12 3-1 14M7 8l5 3 5-3M11 17l1 4"/>',
    silver: '<ellipse cx="12" cy="7" rx="6" ry="3"/><path d="M6 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2"/><path d="M16 15c3 0 5 1.6 5 4"/>',
    shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9 12 2 2 4-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.stone}</svg>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pct(v) { return Math.max(0, Math.min(100, Math.round(v))); }
function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toString(); }

export function createUI(state, actions) {
  const $ = s => document.querySelector(s);
  const leftContent = $('#left-content');
  const rightContent = $('#right-content');
  const resourceBar = $('#resource-bar');
  const seenToasts = new Set();
  let lastLeft = '';
  let lastRight = '';
  let lastRes = '';
  let lastBanner = null;
  let bannerTimer = 0;
  let lastChrono = '';
  let scrollLeft = 0, scrollRight = 0;
  let lastTooltip = null;

  function renderResources() {
    const key = RES_ORDER.map(r => state.resources[r]).join(',');
    if (key === lastRes) return;
    lastRes = key;
    resourceBar.innerHTML = RES_ORDER.map(r => {
      const val = Math.floor(state.resources[r]);
      const warn = (r === 'food' || r === 'meals') && val < state.colonists.filter(c => !c.dead).length * 2;
      return `<div class="resource ${warn ? 'warn' : ''}" title="${RESOURCE_META[r].name} — ${val}${r === 'wood' || r === 'stone' ? ' / ' + state.resourceCap : ''}">
        ${svgIcon(RESOURCE_META[r].icon)}<div><span class="res-val">${fmt(val)}</span>${['wood', 'stone'].includes(r) ? `<span class="res-cap">/${state.resourceCap}</span>` : ''}</div>
      </div>`;
    }).join('');
  }

  function renderChrono() {
    $('#date-label').textContent = dateLabel(state.time);
    $('#year-label').textContent = `Year ${state.time.year}`;
    $('#time-label').textContent = timeLabel(state.time.hour);
    $('#time-phase').textContent = phaseForHour(state.time.hour);
    const weatherGlyph = state.time.weather.includes('rain') ? '☂' : state.time.weather.includes('sleet') ? '❄' : state.time.weather === 'Eclipse' ? '◒' : state.time.weather.includes('wind') ? '≋' : state.time.weather.includes('Mist') ? '░' : '☼';
    $('#weather-label').innerHTML = `<span class="weather-glyph">${weatherGlyph}</span><span>${esc(state.time.weather)}</span>`;
    $('#sun-dot').style.left = `${Math.max(1, Math.min(97, state.time.hour / 24 * 100))}%`;
    const st = getStatus(state);
    $('#colony-status').textContent = st.threat ? `Under threat — ${st.threat} hostile${st.threat > 1 ? 's' : ''}` : `${st.alive} souls · Day ${state.stats.daysSurvived} · ${state.time.weather}`;
  }

  function renderLeft(force = false) {
    const el = document.activeElement;
    if (el && (el.tagName === 'SELECT' || el.tagName === 'INPUT')) return;
    scrollLeft = leftContent.scrollTop;
    let html = '';
    if (state.uiTab === 'colony') html = leftColony();
    else if (state.uiTab === 'work') html = leftWork();
    else if (state.uiTab === 'build') html = leftBuild();
    else if (state.uiTab === 'research') html = leftResearch();
    else html = leftWorld();
    if (html === lastLeft && !force) return;
    lastLeft = html;
    leftContent.innerHTML = html;
    leftContent.scrollTop = scrollLeft;
  }

  function leftColony() {
    const alive = state.colonists.filter(c => !c.dead);
    const beds = state.buildings.filter(b => b.type === 'bed' && b.complete).length;
    const hasFire = state.buildings.some(b => b.type === 'campfire' && b.complete);
    const food = state.resources.meals + state.resources.food * .5;
    const days = Math.max(0, food / Math.max(1, alive.length));
    const moodOrbs = Array.from({ length: 10 }, (_, i) => `<i class="mood-orb ${state.mood > i * 9.5 ? 'on' : ''}"></i>`).join('');
    const roster = state.colonists.map(c => {
      if (c.dead) {
        return `<button class="colonist-card" data-action="select-colonist" data-id="${c.id}" style="opacity:.4">
          <div class="avatar" style="background:#2c2520">†<i class="status-pip bad"></i></div>
          <div><div class="c-name">${esc(c.name)}</div><div class="c-meta">Dead · ${esc(RACES[c.race].name)} ${esc(CLASSES[c.cls].name)}</div></div>
          <div class="c-job">Remembered</div></button>`;
      }
      const low = c.hunger < 30 || c.rest < 25;
      return `<button class="colonist-card ${state.selected?.kind === 'colonist' && state.selected.id === c.id ? 'selected' : ''}" data-action="select-colonist" data-id="${c.id}">
        <div class="avatar" style="background:linear-gradient(145deg,${CLASSES[c.cls].color},#1a1510)">${esc(c.first[0])}<i class="status-pip ${c.downed || c.bleeding > 0 ? 'bad' : c.mood < 32 ? 'warn' : ''}"></i></div>
        <div style="min-width:0">
          <div class="c-name">${esc(c.name)}</div>
          <div class="c-meta">${esc(RACES[c.race].name)} · ${esc(CLASSES[c.cls].name)} · ${c.onExpedition ? 'In the field' : esc(c.status || 'Idle')}</div>
          <div class="need-bars"><i class="${c.hunger < 30 ? 'low' : ''}"><b style="width:${pct(c.hunger)}%"></b></i><i class="${c.rest < 25 ? 'low' : ''}"><b style="width:${pct(c.rest)}%"></b></i><i class="${c.mood < 25 ? 'low' : ''}"><b style="width:${pct(c.mood)}%"></b></i></div>
        </div>
        <div class="c-job">${c.downed ? 'Downed' : esc(c.job?.type === 'fight' ? 'Defending' : c.job?.type === 'sleep' ? 'Sleeping' : c.job?.type === 'eat' ? 'Eating' : c.status || 'Idle')}</div>
      </button>`;
    }).join('');

    return `
      <div class="colony-banner">
        <h4>Ashenreach</h4>
        <p>Five exiles, one broken waystone, and a fire that refuses to go out. The Marches are watching.</p>
        <div class="mood-row">
          <div class="mood-orbs">${moodOrbs}</div>
          <span class="mood-score">${Math.round(state.mood)}</span>
          <span class="mood-caption">Colony spirit</span>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${alive.length}</div><div class="k">Souls</div></div>
        <div class="stat-card"><div class="v">${days.toFixed(1)}</div><div class="k">Days food</div></div>
        <div class="stat-card"><div class="v">${beds}</div><div class="k">Beds</div></div>
        <div class="stat-card"><div class="v">${state.stats.built}</div><div class="k">Raised</div></div>
        <div class="stat-card"><div class="v">${state.stats.kills}</div><div class="k">Slain</div></div>
        <div class="stat-card"><div class="v">${state.completedResearch.length}</div><div class="k">Discoveries</div></div>
      </div>
      <div class="section-head"><h3>The Company</h3><span class="rule"></span><span class="count">${alive.length}</span></div>
      <div class="colonist-list">${roster}</div>
      <div class="section-head" style="margin-top:16px"><h3>Chronicle</h3><span class="rule"></span></div>
      <div class="log-list">${state.log.slice(0, 7).map(e => `<div class="log-entry ${e.kind}"><span class="lt">${esc(e.t)}</span><span class="ld">${e.icon || '·'}</span><span>${e.text}</span></div>`).join('')}</div>
      <div style="height:8px"></div>
      <div class="section-sub" style="text-align:center;opacity:.65">${hasFire ? 'The fire is tended.' : '<span style="color:#c77d6b">No fire. Build a campfire.</span>'} · ${alive.length} alive · ${state.time.weather}</div>
    `;
  }

  function leftWork() {
    const alive = state.colonists.filter(c => !c.dead);
    const head = alive.map(c => `<th title="${esc(c.name)}">${esc(c.first.slice(0, 5))}</th>`).join('');
    const rows = WORK_TYPES.map(w => {
      const cells = alive.map(c => {
        const v = c.priorities[w.id] ?? 4;
        return `<td><button class="prio p${v}" data-action="priority" data-cid="${c.id}" data-work="${w.id}" data-val="${v}" title="${esc(c.first)} — ${w.name}: ${{ 1: 'High', 2: 'Normal', 3: 'Low', 4: 'Never' }[v]}">${v < 4 ? v : '—'}</button></td>`;
      }).join('');
      return `<tr><td title="${w.name}">${w.name}</td>${cells}</tr>`;
    }).join('');
    return `
      <div class="section-head"><h3>Work Priorities</h3><span class="rule"></span></div>
      <p class="section-sub">Click a cell to cycle a colonist’s priority. <b style="color:#e9c987">1</b> is urgent, <b style="color:#7c705b">3</b> is idle work, <b>—</b> forbids it. Idle colonists choose the most pressing task they are suited for.</p>
      <div class="work-scroll"><table class="work-table"><thead><tr><th>Task</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="work-legend"><span><b>1</b> Urgent</span><span><b>2</b> Normal</span><span><b>3</b> Idle</span><span><b>—</b> Never</span></div>
      <div class="section-head" style="margin-top:16px"><h3>Skills</h3><span class="rule"></span></div>
      <div class="section-sub">Work speed and quality improve with practice. Combat and survival improve under pressure.</div>
      <div class="skill-grid" style="grid-template-columns:1fr 1fr">
        ${alive.map(c => `<div style="border:1px solid var(--line-soft);padding:6px;font-size:8px">
          <div style="font-family:var(--serif);font-size:10px;color:var(--parch);margin-bottom:4px">${esc(c.first)}</div>
          ${SKILLS.slice(0, 6).map(s => `<div class="skill-row"><span>${s.name}</span><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(c.skills[s.id]) ? 'on' : ''}"></i>`).join('')}</div><b>${Math.round(c.skills[s.id])}</b></div>`).join('')}
        </div>`).join('')}
      </div>
    `;
  }

  function leftBuild() {
    const cats = ['All', 'Shelter', 'Production', 'Defense', 'Faith'];
    const cat = state.buildCategory || 'All';
    const items = Object.entries(BUILDINGS).filter(([, d]) => cat === 'All' || d.cat === cat);
    const cards = items.map(([id, d]) => {
      const locked = !isUnlocked(state, id);
      const afford = canAfford(state, d.cost);
      const active = state.buildMode?.type === id;
      const cost = Object.entries(d.cost).map(([r, n]) => `<span class="${state.resources[r] < n ? 'lack' : ''}">${n} ${RESOURCE_META[r].name.slice(0, 4)}</span>`).join('');
      return `<button class="build-card ${locked ? 'locked' : ''} ${active ? 'active' : ''}" ${locked ? 'disabled' : ''} data-action="build" data-type="${id}" title="${esc(d.desc)}">
        ${d.requires ? `<span class="b-key">${esc(RESEARCH[d.requires].name.split(' ')[0])}</span>` : ''}
        <span class="b-icon">${d.icon}</span>
        <div class="b-name">${esc(d.name)}</div>
        <div class="b-cost">${locked ? `<span style="color:#8d7c61">Requires ${esc(RESEARCH[d.requires].name)}</span>` : cost}</div>
        ${!locked && !afford ? '<div class="b-lock">Materials lacking</div>' : ''}
      </button>`;
    }).join('');
    return `
      <div class="section-head"><h3>Build</h3><span class="rule"></span><span class="count">${Object.keys(BUILDINGS).length}</span></div>
      <p class="section-sub">Choose a structure, then click the map to place its blueprint. Colonists with <b>Construct</b> priority will raise it. Right-click or <b>Esc</b> cancels.</p>
      <div class="build-toolbar">${cats.map(c => `<button class="chip-btn ${c === cat ? 'active' : ''}" data-action="build-category" data-cat="${c}">${c}</button>`).join('')}</div>
      <div class="build-grid">${cards}</div>
      <div class="section-head" style="margin-top:16px"><h3>The Ground</h3><span class="rule"></span></div>
      <p class="section-sub">Mark trees, stone, and bushes for gathering by clicking them on the map and choosing <b>Mark for harvest</b>. Farms ripen on their own.</p>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${state.features.filter(f => f.marked).length}</div><div class="k">Marked</div></div>
        <div class="stat-card"><div class="v">${state.buildings.filter(b => !b.complete).length}</div><div class="k">Blueprints</div></div>
        <div class="stat-card"><div class="v">${state.features.filter(f => f.type === 'crystal').length}</div><div class="k">Crystal</div></div>
      </div>
      <button class="panel-btn full" data-action="stop-build" style="margin-top:6px">Cancel placement</button>
    `;
  }

  function leftResearch() {
    const r = RESEARCH[state.researchActive];
    const progress = r ? Math.min(100, state.researchPoints / r.cost * 100) : 100;
    const cards = Object.entries(RESEARCH).map(([id, d]) => {
      const done = state.completedResearch.includes(id);
      const locked = d.requires && !state.completedResearch.includes(d.requires);
      const active = state.researchActive === id;
      return `<button class="research-card ${done ? 'done' : ''} ${!done && active ? 'active' : ''} ${locked ? 'locked' : ''}" ${locked ? 'disabled' : ''} data-action="research" data-id="${id}">
        ${done ? '<span class="done-mark">✦</span>' : ''}
        <h4><span class="r-icon">${d.icon}</span>${esc(d.name)}</h4>
        <p>${esc(d.desc)}</p>
        <div class="r-meta"><span>${locked ? 'Locked · ' + esc(RESEARCH[d.requires].name) : done ? 'Understood' : active ? 'Studying' : d.cost + ' insight'}</span><span>${done ? '✓' : d.requires ? d.requires : 'Foundation'}</span></div>
        ${active && !done ? `<div class="r-prog"><i style="width:${progress}%"></i></div>` : ''}
      </button>`;
    }).join('');
    return `
      <div class="section-head"><h3>Arcana &amp; Craft</h3><span class="rule"></span><span class="count">${state.completedResearch.length}/${Object.keys(RESEARCH).length}</span></div>
      <div class="research-points"><b>${Math.floor(state.researchPoints)}</b><span>accumulated insight</span></div>
      <p class="section-sub">Colonists with <b>Research</b> priority study at a Rune Desk. Deeper truths unlock new structures — and attract older things.</p>
      ${state.researchActive ? `<div class="quest-card" style="border-left-color:var(--gold)"><h4>${esc(RESEARCH[state.researchActive].name)}</h4><p>${esc(RESEARCH[state.researchActive].desc)}</p><div class="r-prog" style="margin-top:8px"><i style="width:${progress}%"></i></div><div class="q-obj"><span>Progress</span><b>${Math.floor(state.researchPoints)} / ${RESEARCH[state.researchActive].cost}</b></div></div>` : '<div class="quest-card"><h4>No active study</h4><p>Choose a project below. Insight accumulates even while another project is selected.</p></div>'}
      <div class="section-head" style="margin-top:14px"><h3>Projects</h3><span class="rule"></span></div>
      ${cards}
    `;
  }

  function leftWorld() {
    const exp = state.expedition;
    const expHtml = exp ? `<div class="quest-card" style="border-left-color:var(--blue)">
      <h4>In the field — ${esc(exp.name)}</h4>
      <p>The party is ${Math.round(exp.progress / exp.total * 100)}% through the journey. Supplies are committed.</p>
      <div class="r-prog" style="margin-top:8px"><i style="width:${exp.progress / exp.total * 100}%;background:var(--blue)"></i></div>
      <div class="q-obj"><span>Risk ${exp.risk}</span><b>Day ${state.time.day}</b></div></div>` : '';
    const expActions = EXPEDITIONS.map(e => {
      const locked = e.requires === 'barrow' && !state.quests.find(q => q.id === 'barrow' && q.status === 'active');
      return `<button class="world-action" ${locked ? 'disabled style="opacity:.42;cursor:not-allowed"' : ''} data-action="expedition" data-id="${e.id}">
        <div><div class="wa-name">${esc(e.name)}</div><div class="wa-sub">${locked ? 'Landmark not yet discovered' : esc(e.desc)}</div></div>
        <div class="wa-cost">${locked ? '???' : Object.entries(e.cost).map(([r, n]) => `${n} ${RESOURCE_META[r].name.slice(0, 4)}`).join('<br>')}</div>
      </button>`;
    }).join('');
    return `
      <div class="section-head"><h3>The Marches</h3><span class="rule"></span><span class="count">Open world</span></div>
      <p class="section-sub">Beyond the fire, landmarks wait. Expeditions cost supplies and time; the Marches rarely give something for nothing.</p>
      ${expHtml}
      <div class="section-head"><h3>Quests</h3><span class="rule"></span></div>
      <div class="quests">${state.quests.map(q => `<div class="quest-card ${q.status === 'complete' ? 'done' : ''}">
        <h4>${esc(q.title)}</h4><p>${esc(q.desc)}</p>
        <div class="q-obj"><span>${esc(q.objective)}</span><b>${q.progress} / ${q.total}${q.status === 'complete' ? ' · Done' : ''}</b></div>
        ${q.status === 'active' ? `<div class="r-prog" style="margin-top:5px"><i style="width:${q.progress / q.total * 100}%"></i></div>` : ''}
      </div>`).join('')}</div>
      <div class="section-head" style="margin-top:14px"><h3>Expeditions</h3><span class="rule"></span></div>
      <div class="world-actions">${expActions}</div>
      <button class="panel-btn full" style="margin-top:10px" data-action="open-overview">Open the Sundered Marches map</button>
      <div class="section-head" style="margin-top:16px"><h3>Field Notes</h3><span class="rule"></span></div>
      <div class="log-list">${state.log.slice(0, 6).map(e => `<div class="log-entry ${e.kind}"><span class="lt">${esc(e.t)}</span><span class="ld">${e.icon || '·'}</span><span>${e.text}</span></div>`).join('')}</div>
    `;
  }

  function renderRight() {
    scrollRight = rightContent.scrollTop;
    const entity = selectedEntity(state);
    let html = '';
    if (state.selected?.kind === 'feature') {
      const f = state.features.find(v => v.id === state.selected.id);
      if (f) html = inspectorFeature(f);
    } else if (state.selected?.kind === 'colonist' && entity) {
      html = inspectorColonist(entity);
    } else if (state.selected?.kind === 'building' && entity) {
      html = inspectorBuilding(entity);
    } else if (state.selected?.kind === 'enemy' && entity) {
      html = inspectorEnemy(entity);
    } else {
      html = inspectorOverview();
    }
    if (html === lastRight) return;
    lastRight = html;
    rightContent.innerHTML = html;
    rightContent.scrollTop = scrollRight;
  }

  function inspectorColonist(c) {
    const cls = CLASSES[c.cls], race = RACES[c.race];
    if (c.dead) {
      return `<div class="inspector-head"><div class="avatar" style="background:#2c2520">†</div><div><h3>${esc(c.name)}</h3><div class="sub" style="color:#a46a5e">Fallen</div></div></div>
      <p class="section-sub">A place at the fire remains empty. Their name is carved into the waystone.</p>`;
    }
    const traitHtml = c.traits.map(t => `<span class="tag ${TRAITS[t]?.good ? 'good' : 'bad'}" title="${esc(TRAITS[t]?.desc || '')}">${esc(TRAITS[t]?.name || t)}</span>`).join('');
    return `
      <div class="inspector-head">
        <div class="avatar" style="background:linear-gradient(145deg,${cls.color},#1a1510);font-size:22px">${esc(c.first[0])}</div>
        <div><h3>${esc(c.name)}</h3><div class="sub">${race.name} · ${cls.name} · Lv.${c.level}</div>
        <div class="inspector-tags">${c.onExpedition ? '<span class="tag">In the field</span>' : ''}${c.downed ? '<span class="tag bad">Downed</span>' : ''}${traitHtml}</div></div>
      </div>
      <div class="vitals">
        <div class="vital-row"><span class="vk">Health</span><div class="vbar ${c.hp < c.maxHp * .35 ? 'low' : ''}"><i style="width:${pct(c.hp / c.maxHp * 100)}%"></i></div><span class="vv">${Math.round(c.hp)}</span></div>
        <div class="vital-row"><span class="vk">Hunger</span><div class="vbar hunger ${c.hunger < 30 ? 'low' : ''}"><i style="width:${pct(c.hunger)}%"></i></div><span class="vv">${Math.round(c.hunger)}</span></div>
        <div class="vital-row"><span class="vk">Rest</span><div class="vbar rest ${c.rest < 25 ? 'low' : ''}"><i style="width:${pct(c.rest)}%"></i></div><span class="vv">${Math.round(c.rest)}</span></div>
        <div class="vital-row"><span class="vk">Spirit</span><div class="vbar mood ${c.mood < 30 ? 'low' : ''}"><i style="width:${pct(c.mood)}%"></i></div><span class="vv">${Math.round(c.mood)}</span></div>
      </div>
      <div class="trait-line"><b>${esc(c.status || 'Idle')}.</b> ${esc(c.thought)}</div>
      <div class="micro-label">Skills</div>
      <div class="skill-grid">
        ${SKILLS.map(s => `<div class="skill-row" title="${s.name} ${c.skills[s.id].toFixed(1)}"><span>${s.name}</span><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round(c.skills[s.id]) ? 'on' : ''}"></i>`).join('')}</div><b>${Math.round(c.skills[s.id])}</b></div>`).join('')}
      </div>
      <div class="micro-label">Current Labour</div>
      <div class="trait-line" style="margin-bottom:10px">${c.job ? `${esc(c.job.label || jobLabel(c.job))}${c.job.phase === 'working' && c.job.duration ? ` · ${Math.round(Math.min(1, c.job.progress / c.job.duration) * 100)}%` : ''}` : c.onExpedition ? 'Traveling the Marches' : 'Awaiting orders'}</div>
      <div class="micro-label">Gear</div>
      <div class="gear-list">${(GEAR[c.cls] || GEAR.ranger).map(g => `<div class="gear-row"><span class="gear-icon">${g[0]}</span><span><b>${esc(g[1])}</b><small>${esc(g[2])}</small></span></div>`).join('')}</div>
      <div class="micro-label" style="margin-top:10px">Mood &amp; Grounds</div>
      <div class="mood-ledger">
        <span>${c.hunger > 60 ? 'Well fed' : c.hunger > 30 ? 'Peckish' : 'Starving'}<b>${c.hunger > 60 ? '+' : '−'}${Math.abs(Math.round((c.hunger - 55) * .13))}</b></span>
        <span>${c.rest > 60 ? 'Rested' : c.rest > 30 ? 'Tired' : 'Exhausted'}<b>${c.rest > 60 ? '+' : '−'}${Math.abs(Math.round((c.rest - 55) * .09))}</b></span>
        <span>${c.mood > 65 ? 'In good spirits' : c.mood > 35 ? 'Uneasy' : 'Despairing'}<b>${c.mood > 65 ? '+' : '−'}${Math.abs(Math.round((c.mood - 55) * .07))}</b></span>
      </div>
      <div class="micro-label" style="margin-top:10px">Bonds &amp; Burdens</div>
      <div class="trait-line" style="padding-top:2px;padding-bottom:2px">${c.traits.map(t => `<div style="margin:3px 0"><b>${esc(TRAITS[t]?.name || t)}</b> — ${esc(TRAITS[t]?.desc || '')}</div>`).join('')}</div>
      <div class="building-actions">
        <button class="panel-btn" data-action="focus-colonist" data-id="${c.id}">Locate</button>
        <button class="panel-btn" data-action="toggle-priority" data-cid="${c.id}" data-work="guard">${(c.priorities.guard < 4) ? 'Hold Fire' : 'Take Up Arms'}</button>
        <button class="panel-btn" data-action="rest-colonist" data-id="${c.id}">Rest</button>
      </div>
      <button class="panel-btn full" style="margin-top:5px" data-action="open-char" data-id="${c.id}">View character sheet</button>
      <div style="height:6px"></div>
    `;
  }

  function jobLabel(job) {
    return job.type === 'fight' ? 'Defending' : job.type === 'sleep' ? 'Sleeping' : job.type === 'eat' ? 'Eating' : job.label || job.type;
  }

  function inspectorBuilding(b) {
    const d = BUILDINGS[b.type];
    const complete = b.complete;
    const crop = b.crop ?? null;
    const tags = (d.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `
      <div class="inspector-head">
        <div class="avatar" style="background:linear-gradient(145deg,#4a3b27,#1a1510);font-size:22px">${d.icon}</div>
        <div><h3>${esc(d.name)}</h3><div class="sub" style="color:${complete ? 'var(--gold)' : '#a9895a'}">${complete ? 'Completed' : 'Blueprint'}</div>
        <div class="inspector-tags">${tags}</div></div>
      </div>
      <p class="section-sub" style="margin-top:0">${esc(d.desc)}</p>
      ${!complete ? `<div class="trait-line"><b>Construction ${Math.round(b.progress || 0)}%</b><div class="r-prog" style="margin-top:5px"><i style="width:${b.progress || 0}%"></i></div></div>` : ''}
      ${complete && b.type === 'farm' ? `<div class="vital-row"><span class="vk">Crop</span><div class="vbar"><i style="width:${(crop || 0) * 100}%"></i></div><span class="vv">${Math.round((crop || 0) * 100)}%</span></div>` : ''}
      <div class="colony-meters">
        <div class="colony-meter"><span>Footprint</span><div class="cm-bar"><i style="width:${Math.min(100, b.w * b.h / 4 * 100)}%"></i></div><b>${b.w}×${b.h}</b></div>
        <div class="colony-meter"><span>Materials</span><div class="cm-bar"><i style="width:${Math.min(100, Object.values(d.cost).reduce((a, b) => a + b, 0) / 25 * 100)}%"></i></div><b>${Object.values(d.cost).reduce((a, n) => a + n, 0)}</b></div>
      </div>
      <div class="micro-label">Construction Cost</div>
      <div class="trait-line">${Object.entries(d.cost).map(([r, n]) => `${n} ${RESOURCE_META[r].name}`).join(' · ')}</div>
      <div class="building-actions">
        ${!complete ? `<button class="panel-btn danger" data-action="cancel-building" data-id="${b.id}">Cancel blueprint</button>` : `<button class="panel-btn" data-action="focus-building" data-id="${b.id}">Locate</button><button class="panel-btn" data-action="toggle-building" data-id="${b.id}">${b.active ? 'Switch off' : 'Switch on'}</button><button class="panel-btn danger" data-action="deconstruct" data-id="${b.id}">Deconstruct</button>`}
      </div>
      <div style="height:6px"></div>
    `;
  }

  function inspectorEnemy(e) {
    const info = ENEMY_TYPES[e.type];
    return `
      <div class="inspector-head">
        <div class="avatar" style="background:linear-gradient(145deg,#792f25,#1a1010);font-size:20px">☠</div>
        <div><h3>${esc(e.name)}</h3><div class="sub" style="color:#c77d6b">Hostile · CR ${Math.max(1, Math.round(e.maxHp / 20))}</div>
        <div class="inspector-tags"><span class="tag bad">Threat</span><span class="tag">${e.shape}</span></div></div>
      </div>
      <div class="vitals">
        <div class="vital-row"><span class="vk">Health</span><div class="vbar"><i style="width:${pct(e.hp / e.maxHp * 100)}%;background:linear-gradient(90deg,#6e2a22,#b35243)"></i></div><span class="vv">${Math.round(e.hp)}</span></div>
      </div>
      <p class="section-sub">A creature of the wild Marches. It will kill your people if it can. Ranged colonists engage at distance; guardians hold the line.</p>
      <div class="micro-label">Drops</div>
      <div class="trait-line">${Object.entries(info.loot).map(([r, n]) => `${n} ${RESOURCE_META[r].name}`).join(' · ')}</div>
      <button class="panel-btn full" data-action="focus-enemy" data-id="${e.id}">Track creature</button>
    `;
  }

  function inspectorFeature(f) {
    const names = { tree: 'Old Timber', rock: 'Stone Outcrop', bush: 'Berry Bush', crystal: 'Vein of Crystal', ruinStone: 'Fallen Masonry', grave: 'Grave', waystone: 'Broken Waystone' };
    const icons = { tree: '♣', rock: '▲', bush: '❦', crystal: '◈', ruinStone: '▥', grave: '†', waystone: '✦' };
    return `
      <div class="inspector-head">
        <div class="avatar" style="background:linear-gradient(145deg,#445236,#1a1510);font-size:22px">${icons[f.type] || '·'}</div>
        <div><h3>${esc(names[f.type] || f.type)}</h3><div class="sub">${f.marked ? 'Marked for harvest' : 'Wild resource'}</div></div>
      </div>
      <div class="colony-meters">
        <div class="colony-meter"><span>Remaining</span><div class="cm-bar"><i style="width:${f.amount / f.max * 100}%"></i></div><b>${Math.floor(f.amount)}</b></div>
      </div>
      <p class="section-sub">Marked resources are gathered by colonists with the matching work priority. Trees yield wood; outcrops yield stone; bushes yield food.</p>
      <button class="panel-btn full" data-action="mark-feature" data-id="${f.id}">${f.marked ? 'Unmark resource' : 'Mark for harvest'}</button>
      ${f.type === 'waystone' ? '<p class="section-sub" style="margin-top:10px">It hums when the sun goes down. The Sunken Shrine calls from the east.</p>' : ''}
    `;
  }

  function inspectorOverview() {
    const alive = state.colonists.filter(c => !c.dead);
    const beds = state.buildings.filter(b => b.type === 'bed' && b.complete).length;
    const farms = state.buildings.filter(b => b.type === 'farm' && b.complete).length;
    const armed = alive.filter(c => (c.priorities.guard || 4) < 4).length;
    const threat = state.enemies.filter(e => !e.dead).length;
    return `
      <div class="empty-inspector">
        <div class="glyph">◈</div>
        <h3>Ashenreach</h3>
        <p>Select a colonist, structure, or creature to inspect it. Click the ground to clear your selection.</p>
      </div>
      <div class="section-head"><h3>Colony Ledger</h3><span class="rule"></span></div>
      <div class="colony-meters">
        <div class="colony-meter"><span>Spirit</span><div class="cm-bar"><i style="width:${state.mood}%;background:${state.mood > 50 ? 'var(--moss)' : '#a46a5e'}"></i></div><b>${Math.round(state.mood)}</b></div>
        <div class="colony-meter"><span>Shelter</span><div class="cm-bar"><i style="width:${Math.min(100, beds / Math.max(1, alive.length) * 100)}%"></i></div><b>${beds}/${alive.length}</b></div>
        <div class="colony-meter"><span>Defense</span><div class="cm-bar"><i style="width:${Math.min(100, armed / Math.max(1, alive.length) * 100)}%;background:#a46a5e"></i></div><b>${armed}</b></div>
        <div class="colony-meter"><span>Farms</span><div class="cm-bar"><i style="width:${Math.min(100, farms / 8 * 100)}%;background:#96a36a"></i></div><b>${farms}</b></div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="v">${alive.length}</div><div class="k">Souls</div></div>
        <div class="stat-card"><div class="v">${threat}</div><div class="k">Threats</div></div>
        <div class="stat-card"><div class="v">${state.stats.daysSurvived}</div><div class="k">Days</div></div>
      </div>
      ${threat ? `<div class="quest-card" style="border-left-color:var(--blood)"><h4 style="color:#d39080">The camp is under attack</h4><p>${threat} hostile${threat > 1 ? 's are' : ' is'} inside the Marches. Colonists with Guard priority will engage. Select the wounded to check them.</p></div>` : ''}
      <div class="section-head" style="margin-top:14px"><h3>Ongoing</h3><span class="rule"></span></div>
      ${state.quests.filter(q => q.status === 'active').slice(0, 2).map(q => `<div class="quest-card"><h4>${esc(q.title)}</h4><p>${esc(q.desc)}</p><div class="q-obj"><span>${esc(q.objective)}</span><b>${q.progress} / ${q.total}</b></div></div>`).join('') || '<p class="section-sub">No active quests. The Marches are quiet. That is rarely good.</p>'}
      <div class="section-head" style="margin-top:12px"><h3>Time &amp; Weather</h3><span class="rule"></span></div>
      <div class="trait-line">${dateLabel(state.time)}, ${timeLabel(state.time.hour)}. ${phaseForHour(state.time.hour)}. ${esc(state.time.weather)}. ${esc(SEASONS[state.time.season].name)} is on the land.</div>
      <button class="panel-btn full" data-action="open-help" style="margin-top:4px">How to play</button>
      <div style="height:8px"></div>
    `;
  }

  function renderToasts() {
    const stack = $('#toast-stack');
    for (const n of state.notifications) {
      if (seenToasts.has(n.id)) continue;
      seenToasts.add(n.id);
      const el = document.createElement('div');
      el.className = 'toast ' + (n.kind || '');
      el.innerHTML = n.text;
      stack.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 4600);
      while (stack.children.length > 4) stack.firstChild.remove();
    }
    for (const id of seenToasts) if (!state.notifications.some(n => n.id === id)) seenToasts.delete(id);
  }

  function renderBanner() {
    const el = $('#event-banner');
    if (state.banner) {
      const key = state.banner.title + state.banner.text;
      if (lastBanner !== key) {
        lastBanner = key;
        el.innerHTML = `<div class="eb-kicker">${esc(state.banner.kicker)}</div><h3>${esc(state.banner.title)}</h3><p>${esc(state.banner.text)}</p>`;
        el.classList.remove('hidden');
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => el.classList.add('hidden'), Math.max(1600, state.banner.ttl * 1000));
      }
    } else if (lastBanner !== null) {
      lastBanner = null;
      el.classList.add('hidden');
    }
  }

  function renderBottom() {
    const st = getStatus(state);
    const armed = state.colonists.filter(c => !c.dead && (c.priorities.guard || 4) < 4).length;
    $('#bottom-stats').innerHTML = `<span>Colonists <b>${st.alive}</b></span><span>Defenders <b>${armed}</b></span><span>Hostiles <b style="color:${st.threat ? '#d39080' : 'var(--parch)'}">${st.threat}</b></span><span>Speed <b>${state.speed === 0 ? 'Paused' : state.speed + '×'}</b></span>`;
    const recent = state.log[0];
    if (recent) $('#alert-text').innerHTML = recent.text.replace(/<\/?[^>]+>/g, '');
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === state.speed));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.uiTab));
  }

  function syncMobileInspector() {
    if (window.innerWidth <= 860) {
      document.getElementById('right-panel').classList.toggle('mobile-open', Boolean(state.selected && state.mobileInspector));
    } else {
      document.getElementById('right-panel').classList.remove('mobile-open');
    }
  }

  function renderAll() {
    renderResources();
    renderChrono();
    renderLeft();
    renderRight();
    renderBottom();
  }

  function tick() {
    renderChrono();
    renderResources();
    renderBottom();
    renderBanner();
    renderToasts();
    if (state.dirty) {
      renderLeft();
      renderRight();
      syncMobileInspector();
      state.dirty = false;
    }
  }

  function showModal(html) {
    $('#modal-content').innerHTML = html;
    $('#modal-layer').classList.remove('hidden');
  }

  function closeModal() {
    $('#modal-layer').classList.add('hidden');
  }

  function helpModal() {
    showModal(`
      <div class="m-kicker">Field Manual · Ashenreach</div>
      <h2>How to Keep the Fire</h2>
      <p>Ashenreach is a colony chronicle. You do not control every step — you set priorities, mark work, raise walls, and hope. Time passes when you let it.</p>
      <div class="rules">
        <div class="rule"><b>1. The map</b>Drag with the right mouse to pan; scroll to zoom. Click colonists, creatures, or structures to inspect them.</div>
        <div class="rule"><b>2. Work</b>Open Work and set each colonist’s priorities. Idle colonists choose tasks by priority, distance, and skill.</div>
        <div class="rule"><b>3. Build</b>Choose a structure in Build, then click the map. Blueprints need materials and a free colonist.</div>
        <div class="rule"><b>4. Gather</b>Click a tree, outcrop, or bush and mark it. Colonists with Chop/Mine/Harvest priorities bring resources home.</div>
        <div class="rule"><b>5. Needs</b>Hunger, rest, and spirit matter. Meals are better than raw food. Beds, fire, wells, and shrines lift morale.</div>
        <div class="rule"><b>6. Danger</b>Raiders spawn at the edges. Defenders fight automatically; wounded colonists need a doctor or a bed.</div>
        <div class="rule"><b>7. Explore</b>Use the World tab to send parties to landmarks. Expeditions cost supplies and time, and return with stories.</div>
        <div class="rule"><b>8. Arcana</b>Research unlocks new structures. Build a Rune Desk and assign a scholar.</div>
      </div>
      <div class="m-actions"><button data-action="close-modal">Return to the Marches</button><button data-action="restart">New chronicle</button></div>
    `);
  }

  function menuModal() {
    showModal(`
      <div class="m-kicker">Chronicle Menu</div>
      <h2>Ashenreach</h2>
      <p>A small fire against a very large dark. Your story is being written in the Chronicle.</p>
      <ul class="m-list">
        <li><span>Colonists</span><b>${state.colonists.filter(c => !c.dead).length}</b></li>
        <li><span>Day / season</span><b>${state.stats.daysSurvived} · ${SEASONS[state.time.season].name}</b></li>
        <li><span>Structures raised</span><b>${state.stats.built}</b></li>
        <li><span>Creatures slain</span><b>${state.stats.kills}</b></li>
        <li><span>Insight discovered</span><b>${state.completedResearch.length} projects</b></li>
        <li><span>World seed</span><b>${state.seed}</b></li>
      </ul>
      <div class="m-actions"><button data-action="close-modal">Continue</button><button data-action="open-help">Field manual</button><button data-action="restart">New chronicle</button></div>
    `);
  }

  function charModal(c) {
    if (!c) return;
    showModal(`
      <div class="m-kicker">${esc(RACES[c.race].name)} · ${esc(CLASSES[c.cls].name)}</div>
      <h2>${esc(c.name)}</h2>
      <p>${esc(c.thought)}</p>
      <div class="m-list">
        ${SKILLS.map(s => `<li><span>${s.name}</span><b>${c.skills[s.id].toFixed(1)} / 10</b></li>`).join('')}
        <li><span>Traits</span><b>${c.traits.map(t => TRAITS[t]?.name || t).join(', ')}</b></li>
        <li><span>Health</span><b>${Math.round(c.hp)} / ${c.maxHp}</b></li>
        <li><span>Mood</span><b>${Math.round(c.mood)}</b></li>
      </div>
      <div class="m-actions"><button data-action="close-modal">Close</button></div>
    `);
  }

  function bind() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'tab') { state.uiTab = btn.dataset.tab; state.dirty = true; lastLeft = ''; renderLeft(true); renderBottom(); }
      else if (action === 'select-colonist') actions.select('colonist', id);
      else if (action === 'build') actions.build(btn.dataset.type);
      else if (action === 'build-category') { state.buildCategory = btn.dataset.cat; state.dirty = true; lastLeft = ''; renderLeft(true); }
      else if (action === 'priority') {
        const v = Number(btn.dataset.val);
        actions.priority(btn.dataset.cid, btn.dataset.work, v >= 4 ? 1 : v + 1);
      }
      else if (action === 'research') actions.research(id);
      else if (action === 'expedition') actions.expedition(id);
      else if (action === 'stop-build') actions.stopBuild();
      else if (action === 'mark-feature') actions.markFeature(id);
      else if (action === 'cancel-building') actions.cancelBuilding(id);
      else if (action === 'deconstruct') actions.deconstruct(id);
      else if (action === 'toggle-building') actions.toggleBuilding(id);
      else if (action === 'focus-colonist') actions.focus('colonist', id);
      else if (action === 'focus-building') actions.focus('building', id);
      else if (action === 'focus-enemy') actions.focus('enemy', id);
      else if (action === 'rest-colonist') actions.rest(id);
      else if (action === 'toggle-priority') actions.togglePriority(btn.dataset.cid, btn.dataset.work);
      else if (action === 'open-help') helpModal();
      else if (action === 'open-char') charModal(state.colonists.find(c => c.id === id));
      else if (action === 'open-overview') actions.openOverview();
      else if (action === 'close-modal') closeModal();
      else if (action === 'restart') actions.restart();
      else if (action === 'speed') actions.speed(Number(btn.dataset.speed));
    });
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      state.uiTab = t.dataset.tab; state.dirty = true; lastLeft = ''; renderLeft(true); renderBottom();
    }));
    document.querySelectorAll('.speed-btn').forEach(b => b.addEventListener('click', () => actions.speed(Number(b.dataset.speed))));
    $('#modal-close').addEventListener('click', closeModal);
    document.getElementById('right-close').addEventListener('click', () => { state.selected = null; state.mobileInspector = false; state.dirty = true; document.getElementById('right-panel').classList.remove('mobile-open'); });
    $('#modal-layer').addEventListener('click', e => { if (e.target.id === 'modal-layer') closeModal(); });
    $('#btn-help').addEventListener('click', helpModal);
    $('#btn-menu').addEventListener('click', menuModal);
    $('#btn-minimap').addEventListener('click', () => actions.openOverview());
    $('#overview-close').addEventListener('click', () => actions.closeOverview());
  }

  return { bind, tick, renderAll, renderLeft, renderRight, showModal, closeModal, helpModal, menuModal, charModal, forceLeft: () => renderLeft(true), forceRight: () => renderRight() };
}

export function renderStartDetails() {}
