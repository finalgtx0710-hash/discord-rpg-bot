import crypto from 'crypto';

export const RARITY_COLORS = {
  Common: 0xAAAAAA,
  Rare: 0x4488FF,
  Epic: 0xAA44FF,
  Legendary: 0xFFD700,
  Mythic: 0xFF69B4,
};

export const RARITY_WEIGHTS = [
  ['Common', 50],
  ['Rare', 30],
  ['Epic', 15],
  ['Legendary', 4],
  ['Mythic', 1],
];

export const PREFIXES = ['神聖な', '呪われた', '暴食の', '雷鳴の', '凍てついた', '虚無の', '紅蓮の', '影の'];

export const OPTION_POOL = [
  { type: 'atk_bonus', label: 'ATK', range: [3, 20], suffix: '' },
  { type: 'def_bonus', label: 'DEF', range: [2, 15], suffix: '' },
  { type: 'fire_bonus', label: '火属性', range: [3, 15], suffix: '%' },
  { type: 'crit_rate', label: 'クリティカル率', range: [1, 10], suffix: '%' },
  { type: 'hp_bonus', label: 'HP', range: [10, 60], suffix: '' },
  { type: 'exp_bonus', label: '獲得EXP', range: [2, 10], suffix: '%' },
  { type: 'lightning', label: '雷属性', range: [3, 15], suffix: '%' },
  { type: 'ice_bonus', label: '氷属性', range: [3, 15], suffix: '%' },
];

const BASE_ITEMS = [
  { name: '蒼炎の剣', slot: 'weapon', base_atk: 12 },
  { name: '月影の短剣', slot: 'weapon', base_atk: 10 },
  { name: '守護者の盾', slot: 'armor', base_atk: 0 },
  { name: '旅人の指輪', slot: 'accessory', base_atk: 0 },
];

function rollInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickWeighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[0][0];
}

function pickManyUnique(items, count) {
  const pool = [...items];
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export function generateEquipment(ownerId) {
  const base = BASE_ITEMS[Math.floor(Math.random() * BASE_ITEMS.length)];
  const rarity = pickWeighted(RARITY_WEIGHTS);
  const optionCount = rollInt(2, 4);
  const options = pickManyUnique(OPTION_POOL, optionCount).map((option) => ({
    type: option.type,
    label: option.label,
    value: rollInt(option.range[0], option.range[1]),
    suffix: option.suffix,
  }));

  return {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    name: base.name,
    rarity,
    prefix: PREFIXES[Math.floor(Math.random() * PREFIXES.length)],
    base_atk: base.base_atk,
    options,
    equipped: false,
    slot: base.slot,
  };
}

export function formatEquipmentName(item) {
  return `${item.prefix || ''}${item.name} [${item.rarity}]`;
}

export function calculateDismantleValue(item) {
  const values = { Common: 30, Rare: 80, Epic: 180, Legendary: 500, Mythic: 1200 };
  return values[item.rarity] || 20;
}

export function equipmentStatBonuses(item) {
  const bonus = { atk: item.base_atk || 0, def: 0, hp: 0, exp: 0, crit: 0 };
  for (const option of item.options || []) {
    if (option.type === 'atk_bonus') bonus.atk += option.value;
    if (option.type === 'def_bonus') bonus.def += option.value;
    if (option.type === 'hp_bonus') bonus.hp += option.value;
    if (option.type === 'exp_bonus') bonus.exp += option.value;
    if (option.type === 'crit_rate') bonus.crit += option.value;
  }
  return bonus;
}
