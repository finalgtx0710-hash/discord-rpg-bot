// クラス固有スキル定義
export const SKILLS = {
  // 戦士スキル
  warrior_slash: {
    id: 'warrior_slash', name: '烈火斬', class: 'warrior', mp_cost: 12,
    description: '炎をまとった斬撃。ATKの1.8倍のダメージ。',
    damage_mult: 1.8, unlock_level: 3, type: 'attack',
  },
  warrior_guard: {
    id: 'warrior_guard', name: '鉄壁防御', class: 'warrior', mp_cost: 10,
    description: '1ターン防御力を2倍にする。',
    damage_mult: 0, unlock_level: 6, type: 'defense',
  },
  warrior_berserk: {
    id: 'warrior_berserk', name: '怒涛の一撃', class: 'warrior', mp_cost: 20,
    description: 'ATKの3倍の大ダメージ。自分もHPが10減る。',
    damage_mult: 3.0, unlock_level: 10, type: 'attack', self_damage: 10,
  },

  // 魔法使いスキル
  mage_fire: {
    id: 'mage_fire', name: 'ファイアボール', class: 'mage', mp_cost: 15,
    description: '火球を放つ。ATKの2.0倍の魔法ダメージ。',
    damage_mult: 2.0, unlock_level: 3, type: 'attack',
  },
  mage_blizzard: {
    id: 'mage_blizzard', name: 'ブリザード', class: 'mage', mp_cost: 18,
    description: '氷の嵐でATKの2.5倍のダメージ。敵の速度を下げる。',
    damage_mult: 2.5, unlock_level: 6, type: 'attack',
  },
  mage_meteor: {
    id: 'mage_meteor', name: 'メテオ', class: 'mage', mp_cost: 30,
    description: '隕石を召喚。ATKの4.0倍の超大ダメージ。',
    damage_mult: 4.0, unlock_level: 10, type: 'attack',
  },

  // 僧侶スキル
  cleric_heal: {
    id: 'cleric_heal', name: 'ヒール', class: 'cleric', mp_cost: 12,
    description: 'HPを60回復する。',
    damage_mult: 0, unlock_level: 3, type: 'heal', heal_amount: 60,
  },
  cleric_regen: {
    id: 'cleric_regen', name: 'リジェネ', class: 'cleric', mp_cost: 15,
    description: 'HPを100回復し、次のターンも30回復する。',
    damage_mult: 0, unlock_level: 6, type: 'heal', heal_amount: 100,
  },
  cleric_holy: {
    id: 'cleric_holy', name: 'ホーリーライト', class: 'cleric', mp_cost: 25,
    description: '聖なる光でATKの2.2倍のダメージ＋HP30回復。',
    damage_mult: 2.2, unlock_level: 10, type: 'hybrid', heal_amount: 30,
  },

  // 盗賊スキル
  rogue_steal: {
    id: 'rogue_steal', name: '盗む', class: 'rogue', mp_cost: 8,
    description: '敵からゴールドを盗む。ATKの1.2倍のダメージ＋ゴールド獲得。',
    damage_mult: 1.2, unlock_level: 3, type: 'steal',
  },
  rogue_backstab: {
    id: 'rogue_backstab', name: '背後刺し', class: 'rogue', mp_cost: 15,
    description: '急所を突く。ATKの2.5倍のダメージ。必ず先制。',
    damage_mult: 2.5, unlock_level: 6, type: 'attack',
  },
  rogue_shadowstep: {
    id: 'rogue_shadowstep', name: 'シャドウステップ', class: 'rogue', mp_cost: 22,
    description: '影に潜り2回連続攻撃。ATKの1.5倍×2回。',
    damage_mult: 1.5, hits: 2, unlock_level: 10, type: 'attack',
  },

  // 弓使いスキル
  archer_shot: {
    id: 'archer_shot', name: '貫通矢', class: 'archer', mp_cost: 10,
    description: '防御を無視する矢。ATKの1.8倍のダメージ。',
    damage_mult: 1.8, unlock_level: 3, type: 'pierce',
  },
  archer_rain: {
    id: 'archer_rain', name: '矢の雨', class: 'archer', mp_cost: 18,
    description: '矢を乱射。ATKの1.2倍×3回のダメージ。',
    damage_mult: 1.2, hits: 3, unlock_level: 6, type: 'attack',
  },
  archer_snipe: {
    id: 'archer_snipe', name: 'スナイプ', class: 'archer', mp_cost: 25,
    description: '急所を狙い撃ち。ATKの3.5倍の大ダメージ。',
    damage_mult: 3.5, unlock_level: 10, type: 'attack',
  },
};

// クラス別スキル一覧
export function getClassSkills(playerClass) {
  return Object.values(SKILLS).filter(s => s.class === playerClass);
}

// 習得済みスキル一覧
export function getLearnedSkills(player) {
  const classSkills = getClassSkills(player.class);
  return classSkills.filter(s => player.level >= s.unlock_level);
}

// スキル使用処理
export function useSkill(player, skillId, enemy, enemyDef) {
  const skill = SKILLS[skillId];
  if (!skill) return null;
  if (player.mp < skill.mp_cost) return { ok: false, message: `MPが足りません！（必要MP: ${skill.mp_cost}）` };

  const { calcEquippedStats } = require('../data/master.js');
  const stats = calcEquippedStats ? calcEquippedStats(player) : player;
  const atk = stats.atk || player.atk;

  let totalDamage = 0;
  let healAmount = 0;
  let log = '';
  const hits = skill.hits || 1;

  if (skill.type === 'heal') {
    healAmount = skill.heal_amount || 60;
    log = `✨ **${skill.name}**！HPを **${healAmount}** 回復！`;
  } else if (skill.type === 'defense') {
    log = `🛡️ **${skill.name}**！防御力が大幅上昇！`;
  } else {
    for (let i = 0; i < hits; i++) {
      const base = Math.max(1, Math.floor(atk * skill.damage_mult) - (skill.type === 'pierce' ? 0 : Math.floor(enemyDef * 0.5)));
      const variance = Math.floor(base * 0.1);
      const dmg = base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
      totalDamage += dmg;
    }
    if (skill.type === 'hybrid') healAmount = skill.heal_amount || 0;
    log = hits > 1
      ? `⚔️ **${skill.name}**！${hits}回攻撃で合計 **${totalDamage}** ダメージ！`
      : `✨ **${skill.name}**！**${totalDamage}** ダメージ！`;
    if (healAmount > 0) log += ` HP **${healAmount}** 回復！`;
    if (skill.self_damage) log += ` 自分に **${skill.self_damage}** ダメージ！`;
  }

  return {
    ok: true,
    skill,
    totalDamage,
    healAmount,
    selfDamage: skill.self_damage || 0,
    log,
    mpCost: skill.mp_cost,
  };
}