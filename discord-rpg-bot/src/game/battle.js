// src/game/battle.js
// ターン制戦闘システム

import { ENEMIES, ITEMS, calcLevelUp, calcEquippedStats } from '../data/master.js';
import { updateQuestProgress, checkQuestCompletion } from './quest.js';
import { getPlayer, updatePlayer } from '../database/db.js';

// 戦闘中のセッション管理（メモリ上）
const activeBattles = new Map();

// ダメージ計算（±20%のブレ）
function calcDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.5));
  const variance = Math.floor(base * 0.2);
  return base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
}

// 逃走判定（速度差で確率変動）
function calcEscapeRate(playerSpd, enemySpd) {
  const diff = playerSpd - enemySpd;
  return Math.min(0.9, Math.max(0.2, 0.5 + diff * 0.03));
}

// 戦闘開始
export function startBattle(userId, enemyKey) {
  const enemyTemplate = ENEMIES[enemyKey];
  if (!enemyTemplate) return null;

  const enemy = {
    ...enemyTemplate,
    currentHp: enemyTemplate.hp,
    key: enemyKey,
  };

  activeBattles.set(userId, { enemy, turn: 1 });
  return enemy;
}

// 戦闘中か確認
export function isInBattle(userId) {
  return activeBattles.has(userId);
}

// 戦闘終了・クリア
export function endBattle(userId) {
  activeBattles.delete(userId);
}

// 戦闘アクション処理
export async function processBattleAction(userId, action) {
  const battle = activeBattles.get(userId);
  const player = getPlayer(userId);
  if (!battle || !player) return null;

  const { enemy } = battle;
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

  // ===== プレイヤーの行動 =====
  if (action === 'attack') {
    const stats = calcEquippedStats(player);
    const dmg = calcDamage(stats.atk, enemy.def);
    enemy.currentHp -= dmg;
    result.playerAction = `⚔️ **${player.name}**の攻撃！ **${enemy.name}**に **${dmg}** ダメージ！`;

  } else if (action === 'skill') {
    const statsS = calcEquippedStats(player);
    if (playerMp < 10) {
      result.playerAction = `💧 MPが足りない！（必要MP: 10）`;
    } else {
      playerMp -= 10;
      const dmg = calcDamage(Math.floor(statsS.atk * 1.6), enemy.def);
      enemy.currentHp -= dmg;
      result.playerAction = `✨ **${player.name}**のスキル発動！ **${enemy.name}**に **${dmg}** の大ダメージ！`;
    }

  } else if (action === 'item') {
    const inventory = JSON.parse(typeof player.inventory === 'string' ? player.inventory : JSON.stringify(player.inventory));
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

  // ===== 敵の撃破判定 =====
  if (enemy.currentHp <= 0) {
    result.battleEnd = true;
    result.victory = true;

    // 報酬計算
    const [minGold, maxGold] = enemy.gold;
    const goldEarned = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
    const droppedItems = [];
    for (const drop of (enemy.drops || [])) {
      if (Math.random() < drop.rate) droppedItems.push(drop.item);
    }

    // レベルアップ計算
    const newExp = player.exp + enemy.exp;
    const lvData = calcLevelUp({ ...player, exp: newExp });

    // クエスト進捗更新
    const freshPlayer = getPlayer(userId);
    const { quests: updatedQuests, updates: qUpdates } = updateQuestProgress(freshPlayer, 'kill', enemyKey);
    const { quests: finalQuests, completed: completedQuests } = checkQuestCompletion({ ...freshPlayer, quests: updatedQuests });
    // クエスト報酬を加算
    let bonusExp = 0, bonusGold = 0;
    const bonusItems = [];
    for (const { quest } of completedQuests) {
      bonusExp  += quest.rewards.exp;
      bonusGold += quest.rewards.gold;
      bonusItems.push(...quest.rewards.items);
    }

    const newInventory = [...(player.inventory || []), ...droppedItems, ...bonusItems];
    updatePlayer(userId, {
      hp: playerHp,
      mp: playerMp,
      gold: player.gold + goldEarned,
      exp: lvData.exp,
      level: lvData.level,
      max_hp: lvData.max_hp,
      max_mp: lvData.max_mp,
      atk: lvData.atk,
      def: lvData.def,
      spd: lvData.spd,
      inventory: newInventory,
      quests: finalQuests,
      gold: player.gold + goldEarned + bonusGold,
      exp: lvData.exp,
      ...(lvData.leveledUp ? { hp: lvData.max_hp } : {}),
    });

    result.rewards = {
      exp: enemy.exp,
      gold: goldEarned,
      items: droppedItems,
      levelUpMessages: lvData.messages,
      completedQuests,
      bonusExp,
      bonusGold,
      bonusItems,
    };
    endBattle(userId);
    return result;
  }

  // ===== 敵の行動 =====
  // 体力が20%以下なら回復（僧侶系敵のみ。今回は簡易実装）
  const enemyHpRatio = enemy.currentHp / enemy.hp;
  const defStats = calcEquippedStats(player);
  const enemyDmg = calcDamage(enemy.atk, defStats.def);
  playerHp = Math.max(0, playerHp - enemyDmg);
  result.enemyAction = `👾 **${enemy.name}**の攻撃！ **${player.name}**に **${enemyDmg}** ダメージ！（残りHP: ${playerHp}）`;

  // プレイヤー死亡判定
  if (playerHp <= 0) {
    result.playerDied = true;
    result.battleEnd = true;
    // 死亡時はHP1・Gold半減で生き返り
    updatePlayer(userId, {
      hp: 1,
      gold: Math.floor(player.gold * 0.5),
    });
    endBattle(userId);
    return result;
  }

  // 生き残り → HPとMP更新
  updatePlayer(userId, { hp: playerHp, mp: playerMp });
  battle.turn++;

  return result;
}

// 現在の戦闘状態
export function getBattleStatus(userId) {
  return activeBattles.get(userId) || null;
}
