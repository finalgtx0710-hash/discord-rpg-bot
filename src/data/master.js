export const CLASSES = {
  warrior: { name: '戦士',    emoji: '⚔️', description: '高いHPと攻撃力を持つ前衛型。' },
  mage:    { name: '魔法使い', emoji: '🔮', description: '強力な魔法攻撃を持つが耐久力は低い。' },
  cleric:  { name: '僧侶',    emoji: '✨', description: '回復魔法でパーティを支援する。' },
  rogue:   { name: '盗賊',    emoji: '🗡️', description: '速度と回避に優れ先制攻撃が得意。' },
  archer:  { name: '弓使い',  emoji: '🏹', description: '遠距離から安定したダメージを与える。' },
};

export const EQUIPMENT_SLOTS = {
  weapon:    '武器',
  armor:     '防具',
  accessory: 'アクセサリ',
};

export const AREAS = {
  starting_village: {
    name: '始まりの村',
    description: 'エーテリオンの旅の起点となる小さな村。',
    level_range: [1, 5],
    enemies: ['slime', 'goblin'],
    next_areas: ['forest_of_whispers'],
  },
  forest_of_whispers: {
    name: '囁きの森',
    description: '不思議な声が聞こえる深い森。中級の魔物が生息する。',
    level_range: [5, 12],
    enemies: ['wolf', 'forest_sprite', 'dark_goblin'],
    next_areas: ['ancient_ruins'],
  },
  ancient_ruins: {
    name: '古代遺跡',
    description: 'エーテル結晶が最初に消えた場所。強敵が待ち受ける。',
    level_range: [12, 18],
    enemies: ['stone_golem', 'ruin_guardian'],
    next_areas: ['crystal_cavern'],
  },
  crystal_cavern: {
    name: '水晶洞窟',
    description: 'エーテル結晶の残滓が輝く神秘的な洞窟。強力な魔法生物が生息する。',
    level_range: [18, 25],
    enemies: ['crystal_golem', 'mana_wisp', 'shadow_dragon'],
    next_areas: ['ether_sanctuary'],
  },
  ether_sanctuary: {
    name: 'エーテルの聖域',
    description: 'エーテル結晶の源泉。世界の根源に近いこの場所には、最強の守護者が待ち受ける。',
    level_range: [25, 99],
    enemies: ['ether_guardian', 'void_knight', 'ancient_dragon'],
    next_areas: [],
  },
};

export const ENEMIES = {
  slime:          { name: 'スライム',             hp: 20,  atk: 4,  def: 1,  spd: 3,  exp: 8,   gold: [3,8],    drops: [{ item: 'potion',        rate: 0.2  }] },
  goblin:         { name: 'ゴブリン',             hp: 35,  atk: 8,  def: 3,  spd: 6,  exp: 15,  gold: [5,15],   drops: [{ item: 'iron_dagger',   rate: 0.1  }] },
  wolf:           { name: 'ダークウルフ',         hp: 55,  atk: 14, def: 5,  spd: 12, exp: 30,  gold: [10,25],  drops: [{ item: 'wolf_fang',     rate: 0.3  }] },
  forest_sprite:  { name: 'フォレストスプライト', hp: 40,  atk: 18, def: 2,  spd: 15, exp: 35,  gold: [12,20],  drops: [{ item: 'mp_potion',     rate: 0.25 }] },
  dark_goblin:    { name: 'ダークゴブリン',       hp: 70,  atk: 16, def: 8,  spd: 8,  exp: 45,  gold: [18,35],  drops: [{ item: 'steel_sword',   rate: 0.08 }] },
  stone_golem:    { name: 'ストーンゴーレム',     hp: 150, atk: 22, def: 18, spd: 3,  exp: 90,  gold: [40,70],  drops: [{ item: 'golem_core',    rate: 0.2  }] },
  ruin_guardian:  { name: '遺跡の守護者',         hp: 200, atk: 28, def: 15, spd: 10, exp: 150, gold: [60,100], drops: [{ item: 'ancient_crystal', rate: 0.15 }] },
  crystal_golem:  { name: 'クリスタルゴーレム',   hp: 280, atk: 35, def: 25, spd: 5,  exp: 200, gold: [80,130], drops: [{ item: 'crystal_shard', rate: 0.35 }] },
  mana_wisp:      { name: 'マナウィスプ',         hp: 180, atk: 45, def: 8,  spd: 20, exp: 220, gold: [70,120], drops: [{ item: 'mana_crystal',  rate: 0.3  }] },
  shadow_dragon:  { name: 'シャドウドラゴン',     hp: 350, atk: 50, def: 20, spd: 15, exp: 300, gold: [100,180], drops: [{ item: 'dragon_scale', rate: 0.2  }] },
  ether_guardian: { name: 'エーテル守護者',       hp: 500, atk: 60, def: 30, spd: 18, exp: 450, gold: [150,250], drops: [{ item: 'ether_crystal', rate: 0.25 }] },
  void_knight:    { name: 'ヴォイドナイト',       hp: 420, atk: 55, def: 35, spd: 12, exp: 400, gold: [130,220], drops: [{ item: 'void_shard',   rate: 0.2  }] },
  ancient_dragon: { name: '古代竜',               hp: 600, atk: 70, def: 40, spd: 10, exp: 600, gold: [200,350], drops: [{ item: 'dragon_heart', rate: 0.15 }] },
};

export const ITEMS = {
  potion:          { name: 'ポーション',         type: 'consumable', slot: null,        equip: {},                  effect: { hp: 50 }, price: 50,   description: 'HPを50回復する。' },
  mp_potion:       { name: 'MPポーション',       type: 'consumable', slot: null,        equip: {},                  effect: { mp: 30 }, price: 80,   description: 'MPを30回復する。' },
  iron_dagger:     { name: '鉄のダガー',         type: 'weapon',     slot: 'weapon',    equip: { atk: 5 },          effect: {},         price: 120,  description: '軽くて扱いやすい短剣。ATK+5' },
  steel_sword:     { name: '鋼の剣',             type: 'weapon',     slot: 'weapon',    equip: { atk: 12 },         effect: {},         price: 350,  description: '頑丈な鋼鉄の剣。ATK+12' },
  iron_shield:     { name: '鉄の盾',             type: 'armor',      slot: 'armor',     equip: { def: 8 },          effect: {},         price: 150,  description: '基本的な盾。DEF+8' },
  leather_armor:   { name: '革の鎧',             type: 'armor',      slot: 'armor',     equip: { def: 5, hp: 20 },  effect: {},         price: 200,  description: '軽くて動きやすい鎧。DEF+5 HP+20' },
  silver_ring:     { name: '銀の指輪',           type: 'accessory',  slot: 'accessory', equip: { spd: 3 },          effect: {},         price: 180,  description: '速度を高める指輪。SPD+3' },
  wolf_fang:       { name: 'ウルフファング',     type: 'material',   slot: null,        equip: {},                  effect: {},         price: 30,   description: 'ダークウルフの牙。素材として使える。' },
  golem_core:      { name: 'ゴーレムコア',       type: 'material',   slot: null,        equip: {},                  effect: {},         price: 200,  description: 'ゴーレムの核。希少な素材。' },
  ancient_crystal: { name: '古代結晶',           type: 'key',        slot: null,        equip: {},                  effect: {},         price: 0,    description: '失われたエーテル結晶の欠片。物語の鍵を握る。' },
  crystal_shard:   { name: 'クリスタルの欠片',   type: 'material',   slot: null,        equip: {},                  effect: {},         price: 300,  description: '水晶洞窟で採れる希少な欠片。' },
  mana_crystal:    { name: 'マナクリスタル',     type: 'material',   slot: null,        equip: {},                  effect: {},         price: 400,  description: '魔力が凝縮された結晶。' },
  dragon_scale:    { name: 'ドラゴンスケイル',   type: 'armor',      slot: 'armor',     equip: { def: 20, hp: 50 }, effect: {},         price: 1500, description: '龍の鱗で作った最強の鎧。DEF+20 HP+50' },
  ether_crystal:   { name: 'エーテル結晶',       type: 'key',        slot: null,        equip: {},                  effect: {},         price: 0,    description: '失われた世界の源泉。物語の核心。' },
  void_shard:      { name: 'ヴォイドの欠片',     type: 'material',   slot: null,        equip: {},                  effect: {},         price: 500,  description: '虚無から生まれた謎の欠片。' },
  dragon_heart:    { name: '龍の心臓',           type: 'accessory',  slot: 'accessory', equip: { atk: 15, spd: 8 }, effect: {},         price: 2000, description: '古代竜の心臓。ATK+15 SPD+8' },
  ether_sword:     { name: 'エーテルソード',     type: 'weapon',     slot: 'weapon',    equip: { atk: 25 },         effect: {},         price: 2500, description: 'エーテルの力を宿した最強の剣。ATK+25' },
};

export const SHOP_ITEMS_BY_AREA = {
  starting_village:   ['potion', 'mp_potion', 'iron_dagger', 'leather_armor', 'silver_ring'],
  forest_of_whispers: ['potion', 'mp_potion', 'steel_sword', 'iron_shield',   'silver_ring'],
  ancient_ruins:      ['potion', 'mp_potion', 'steel_sword', 'iron_shield',   'silver_ring'],
  crystal_cavern:     ['potion', 'mp_potion', 'dragon_scale', 'ether_sword',  'dragon_heart'],
  ether_sanctuary:    ['potion', 'mp_potion', 'dragon_scale', 'ether_sword',  'dragon_heart'],
};

export function expToNextLevel(level) {
  return level * 30;
}

export function calcLevelUp(player) {
  let { level, exp, max_hp, max_mp, atk, def, spd } = player;
  let leveledUp = false;
  const messages = [];
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level++;
    leveledUp = true;
    max_hp += 10;
    max_mp += 5;
    atk    += 2;
    def    += 1;
    spd    += 1;
    messages.push(`レベルアップ！ Lv.${level - 1} → Lv.${level}`);
  }
  return { level, exp, max_hp, max_mp, atk, def, spd, hp: max_hp, mp: max_mp, leveledUp, messages };
}

export function calcEquippedStats(player) {
  const equipment = player.equipment || {};
  const bonus = { atk: 0, def: 0, spd: 0, hp: 0, mp: 0 };
  for (const key of Object.values(equipment)) {
    if (!key) continue;
    const item = ITEMS[key];
    if (!item || !item.equip) continue;
    for (const [stat, val] of Object.entries(item.equip)) {
      if (bonus[stat] !== undefined) bonus[stat] += val;
    }
  }
  return {
    atk:    player.atk    + bonus.atk,
    def:    player.def    + bonus.def,
    spd:    player.spd    + bonus.spd,
    max_hp: player.max_hp + bonus.hp,
    max_mp: player.max_mp + bonus.mp,
    bonus,
  };
}