// src/game/battle.js
import { ENEMIES, calcLevelUp, calcEquippedStats } from '../data/master.js';
import { updateAchievementStats, checkAchievements } from './achievements.js';
import { getPlayer, updatePlayer, dbCreateEquipment, dbGetEquipmentByOwner } from '../database/db.js';
import { updateQuestProgress, checkQuestCompletion } from './quest.js';
import { getLearnedSkills, getSkillById } from './skills.js';
import { generateEquipment } from './loot.js';

const activeBattles = new Map();

function calcDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.5));
  const variance = Math.floor(base * 0.2);
  return base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
}

function calcEscapeRate(playerSpd, enemySpd) {
  const diff = playerSpd - enemySpd;
  return Math.min(0.9, Math.max(0.2, 0.5 + diff * 0.03));
}

export function startBattle(userId, enemyKey) {
  const enemyTemplate = ENEMIES[enemyKey];
  if (!enemyTemplate) return null;
  const enemy = { ...enemyTemplate, currentHp: enemyTemplate.hp, key: enemyKey };
  activeBattles.set(userId, { enemy, turn: 1 });
  return enemy;
}

export function isInBattle(userId) {
  return activeBattles.has(userId);
}

export function endBattle(userId) {
  activeBattles.delete(userId);
}

export function getBattleStatus(userId) {
  return activeBattles.get(userId) || null;
}

function applySkill({ skill, player, stats, enemy, playerHp }) {
  const lines = [`✨ **${player.name}** は **${skill.name}** を発動！`];
  let nextHp = playerHp;
  let goldDelta = 0;
  let defenseMultiplier = 1;

  if (skill.type === 'defense') {
    defenseMultiplier = 2;
    lines.push('このターン、受けるダメージを大きく抑えます。');
  }

  if (skill.type === 'heal' || skill.type === 'hybrid') {
    const heal = skill.heal_amount || 0;
    nextHp = Math.min(player.max_hp, nextHp + heal);
    lines.push(`HPを **${heal}** 回復。（HP: ${nextHp}/${player.max_hp}）`);
  }

  if (skill.type === 'steal') {
    goldDelta = 10 + Math.floor(Math.random() * 16);
    lines.push(`**${goldDelta}G** を盗んだ！`);
  }

  if (skill.damage_mult > 0) {
    const hits = skill.hits || 1;
    let totalDmg = 0;
    for (let i = 0; i < hits; i++) {
      const targetDef = skill.type === 'pierce' ? 0 : enemy.def;
      totalDmg += calcDamage(Math.floor(stats.atk * skill.damage_mult), targetDef);
    }
    enemy.currentHp -= totalDmg;
    lines.push(`**${enemy.name}** に **${totalDmg}** ダメージ！${hits > 1 ? `（${hits}ヒット）` : ''}`);
  }

  if (skill.self_damage) {
    nextHp = Math.max(1, nextHp - skill.self_damage);
    lines.push(`反動でHPを **${skill.self_damage}** 失った。（HP: ${nextHp}/${player.max_hp}）`);
  }

  if (skill.self_hp_cost_pct) {
    const cost = Math.max(1, Math.floor(player.max_hp * (skill.self_hp_cost_pct / 100)));
    nextHp = Math.max(1, nextHp - cost);
    lines.push(`反動でHPを **${cost}** 消費した。（HP: ${nextHp}/${player.max_hp}）`);
  }

  return { message: lines.join('\n'), playerHp: nextHp, goldDelta, defenseMultiplier };
}

export async function processBattleAction(userId, action) {
  const battle = activeBattles.get(userId);
  const player = getPlayer(userId);
  if (!battle || !player) return null;

  const { enemy } = battle;
  const stats = calcEquippedStats(player, dbGetEquipmentByOwner(userId));
  const result = {
    playerAction: '',
    enemyAction: '',
    battleEnd: false,
    victory: false,
    rewards: null,
    playerDied: false,
  };

  let playerHp = player.hp;
  let playerMp = player.mp;
  let goldDelta = 0;
  let defenseMultiplier = 1;

  if (action === 'attack') {
    const dmg = calcDamage(stats.atk, enemy.def);
    enemy.currentHp -= dmg;
    result.playerAction = `⚔️ **${player.name}** の攻撃！ **${enemy.name}** に **${dmg}** ダメージ！`;
  } else if (action.startsWith('skill:')) {
    const skillId = action.slice('skill:'.length);
    const skill = getSkillById(skillId);
    const learned = getLearnedSkills(player).some(s => s.id === skillId);

    if (!skill || !learned) {
      result.playerAction = '⚠️ そのスキルはまだ使用できません。';
    } else if (playerMp < skill.mp_cost) {
      result.playerAction = `💧 MPが足りません。（必要MP: ${skill.mp_cost} / 現在MP: ${playerMp}）`;
    } else {
      playerMp -= skill.mp_cost;
      const applied = applySkill({ skill, player, stats, enemy, playerHp });
      playerHp = applied.playerHp;
      goldDelta = applied.goldDelta;
      defenseMultiplier = applied.defenseMultiplier;
      result.playerAction = applied.message;
    }
  } else if (action === 'item') {
    const inventory = [...(player.inventory || [])];
    const potionIdx = inventory.indexOf('potion');
    const mpPotionIdx = inventory.indexOf('mp_potion');
    if (potionIdx !== -1) {
      inventory.splice(potionIdx, 1);
      const heal = 50;
      playerHp = Math.min(player.max_hp, playerHp + heal);
      result.playerAction = `🧪 **ポーション**を使用！ HPを **${heal}** 回復。（HP: ${playerHp}/${player.max_hp}）`;
      updatePlayer(userId, { hp: playerHp, inventory });
    } else if (mpPotionIdx !== -1) {
      inventory.splice(mpPotionIdx, 1);
      const heal = 30;
      playerMp = Math.min(player.max_mp, playerMp + heal);
      result.playerAction = `💧 **MPポーション**を使用！ MPを **${heal}** 回復。（MP: ${playerMp}/${player.max_mp}）`;
      updatePlayer(userId, { mp: playerMp, inventory });
    } else {
      result.playerAction = '🎒 使えるアイテムがありません。';
    }
  } else if (action === 'escape') {
    const rate = calcEscapeRate(player.spd, enemy.spd);
    if (Math.random() < rate) {
      result.playerAction = `💨 **${player.name}** は逃げ出した！`;
      result.battleEnd = true;
      result.victory = false;
      endBattle(userId);
      return result;
    }
    result.playerAction = '❌ 逃げられなかった！';
  }

  if (enemy.currentHp <= 0) {
    result.battleEnd = true;
    result.victory = true;

    const [minGold, maxGold] = enemy.gold;
    const goldEarned = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
    const droppedItems = [];
    for (const drop of (enemy.drops || [])) {
      if (Math.random() < drop.rate) droppedItems.push(drop.item);
    }
    const droppedEquipment = Math.random() < 0.2 ? dbCreateEquipment(generateEquipment(userId)) : null;

    const newExp = player.exp + enemy.exp;
    const lvData = calcLevelUp({ ...player, exp: newExp });

    const freshPlayer = getPlayer(userId);
    const { quests: updatedQuests } = updateQuestProgress(freshPlayer, 'kill', enemy.key);
    const { quests: finalQuests, completed: completedQuests } = checkQuestCompletion({ ...freshPlayer, quests: updatedQuests });
    let bonusExp = 0;
    let bonusGold = 0;
    const bonusItems = [];
    for (const { quest } of completedQuests) {
      bonusExp += quest.rewards.exp;
      bonusGold += quest.rewards.gold;
      bonusItems.push(...quest.rewards.items);
    }

    const achPlayer = getPlayer(userId);
    const updatedAch = updateAchievementStats(achPlayer, { battles: 1, gold: goldEarned + bonusGold + goldDelta });
    const { achievements: finalAch, newlyUnlocked } = checkAchievements({ ...achPlayer, achievements: updatedAch });
    const newInventory = [...(player.inventory || []), ...droppedItems, ...bonusItems];

    updatePlayer(userId, {
      hp: playerHp,
      mp: playerMp,
      gold: player.gold + goldEarned + bonusGold + goldDelta,
      exp: lvData.exp,
      level: lvData.level,
      max_hp: lvData.max_hp,
      max_mp: lvData.max_mp,
      atk: lvData.atk,
      def: lvData.def,
      spd: lvData.spd,
      inventory: newInventory,
      quests: finalQuests,
      achievements: finalAch,
      ...(lvData.leveledUp ? { hp: lvData.max_hp } : {}),
    });

    result.rewards = {
      exp: enemy.exp,
      gold: goldEarned + goldDelta,
      items: droppedItems,
      levelUpMessages: lvData.messages,
      completedQuests,
      newAchievements: newlyUnlocked,
      bonusExp,
      bonusGold,
      bonusItems,
      equipment: droppedEquipment,
    };
    endBattle(userId);
    return result;
  }

  const enemyDmg = calcDamage(enemy.atk, Math.floor(stats.def * defenseMultiplier));
  playerHp = Math.max(0, playerHp - enemyDmg);
  result.enemyAction = `👹 **${enemy.name}** の攻撃！ **${player.name}** に **${enemyDmg}** ダメージ！（HP: ${playerHp}/${player.max_hp}）`;

  if (playerHp <= 0) {
    result.playerDied = true;
    result.battleEnd = true;
    updatePlayer(userId, { hp: 1, gold: Math.floor(player.gold * 0.5) });
    endBattle(userId);
    return result;
  }

  updatePlayer(userId, { hp: playerHp, mp: playerMp, ...(goldDelta ? { gold: player.gold + goldDelta } : {}) });
  battle.turn++;
  return result;
}
