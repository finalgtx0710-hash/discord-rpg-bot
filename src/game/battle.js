// src/game/battle.js
import { ENEMIES, ITEMS, calcLevelUp, calcEquippedStats } from '../data/master.js';
import { updateAchievementStats, checkAchievements } from './achievements.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { updateQuestProgress, checkQuestCompletion } from './quest.js';

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

export function isInBattle(userId) { return activeBattles.has(userId); }
export function endBattle(userId) { activeBattles.delete(userId); }

export function getBattleStatus(userId) {
  return activeBattles.get(userId) || null;
}

export async function processBattleAction(userId, action) {
  const battle = activeBattles.get(userId);
  const player = getPlayer(userId);
  if (!battle || !player) return null;

  const { enemy } = battle;
  const stats = calcEquippedStats(player);
  const result = {
    playerAction: '', enemyAction: '',
    battleEnd: false, victory: false, rewards: null, playerDied: false,
  };

  let playerHp = player.hp;
  let playerMp = player.mp;

  if (action === 'attack') {
    const dmg = calcDamage(stats.atk, enemy.def);
    enemy.currentHp -= dmg;
    result.playerAction = `⚔️ **${player.name}**の攻撃！ **${enemy.name}**に **${dmg}** ダメージ！`;

  } else if (action === 'skill') {
    if (playerMp < 10) {
      result.playerAction = `💧 MPが足りない！（必要MP: 10）`;
    } else {
      playerMp -= 10;
      const dmg = calcDamage(Math.floor(stats.atk * 1.6), enemy.def);
      enemy.currentHp -= dmg;
      result.playerAction = `✨ **${player.name}**のスキル発動！ **${enemy.name}**に **${dmg}** の大ダメージ！`;
    }

  } else if (action === 'item') {
    const inventory = [...(player.inventory || [])];
    const potionIdx = inventory.indexOf('potion');
    const mpPotionIdx = inventory.indexOf('mp_potion');
    if (potionIdx !== -1) {
      inventory.splice(potionIdx, 1);
      const heal = 50;
      playerHp = Math.min(player.max_hp, playerHp + heal);
      result.playerAction = `🧪 **ポーション**を使用！HPを **${heal}** 回復！（現在HP: ${playerHp}）`;
      updatePlayer(userId, { hp: playerHp, inventory });
    } else if (mpPotionIdx !== -1) {
      inventory.splice(mpPotionIdx, 1);
      const heal = 30;
      playerMp = Math.min(player.max_mp, playerMp + heal);
      result.playerAction = `💙 **MPポーション**を使用！MPを **${heal}** 回復！（現在MP: ${playerMp}）`;
      updatePlayer(userId, { mp: playerMp, inventory });
    } else {
      result.playerAction = `🎒 使えるアイテムがない！`;
    }

  } else if (action === 'escape') {
    const rate = calcEscapeRate(player.spd, enemy.spd);
    if (Math.random() < rate) {
      result.playerAction = `💨 **${player.name}**は逃げ出した！`;
      result.battleEnd = true;
      result.victory = false;
      endBattle(userId);
      return result;
    } else {
      result.playerAction = `❌ 逃げられなかった！`;
    }
  }

  // 敵撃破判定
  if (enemy.currentHp <= 0) {
    result.battleEnd = true;
    result.victory = true;

    const [minGold, maxGold] = enemy.gold;
    const goldEarned = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
    const droppedItems = [];
    for (const drop of (enemy.drops || [])) {
      if (Math.random() < drop.rate) droppedItems.push(drop.item);
    }

    const newExp = player.exp + enemy.exp;
    const lvData = calcLevelUp({ ...player, exp: newExp });

    // クエスト進捗更新
    const freshPlayer = getPlayer(userId);
    const { quests: updatedQuests } = updateQuestProgress(freshPlayer, 'kill', enemy.key);
    const { quests: finalQuests, completed: completedQuests } = checkQuestCompletion({ ...freshPlayer, quests: updatedQuests });
    let bonusExp = 0, bonusGold = 0;
    const bonusItems = [];
    for (const { quest } of completedQuests) {
      bonusExp  += quest.rewards.exp;
      bonusGold += quest.rewards.gold;
      bonusItems.push(...quest.rewards.items);
    }

    // 実績更新
    const achPlayer = getPlayer(userId);
    const updatedAch = updateAchievementStats(achPlayer, { battles: 1, gold: goldEarned + bonusGold });
    const { achievements: finalAch, newlyUnlocked } = checkAchievements({ ...achPlayer, achievements: updatedAch });
    const newInventory = [...(player.inventory || []), ...droppedItems, ...bonusItems];
    updatePlayer(userId, {
      hp: playerHp,
      mp: playerMp,
      gold: player.gold + goldEarned + bonusGold,
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
      gold: goldEarned,
      items: droppedItems,
      levelUpMessages: lvData.messages,
      completedQuests,
      newAchievements: newlyUnlocked,
      bonusExp,
      bonusGold,
      bonusItems,
    };
    endBattle(userId);
    return result;
  }

  // 敵の反撃
  const enemyDmg = calcDamage(enemy.atk, stats.def);
  playerHp = Math.max(0, playerHp - enemyDmg);
  result.enemyAction = `👾 **${enemy.name}**の攻撃！ **${player.name}**に **${enemyDmg}** ダメージ！（残りHP: ${playerHp}）`;

  if (playerHp <= 0) {
    result.playerDied = true;
    result.battleEnd = true;
    updatePlayer(userId, { hp: 1, gold: Math.floor(player.gold * 0.5) });
    endBattle(userId);
    return result;
  }

  updatePlayer(userId, { hp: playerHp, mp: playerMp });
  battle.turn++;
  return result;
}