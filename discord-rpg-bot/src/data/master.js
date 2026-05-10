// src/data/master.js

export const CLASSES = {
  warrior: { name: '⚔️ 戦士',    emoji: '⚔️', description: '高いHPと攻撃力を持つ前衛型。安定した物理攻撃が強み。' },
  mage:    { name: '🔮 魔法使い', emoji: '🔮', description: '強力な魔法攻撃を持つが、耐久力は低い。' },
  cleric:  { name: '✨ 僧侶',    emoji: '✨', description: '回復魔法でパーティを支援する。攻撃力は控えめ。' },
  rogue:   { name: '🗡️ 盗賊',    emoji: '🗡️', description: '速度と回避に優れ、先制攻撃が得意。' },
  archer:  { name: '🏹 弓使い',  emoji: '🏹', description: '遠距離から安定したダメージを与える。' },
};

export const AREAS = {
  starting_village: {
    name: '🏘️ 始まりの村',
    description: 'エーテリオンの旅の起点となる小さな村。',
    level_range: [1, 5],
    enemies: ['slime', 'goblin'],
    next_areas: ['forest_of_whispers'],
  },
  forest_of_whispers: {
    name: '🌲 囁きの森',
    description: '不思議な声が聞こえる深い森。中級の魔物が生息する。',
    level_range: [5, 12],
    enemies: ['wolf', 'forest_sprite', 'dark_goblin'],
    next_areas: ['ancient_ruins'],
  },
  ancient_ruins: {
    name: '🏛️ 古代遺跡',
    description: 'エーテル結晶が最初に消えた場所。強敵が待ち受ける。',
    level_range: [12, 20],
    enemies: ['stone_golem', 'ruin_guardian'],
    next_areas: [],
  },
};

export const ENEMIES = {
  slime:         { name: '🟢 スライム',       hp: 20,  atk: 4,  def: 1,  spd: 3,  exp: 8,   gold: [3,8],    drops: [{ item: 'potion',    rate: 0.2 }] },
  goblin:        { name: '👺 ゴブリン',        hp: 35,  atk: 8,  def: 3,  spd: 6,  exp: 15,  gold: [5,15],   drops: [{ item: 'iron_dagger', rate: 0.1 }] },
  wolf:          { name: '🐺 ダークウルフ',    hp: 55,  atk: 14, def: 5,  spd: 12, exp: 30,  gold: [10,25],  drops: [{ item: 'wolf_fang',  rate: 0.3 }] },
  forest_sprite: { name: '🧚 フォレストスプライト', hp: 40, atk: 18, def: 2, spd: 15, exp: 35, gold: [12,20], drops: [{ item: 'mp_potion', rate: 0.25 }] },
  dark_goblin:   { name: '👹 ダークゴブリン',  hp: 70,  atk: 16, def: 8,  spd: 8,  exp: 45,  gold: [18,35],  drops: [{ item: 'steel_sword', rate: 0.08 }] },
  stone_golem:   { name: '🗿 ストーンゴーレム', hp: 150, atk: 22, def: 18, spd: 3,  exp: 90,  gold: [40,70],  drops: [{ item: 'golem_core',  rate: 0.2 }] },
  ruin_guardian: { name: '🤖 遺跡の守護者',   hp: 200, atk: 28, def: 15, spd: 10, exp: 150, gold: [60,100], drops: [{ item: 'ancient_crystal', rate: 0.15 }] },
};

// アイテム定義
// type: consumable=消耗品 / weapon=武器 / armor=防具 / material=素材 / key=重要アイテム
// slot: weapon=武器スロット / head=頭 / body=体 / accessory=アクセサリ
// equip: 装備時のステータス増加
export const ITEMS = {
  // 消耗品
  potion:          { name: '🧪 ポーション',       type: 'consumable', effect: { hp: 50 },  price: 50,  description: 'HPを50回復する。' },
  mp_potion:       { name: '💙 MPポーション',      type: 'consumable', effect: { mp: 30 },  price: 80,  description: 'MPを30回復する。' },

  // 武器
  iron_dagger:     { name: '🗡️ 鉄のダガー',       type: 'weapon', slot: 'weapon', equip: { atk: 5 },           price: 120, description: '軽くて扱いやすい短剣。ATK+5' },
  steel_sword:     { name: '⚔️ 鋼の剣',           type: 'weapon', slot: 'weapon', equip: { atk: 12 },          price: 350, description: '頑丈な鋼鉄の剣。ATK+12' },
  mage_staff:      { name: '🪄 魔法使いの杖',      type: 'weapon', slot: 'weapon', equip: { atk: 8, mp: 20 },   price: 300, description: '魔力を高める杖。ATK+8 MP+20' },
  hunters_bow:     { name: '🏹 ハンターズボウ',    type: 'weapon', slot: 'weapon', equip: { atk: 10, spd: 3 },  price: 280, description: '軽量な狩人の弓。ATK+10 SPD+3' },
  holy_mace:       { name: '🔨 聖なるメイス',      type: 'weapon', slot: 'weapon', equip: { atk: 7, hp: 20 },   price: 320, description: '僧侶向けの鈍器。ATK+7 HP+20' },

  // 防具（体）
  leather_armor:   { name: '🥋 レザーアーマー',    type: 'armor',  slot: 'body',  equip: { def: 5 },            price: 150, description: '軽い革の鎧。DEF+5' },
  chain_mail:      { name: '🛡️ チェインメイル',    type: 'armor',  slot: 'body',  equip: { def: 10 },           price: 400, description: '鎖で編まれた鎧。DEF+10' },
  mage_robe:       { name: '👘 魔法使いのローブ',   type: 'armor',  slot: 'body',  equip: { def: 3, mp: 30 },    price: 350, description: '魔力を高めるローブ。DEF+3 MP+30' },

  // 防具（頭）
  iron_helmet:     { name: '⛑️ 鉄兜',             type: 'armor',  slot: 'head',  equip: { def: 4, hp: 10 },    price: 180, description: '頭を守る鉄の兜。DEF+4 HP+10' },
  wizards_hat:     { name: '🎩 ウィザードハット',   type: 'armor',  slot: 'head',  equip: { def: 2, mp: 15 },    price: 200, description: '魔力を高める帽子。DEF+2 MP+15' },

  // アクセサリ
  speed_ring:      { name: '💍 スピードリング',     type: 'armor',  slot: 'accessory', equip: { spd: 8 },        price: 250, description: '素早さが増す指輪。SPD+8' },
  power_amulet:    { name: '📿 パワーアミュレット', type: 'armor',  slot: 'accessory', equip: { atk: 6, def: 3 }, price: 300, description: '攻防を高める護符。ATK+6 DEF+3' },

  // 素材・重要アイテム
  wolf_fang:       { name: '🦷 ウルフファング',     type: 'material', effect: {}, price: 30,  description: 'ダークウルフの牙。素材として使える。' },
  golem_core:      { name: '💎 ゴーレムコア',       type: 'material', effect: {}, price: 200, description: 'ゴーレムの核。希少な素材。' },
  ancient_crystal: { name: '🔷 古代結晶',           type: 'key',      effect: {}, price: 0,   description: '失われたエーテル結晶の欠片。物語の鍵を握る。' },
};

// ショップ在庫（エリアごと）
export const SHOP_INVENTORY = {
  starting_village: [
    { key: 'potion',        price: 50  },
    { key: 'mp_potion',     price: 80  },
    { key: 'iron_dagger',   price: 120 },
    { key: 'leather_armor', price: 150 },
    { key: 'iron_helmet',   price: 180 },
  ],
  forest_of_whispers: [
    { key: 'potion',        price: 50  },
    { key: 'mp_potion',     price: 80  },
    { key: 'steel_sword',   price: 350 },
    { key: 'mage_staff',    price: 300 },
    { key: 'hunters_bow',   price: 280 },
    { key: 'holy_mace',     price: 320 },
    { key: 'chain_mail',    price: 400 },
    { key: 'mage_robe',     price: 350 },
    { key: 'wizards_hat',   price: 200 },
    { key: 'speed_ring',    price: 250 },
  ],
  ancient_ruins: [
    { key: 'potion',         price: 50  },
    { key: 'mp_potion',      price: 80  },
    { key: 'steel_sword',    price: 350 },
    { key: 'chain_mail',     price: 400 },
    { key: 'power_amulet',   price: 300 },
  ],
};

// 装備スロット定義
export const EQUIPMENT_SLOTS = {
  weapon:    '⚔️ 武器',
  body:      '🛡️ 体防具',
  head:      '🪖 頭防具',
  accessory: '💍 アクセサリ',
};

// レベルアップに必要な経験値
export function expToNextLevel(level) {
  return level * 100;
}

// レベルアップ処理
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
    messages.push(`🎉 **レベルアップ！** Lv.${level - 1} → Lv.${level}`);
  }

  return { level, exp, max_hp, max_mp, atk, def, spd, hp: max_hp, mp: max_mp, leveledUp, messages };
}

// 装備込みのステータスを計算する
export function calcEquippedStats(player) {
  const equipment = player.equipment ? JSON.parse(
    typeof player.equipment === 'string' ? player.equipment : JSON.stringify(player.equipment)
  ) : {};

  let bonusAtk = 0, bonusDef = 0, bonusSpd = 0, bonusHp = 0, bonusMp = 0;

  for (const itemKey of Object.values(equipment)) {
    if (!itemKey) continue;
    const item = ITEMS[itemKey];
    if (!item || !item.equip) continue;
    bonusAtk += item.equip.atk || 0;
    bonusDef += item.equip.def || 0;
    bonusSpd += item.equip.spd || 0;
    bonusHp  += item.equip.hp  || 0;
    bonusMp  += item.equip.mp  || 0;
  }

  return {
    atk: player.atk + bonusAtk,
    def: player.def + bonusDef,
    spd: player.spd + bonusSpd,
    max_hp: player.max_hp + bonusHp,
    max_mp: player.max_mp + bonusMp,
    bonus: { atk: bonusAtk, def: bonusDef, spd: bonusSpd, hp: bonusHp, mp: bonusMp },
  };
}
