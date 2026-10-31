export const TERRAIN = {
  GRASS: 0, FOREST: 1, DIRT: 2, WATER: 3, MOUNTAIN: 4, SAND: 5, RUIN: 6, FARM: 7,
};

export const TERRAIN_INFO = {
  0: { name: 'Meadow', walk: true, color: '#53613e' },
  1: { name: 'Woodland', walk: true, color: '#3f4f34' },
  2: { name: 'Path', walk: true, color: '#66543c' },
  3: { name: 'River', walk: false, color: '#314e56' },
  4: { name: 'Crag', walk: false, color: '#4b4942' },
  5: { name: 'Riverbank', walk: true, color: '#72684d' },
  6: { name: 'Old Stones', walk: true, color: '#5a574d' },
  7: { name: 'Tilled earth', walk: true, color: '#5b4630' },
};

export const SKILLS = [
  { id: 'construction', name: 'Masonry', icon: '⌂' },
  { id: 'mining', name: 'Mining', icon: '⛏' },
  { id: 'plants', name: 'Herbalism', icon: '❦' },
  { id: 'cooking', name: 'Cooking', icon: '♨' },
  { id: 'crafting', name: 'Crafting', icon: '⚒' },
  { id: 'medicine', name: 'Medicine', icon: '✚' },
  { id: 'research', name: 'Arcana', icon: '✦' },
  { id: 'combat', name: 'Martial', icon: '⚔' },
  { id: 'social', name: 'Diplomacy', icon: '☘' },
  { id: 'survival', name: 'Survival', icon: '◈' },
];

export const WORK_TYPES = [
  { id: 'firefight', name: 'Firefight', short: 'Fire', skill: null },
  { id: 'patient', name: 'Patient', short: 'Rest', skill: null },
  { id: 'doctor', name: 'Doctor', short: 'Heal', skill: 'medicine' },
  { id: 'cook', name: 'Cook', short: 'Cook', skill: 'cooking' },
  { id: 'hunt', name: 'Hunt', short: 'Hunt', skill: 'survival' },
  { id: 'construct', name: 'Construct', short: 'Build', skill: 'construction' },
  { id: 'mine', name: 'Mine', short: 'Mine', skill: 'mining' },
  { id: 'chop', name: 'Chop wood', short: 'Chop', skill: 'survival' },
  { id: 'plant', name: 'Plant', short: 'Plant', skill: 'plants' },
  { id: 'harvest', name: 'Harvest', short: 'Harvest', skill: 'plants' },
  { id: 'haul', name: 'Haul', short: 'Haul', skill: null },
  { id: 'craft', name: 'Craft', short: 'Craft', skill: 'crafting' },
  { id: 'research', name: 'Research', short: 'Study', skill: 'research' },
  { id: 'guard', name: 'Guard', short: 'Guard', skill: 'combat' },
];

export const RACES = {
  human: { name: 'Human', color: '#b98b5f', blurb: 'Adaptable and ambitious.' },
  dwarf: { name: 'Dwarf', color: '#9a6b49', blurb: 'Stone remembers their names.' },
  tiefling: { name: 'Tiefling', color: '#9b5f54', blurb: 'A fiendish inheritance, worn with pride.' },
  halfling: { name: 'Halfling', color: '#a68d5e', blurb: 'Small feet, enormous appetites.' },
  halfelf: { name: 'Half-elf', color: '#86947a', blurb: 'At home in two worlds, fully in neither.' },
  elf: { name: 'Elf', color: '#7f9678', blurb: 'Long memory and longer grief.' },
  orc: { name: 'Orc', color: '#7e8a5e', blurb: 'Strength is a language, not a threat.' },
};

export const CLASSES = {
  ranger: { name: 'Ranger', color: '#7e9465', icon: '➶', ranged: true, range: 5.4, damage: [8, 13], desc: 'Patient hunters and peerless trackers.' },
  guardian: { name: 'Guardian', color: '#a1664b', icon: '⛨', ranged: false, range: 1.25, damage: [11, 17], desc: 'A shield between the colony and the dark.' },
  sorcerer: { name: 'Sorcerer', color: '#92668f', icon: '✦', ranged: true, range: 5.8, damage: [9, 16], desc: 'Channels raw arcana, often unwisely.' },
  druid: { name: 'Druid', color: '#6f8b58', icon: '❧', ranged: false, range: 1.3, damage: [7, 12], desc: 'Speaks for root, river, and tooth.' },
  cleric: { name: 'Cleric', color: '#b39a63', icon: '✚', ranged: true, range: 4.6, damage: [6, 10], desc: 'Mends flesh and banishes the restless dead.' },
  bard: { name: 'Bard', color: '#8a789d', icon: '♪', ranged: true, range: 4.4, damage: [5, 9], desc: 'Turns a story into a weapon.' },
  rogue: { name: 'Rogue', color: '#6e747b', icon: '✧', ranged: false, range: 1.2, damage: [13, 20], desc: 'Finds the gap in every guard.' },
  wizard: { name: 'Wizard', color: '#6e7f9a', icon: '◈', ranged: true, range: 5.6, damage: [8, 15], desc: 'Knowledge, sharpened to a point.' },
};

export const TRAITS = {
  kind: { name: 'Kind', good: true, desc: 'Mood improves when helping others.', mood: 4 },
  quick: { name: 'Quick', good: true, desc: 'Moves 15% faster.', speed: 1.15 },
  ironwilled: { name: 'Iron-willed', good: true, desc: 'Mood is harder to break.', resilience: 0.7 },
  greenThumb: { name: 'Green Thumb', good: true, desc: '+2 to Herbalism checks.', skills: { plants: 2 } },
  nightOwl: { name: 'Night Owl', good: true, desc: 'Happier and more effective after dusk.' },
  glutton: { name: 'Glutton', good: false, desc: 'Eats more, complains loudly.' },
  frail: { name: 'Frail', good: false, desc: 'Maximum health reduced.' },
  pyromaniac: { name: 'Pyromaniac', good: false, desc: 'Fascinated by fire; may linger near flames.' },
  sluggish: { name: 'Sluggish', good: false, desc: 'Moves 12% slower.' },
  empathetic: { name: 'Empathetic', good: true, desc: 'Feels every colony loss deeply.' },
  wanderlust: { name: 'Wanderlust', good: false, desc: 'Grows restless when kept inside walls.' },
  lucky: { name: 'Lucky', good: true, desc: 'Fortune smiles on risky endeavors.' },
  scarred: { name: 'Scarred', good: false, desc: 'Old wounds ache in the rain.' },
  herbalist: { name: 'Herbalist', good: true, desc: '+1 Medicine, +1 Herbalism.', skills: { medicine: 1, plants: 1 } },
};

export const BUILDINGS = {
  bed: {
    name: 'Straw Bed', cat: 'Shelter', icon: '▭', w: 1, h: 1, cost: { wood: 6 }, time: 8,
    desc: 'A rough cot. Rest is 40% more effective. Colonists claim one when tired.',
    tags: ['comfort', 'sleep'], blocks: false, order: 1,
  },
  campfire: {
    name: 'Campfire', cat: 'Shelter', icon: '♨', w: 1, h: 1, cost: { wood: 8, stone: 3 }, time: 10,
    desc: 'Warmth, light, and a place to cook. Lifts nearby spirits.',
    tags: ['light', 'cook', 'mood'], blocks: false, order: 2,
  },
  stockpile: {
    name: 'Supply Pile', cat: 'Shelter', icon: '▤', w: 2, h: 2, cost: { wood: 5 }, time: 6,
    desc: 'Woven mats and marked crates. +120 resource capacity.',
    tags: ['storage'], blocks: false, order: 3,
  },
  tent: {
    name: 'Canvas Tent', cat: 'Shelter', icon: '⌂', w: 2, h: 2, cost: { wood: 8, herbs: 2 }, time: 14,
    desc: 'A private shelter. +4 mood while sleeping under canvas.',
    tags: ['comfort', 'sleep', 'mood'], blocks: false, order: 4,
  },
  farm: {
    name: 'Sunwheat Plot', cat: 'Production', icon: '❦', w: 1, h: 1, cost: { wood: 1 }, time: 4,
    desc: 'Tilled soil for sunwheat. Yields 7–12 food every two days.',
    tags: ['food'], blocks: false, order: 5,
  },
  workbench: {
    name: 'Tinker Bench', cat: 'Production', icon: '⚒', w: 1, h: 1, cost: { wood: 12, stone: 3 }, time: 16,
    desc: 'Turns timber and idle hands into trade goods. Generates silver.',
    tags: ['craft'], blocks: false, order: 6,
  },
  researchDesk: {
    name: 'Rune Desk', cat: 'Production', icon: '✦', w: 1, h: 1, cost: { wood: 14, stone: 4, crystal: 1 }, time: 18,
    desc: 'A scholar’s table for unraveling the Marches. Generates research.',
    tags: ['research'], blocks: false, order: 7,
  },
  palisade: {
    name: 'Palisade', cat: 'Defense', icon: '▥', w: 1, h: 1, cost: { wood: 4 }, time: 9,
    desc: 'A sharpened timber wall. Blocks movement and slows raiders.',
    tags: ['wall'], blocks: true, order: 8,
  },
  watchtower: {
    name: 'Watchtower', cat: 'Defense', icon: '♜', w: 2, h: 2, cost: { wood: 18, stone: 8 }, time: 24,
    desc: 'High ground and a signal horn. +15% ranged damage nearby.',
    tags: ['defense', 'guard'], blocks: true, order: 9, requires: 'stonecraft',
  },
  infirmary: {
    name: 'Healer’s Cot', cat: 'Defense', icon: '✚', w: 1, h: 1, cost: { wood: 8, herbs: 4 }, time: 12,
    desc: 'Clean linen and bitter tinctures. Doctors work 50% faster here.',
    tags: ['medicine'], blocks: false, order: 10, requires: 'medicine',
  },
  forge: {
    name: 'Ember Forge', cat: 'Production', icon: '⚒', w: 2, h: 2, cost: { stone: 14, wood: 6 }, time: 28,
    desc: 'A dwarven heart in a human camp. Unlocks steel tools and +2 crafting.',
    tags: ['craft', 'production'], blocks: true, order: 11, requires: 'metallurgy',
  },
  shrine: {
    name: 'Waystone Shrine', cat: 'Faith', icon: '◈', w: 2, h: 2, cost: { stone: 22, crystal: 4 }, time: 32,
    desc: 'Restores the old ward. +8 colony mood and steadies the veil.',
    tags: ['mood', 'quest'], blocks: false, order: 12, requires: 'arcana',
  },
  herbGarden: {
    name: 'Herb Garden', cat: 'Production', icon: '❧', w: 1, h: 1, cost: { wood: 2, food: 2 }, time: 8,
    desc: 'Bitterleaf and silvermint. Slowly produces herbs.',
    tags: ['herbs'], blocks: false, order: 13, requires: 'medicine',
  },
  runeWard: {
    name: 'Rune Ward', cat: 'Defense', icon: '◉', w: 1, h: 1, cost: { stone: 4, crystal: 2 }, time: 16,
    desc: 'A humming ward. Slows and weakens creatures of the veil.',
    tags: ['defense', 'arcane'], blocks: false, order: 14, requires: 'arcana',
  },
  well: {
    name: 'Stone Well', cat: 'Shelter', icon: '◒', w: 2, h: 2, cost: { stone: 12, wood: 3 }, time: 20,
    desc: 'Clean water and a gathering place. +3 mood, firefighting bonus.',
    tags: ['mood', 'utility'], blocks: true, order: 15,
  },
};

export const RESEARCH = {
  agriculture: {
    name: 'Deep Roots', icon: '❦', cost: 38, requires: null,
    desc: 'Crop yields +35%. Farms become immune to blight.',
    effect: 'Farms yield more food.',
  },
  stonecraft: {
    name: 'Stonecraft', icon: '▥', cost: 46, requires: null,
    desc: 'Unlocks Watchtowers. Construction speed +15%.',
    effect: 'Unlocks watchtower.',
  },
  medicine: {
    name: 'Field Medicine', icon: '✚', cost: 54, requires: null,
    desc: 'Unlocks Healer’s Cots and Herb Gardens. Healing +50%.',
    effect: 'Unlocks medicine buildings.',
  },
  arcana: {
    name: 'The Veil Thins', icon: '✦', cost: 68, requires: 'stonecraft',
    desc: 'Unlocks Waystone Shrines and Rune Wards. Reveals veil creatures.',
    effect: 'Unlocks arcane buildings.',
  },
  metallurgy: {
    name: 'Ember Metallurgy', icon: '⚒', cost: 82, requires: 'stonecraft',
    desc: 'Unlocks the Ember Forge. Melee damage +20%.',
    effect: 'Unlocks forge and steel.',
  },
  husbandry: {
    name: 'Beast Tongues', icon: '❧', cost: 70, requires: 'agriculture',
    desc: 'Wild beasts may be calmed. +2 survival to all colonists.',
    effect: 'Calm hostile beasts.',
  },
  astronomy: {
    name: 'Astral Navigation', icon: '◉', cost: 96, requires: 'arcana',
    desc: 'Reveals distant landmarks and reduces expedition time by 30%.',
    effect: 'World travel improved.',
  },
  wards: {
    name: 'Greater Wards', icon: '◈', cost: 120, requires: 'arcana',
    desc: 'Rune wards repel the dead. Colony defense +25%.',
    effect: 'Stronger wards.',
  },
};

export const ENEMY_TYPES = {
  goblin: { name: 'Goblin Raider', hp: 42, damage: [4, 7], speed: 1.8, color: '#7f8f4e', accent: '#b1a26c', range: 1.1, xp: 2, loot: { silver: 3 }, shape: 'goblin' },
  wolf: { name: 'Dire Wolf', hp: 55, damage: [5, 9], speed: 2.5, color: '#6f6d68', accent: '#b9b4a7', range: 1.15, xp: 2, loot: { food: 4 }, shape: 'wolf' },
  skeleton: { name: 'Restless Bones', hp: 34, damage: [3, 6], speed: 1.5, color: '#b7ae96', accent: '#ddd4ba', range: 1.1, xp: 3, loot: { crystal: 1 }, shape: 'skeleton' },
  cultist: { name: 'Veil Cultist', hp: 50, damage: [7, 11], speed: 1.7, color: '#6a4c64', accent: '#a9779b', range: 1.2, xp: 4, loot: { crystal: 2, silver: 2 }, shape: 'cultist' },
  ogre: { name: 'Marrow Ogre', hp: 130, damage: [11, 17], speed: 1.3, color: '#77755f', accent: '#b09c72', range: 1.4, xp: 8, loot: { silver: 8, stone: 6 }, shape: 'ogre' },
  wraith: { name: 'Pale Wraith', hp: 66, damage: [8, 12], speed: 2.0, color: '#65757c', accent: '#b6c8c8', range: 1.3, xp: 5, loot: { crystal: 3 }, shape: 'wraith' },
};

export const WORLD_LOCATIONS = [
  { id: 'camp', name: 'Ashenreach Camp', type: 'home', x: 30, y: 19, discovered: true, desc: 'The last fire before the wilds. Five exiles and a broken waystone.' },
  { id: 'ruins', name: 'Sunken Shrine', type: 'ruin', x: 47, y: 29, discovered: true, desc: 'A circle of drowned stone. Something beneath it is dreaming.', danger: 2 },
  { id: 'grove', name: 'Whisperwood Grove', type: 'forest', x: 13, y: 12, discovered: true, desc: 'The trees lean close here. Herbs grow thick, and eyes watch from the canopy.', danger: 1 },
  { id: 'barrow', name: 'Kingsbarrow', type: 'barrow', x: 51, y: 9, discovered: false, desc: 'A hill that was not always a hill. The old kings do not sleep soundly.', danger: 3 },
  { id: 'road', name: 'The Merchant Road', type: 'road', x: 31, y: 37, discovered: true, desc: 'Ruts worn by a century of carts. Travelers still brave it, sometimes.', danger: 1 },
  { id: 'tower', name: 'Hollow Watch', type: 'tower', x: 8, y: 33, discovered: false, desc: 'An empty tower with a beacon that burns green on moonless nights.', danger: 2 },
  { id: 'rift', name: 'The Sundered Rift', type: 'rift', x: 56, y: 37, discovered: false, desc: 'A wound in the world. Arcana pours out like heat from a forge.', danger: 4 },
];

export const INCIDENTS = [
  {
    id: 'goblinRaid', weight: 24, minDay: 2, title: 'Raiders in the Pines', kicker: 'Incident · Hostile',
    text: 'A goblin warband has caught the scent of your stores.',
    spawn: 'goblin', count: [2, 4],
  },
  {
    id: 'wolfPack', weight: 15, minDay: 2, title: 'Hunger in the Dark', kicker: 'Incident · Predators',
    text: 'Dire wolves circle the camp, drawn by the smell of cooking meat.',
    spawn: 'wolf', count: [2, 3],
  },
  {
    id: 'skeletons', weight: 12, minDay: 3, title: 'Bones Remember', kicker: 'Incident · The Veil',
    text: 'The old barrows have opened. Restless dead walk toward the waystone.',
    spawn: 'skeleton', count: [2, 4],
  },
  {
    id: 'cultists', weight: 9, minDay: 4, title: 'A Choir of Ash', kicker: 'Incident · Veil Cult',
    text: 'Veil cultists come to finish what drowned the shrine.',
    spawn: 'cultist', count: [2, 3],
  },
  {
    id: 'traveler', weight: 18, minDay: 1, title: 'A Stranger at the Fire', kicker: 'Incident · Wanderer',
    text: 'A road-worn traveler asks for shelter. They have capable hands.',
    action: 'traveler',
  },
  {
    id: 'merchant', weight: 14, minDay: 1, title: 'The Peddler’s Cart', kicker: 'Incident · Trade',
    text: 'A masked merchant offers strange goods for silver.',
    action: 'merchant',
  },
  {
    id: 'eclipse', weight: 8, minDay: 2, title: 'The Sun Turns Aside', kicker: 'Incident · Omen',
    text: 'An unnatural eclipse drains the colour from the Marches. Moods sour.',
    action: 'eclipse',
  },
  {
    id: 'cache', weight: 10, minDay: 1, title: 'A Cache in the Roots', kicker: 'Incident · Discovery',
    text: 'A colony scout finds a rain-sealed chest beneath an old oak.',
    action: 'cache',
  },
  {
    id: 'omen', weight: 8, minDay: 3, title: 'The Waystone Murmurs', kicker: 'Incident · Arcana',
    text: 'The broken waystone exhales. Your arcanists feel a pull toward the ruins.',
    action: 'omen',
  },
  {
    id: 'festival', weight: 7, minDay: 4, title: 'A Small, Defiant Joy', kicker: 'Incident · Respite',
    text: 'Someone finds a jar of honey. The colony gathers, and for a night, the dark waits.',
    action: 'festival',
  },
];

export const EXPEDITIONS = [
  {
    id: 'whisperwood', name: 'Forage Whisperwood', location: 'grove', days: 1, risk: 1,
    cost: { food: 6 }, desc: 'Send two colonists to gather herbs and scout the old paths.',
    reward: { herbs: 12, wood: 10, silver: 4 }, skill: 'survival',
  },
  {
    id: 'shrine', name: 'Delve the Sunken Shrine', location: 'ruins', days: 2, risk: 2,
    cost: { food: 12, meals: 4 }, desc: 'Break the seal beneath the drowned stones. The quest demands it.',
    reward: { crystal: 8, silver: 20, research: 25 }, skill: 'research', quest: 'shrine',
  },
  {
    id: 'road', name: 'Patrol the Merchant Road', location: 'road', days: 1, risk: 1,
    cost: { food: 5 }, desc: 'Hunt bandits and escort a wagon home for coin.',
    reward: { silver: 18, food: 5 }, skill: 'combat',
  },
  {
    id: 'barrow', name: 'Open Kingsbarrow', location: 'barrow', days: 3, risk: 3,
    cost: { meals: 8, herbs: 4 }, desc: 'A tomb of old kings. The dead will object.',
    reward: { silver: 40, crystal: 10, research: 35 }, skill: 'combat', requires: 'barrow',
  },
];

export const SEASONS = [
  { name: 'Highsun', weather: ['Clear skies', 'Warm wind', 'Distant thunder'], tint: '#f1c97d' },
  { name: 'Emberfall', weather: ['Amber haze', 'Crisp wind', 'First frost'], tint: '#d99a63' },
  { name: 'Longnight', weather: ['Cold rain', 'Grey sleet', 'Bitter wind'], tint: '#7790a2' },
  { name: 'Thaw', weather: ['Mist', 'Soft rain', 'New growth'], tint: '#8fa58a' },
];

export const RESOURCE_META = {
  wood: { name: 'Wood', icon: 'wood' },
  stone: { name: 'Stone', icon: 'stone' },
  food: { name: 'Food', icon: 'food' },
  meals: { name: 'Meals', icon: 'meal' },
  herbs: { name: 'Herbs', icon: 'herb' },
  crystal: { name: 'Crystal', icon: 'crystal' },
  silver: { name: 'Silver', icon: 'silver' },
};
