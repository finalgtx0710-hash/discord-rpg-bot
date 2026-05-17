import { BUILD_SKILLS } from './builds.js';

export const SKILLS = {
  warrior_slash:    { id: 'warrior_slash',    name: '烈火斬',         class: 'warrior', mp_cost: 12, description: '炎をまとった斬撃。ATKの1.8倍のダメージ。',           damage_mult: 1.8, unlock_level: 3,  type: 'attack' },
  warrior_guard:    { id: 'warrior_guard',    name: '鉄壁防御',       class: 'warrior', mp_cost: 10, description: '1ターン防御力を2倍にする。',                         damage_mult: 0,   unlock_level: 6,  type: 'defense' },
  warrior_berserk:  { id: 'warrior_berserk',  name: '怒涛の一撃',     class: 'warrior', mp_cost: 20, description: 'ATKの3倍の大ダメージ。自分もHPが10減る。',           damage_mult: 3.0, unlock_level: 10, type: 'attack', self_damage: 10 },
  mage_fire:        { id: 'mage_fire',        name: 'ファイアボール',  class: 'mage',    mp_cost: 15, description: '火球を放つ。ATKの2.0倍の魔法ダメージ。',             damage_mult: 2.0, unlock_level: 3,  type: 'attack' },
  mage_blizzard:    { id: 'mage_blizzard',    name: 'ブリザード',      class: 'mage',    mp_cost: 18, description: '氷の嵐でATKの2.5倍のダメージ。',                     damage_mult: 2.5, unlock_level: 6,  type: 'attack' },
  mage_meteor:      { id: 'mage_meteor',      name: 'メテオ',          class: 'mage',    mp_cost: 30, description: '隕石を召喚。ATKの4.0倍の超大ダメージ。',             damage_mult: 4.0, unlock_level: 10, type: 'attack' },
  cleric_heal:      { id: 'cleric_heal',      name: 'ヒール',          class: 'cleric',  mp_cost: 12, description: 'HPを60回復する。',                                   damage_mult: 0,   unlock_level: 3,  type: 'heal', heal_amount: 60 },
  cleric_regen:     { id: 'cleric_regen',     name: 'リジェネ',        class: 'cleric',  mp_cost: 15, description: 'HPを100回復する。',                                  damage_mult: 0,   unlock_level: 6,  type: 'heal', heal_amount: 100 },
  cleric_holy:      { id: 'cleric_holy',      name: 'ホーリーライト',  class: 'cleric',  mp_cost: 25, description: '聖なる光でATKの2.2倍のダメージ＋HP30回復。',         damage_mult: 2.2, unlock_level: 10, type: 'hybrid', heal_amount: 30 },
  rogue_steal:      { id: 'rogue_steal',      name: '盗む',            class: 'rogue',   mp_cost: 8,  description: '敵からゴールドを盗む。ATKの1.2倍のダメージ。',       damage_mult: 1.2, unlock_level: 3,  type: 'steal' },
  rogue_backstab:   { id: 'rogue_backstab',   name: '背後刺し',        class: 'rogue',   mp_cost: 15, description: '急所を突く。ATKの2.5倍のダメージ。',                 damage_mult: 2.5, unlock_level: 6,  type: 'attack' },
  rogue_shadowstep: { id: 'rogue_shadowstep', name: 'シャドウステップ', class: 'rogue',  mp_cost: 22, description: '影に潜り2回連続攻撃。ATKの1.5倍×2回。',             damage_mult: 1.5, unlock_level: 10, type: 'attack', hits: 2 },
  archer_shot:      { id: 'archer_shot',      name: '貫通矢',          class: 'archer',  mp_cost: 10, description: '防御を無視する矢。ATKの1.8倍のダメージ。',           damage_mult: 1.8, unlock_level: 3,  type: 'pierce' },
  archer_rain:      { id: 'archer_rain',      name: '矢の雨',          class: 'archer',  mp_cost: 18, description: '矢を乱射。ATKの1.2倍×3回のダメージ。',               damage_mult: 1.2, unlock_level: 6,  type: 'attack', hits: 3 },
  archer_snipe:     { id: 'archer_snipe',     name: 'スナイプ',        class: 'archer',  mp_cost: 25, description: '急所を狙い撃ち。ATKの3.5倍の大ダメージ。',           damage_mult: 3.5, unlock_level: 10, type: 'attack' },
};

export function getClassSkills(playerClass) {
  return Object.values(SKILLS).filter(s => s.class === playerClass);
}

export function getSkillById(skillId) {
  return SKILLS[skillId] || BUILD_SKILLS.find((skill) => skill.id === skillId) || null;
}

export function getLearnedSkills(player) {
  const classSkills = getClassSkills(player.class);
  const learned = classSkills.filter(s => player.level >= s.unlock_level);
  if (player.subclass) {
    learned.push(...BUILD_SKILLS.filter((skill) => skill.subclass === player.subclass));
  }
  return learned;
}
