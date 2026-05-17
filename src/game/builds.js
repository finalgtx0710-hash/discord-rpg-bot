export const SUBCLASSES = {
  warrior: [
    { id: 'berserker', name: 'バーサーカー型', description: '攻撃特化・自傷リスクあり' },
    { id: 'tank', name: 'タンク型', description: '防御・挑発スキル' },
    { id: 'counter', name: 'カウンター型', description: '被ダメージ反射' },
  ],
  mage: [
    { id: 'flame_lord', name: 'フレイムロード', description: '火属性・継続ダメージ' },
    { id: 'storm_sage', name: 'ストームセージ', description: '雷属性・複数攻撃' },
    { id: 'ice_witch', name: '氷獄術師', description: '氷属性・スロー状態異常' },
  ],
  rogue: [
    { id: 'shadow_blade', name: 'シャドウブレード', description: '単体高火力・暗殺' },
    { id: 'trickster', name: 'トリックスター', description: 'デバフ・逃走率UP' },
    { id: 'hunter', name: 'ハンター型', description: '罠設置・先制攻撃' },
  ],
};

export const BUILD_SKILLS = [
  { id: 'blood_rage', subclass: 'berserker', name: 'ブラッドレイジ', description: 'HP10%を消費して強烈な一撃を放つ。', mp_cost: 0, cooldown_turns: 3, damage_mult: 2.0, type: 'attack', self_hp_cost_pct: 10 },
  { id: 'iron_wall', subclass: 'tank', name: 'アイアンウォール', description: 'このターンの防御力を大きく高める。', mp_cost: 12, cooldown_turns: 2, damage_mult: 0, type: 'defense' },
  { id: 'reprisal', subclass: 'counter', name: 'リプライザル', description: '反撃の構えから重い一撃を返す。', mp_cost: 15, cooldown_turns: 3, damage_mult: 1.8, type: 'attack' },
  { id: 'flame_burst', subclass: 'flame_lord', name: 'フレイムバースト', description: '火属性ダメージを与える。', mp_cost: 20, cooldown_turns: 2, damage_mult: 2.4, type: 'attack' },
  { id: 'chain_lightning', subclass: 'storm_sage', name: 'チェインライトニング', description: '雷が連鎖する複数攻撃。', mp_cost: 25, cooldown_turns: 3, damage_mult: 1.1, hits: 3, type: 'attack' },
  { id: 'glacial_prison', subclass: 'ice_witch', name: '氷獄牢', description: '氷で敵を封じる強力な魔法。', mp_cost: 30, cooldown_turns: 4, damage_mult: 2.0, type: 'attack' },
  { id: 'shadow_execute', subclass: 'shadow_blade', name: 'シャドウエグゼキュート', description: '影から急所を狙う。', mp_cost: 18, cooldown_turns: 3, damage_mult: 2.3, type: 'attack' },
  { id: 'smoke_trick', subclass: 'trickster', name: 'スモークトリック', description: '煙幕で隙を作り攻撃する。', mp_cost: 14, cooldown_turns: 2, damage_mult: 1.6, type: 'attack' },
  { id: 'snare_shot', subclass: 'hunter', name: 'スネアショット', description: '罠と射撃で敵を削る。', mp_cost: 16, cooldown_turns: 2, damage_mult: 1.9, type: 'pierce' },
];

export function getSubclassChoices(playerClass) {
  return SUBCLASSES[playerClass] || [];
}

export function getSubclassSkills(subclass) {
  return BUILD_SKILLS.filter((skill) => skill.subclass === subclass);
}
