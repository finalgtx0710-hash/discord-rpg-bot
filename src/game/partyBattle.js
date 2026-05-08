// src/game/partyBattle.js
// パーティ共同探索・ボス戦システム

import { ENEMIES, AREAS, ITEMS, calcLevelUp } from '../data/master.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { getParty } from './party.js';

// パーティ戦闘セッション管理
// { partyId: { enemy, memberActions: {userId: action}, turn, messageId, channelId } }
const partyBattles = new Map();

// ボスのスケーリング（メンバー数に応じてHP・攻撃が増加）
function scaleEnemy(enemyTemplate, memberCount) {
  const scale = 1 + (memberCount - 1) * 0.6;
  return {
    ...enemyTemplate,
    hp:  Math.floor(enemyTemplate.hp  * scale),
    atk: Math.floor(enemyTemplate.atk * (1 + (memberCount - 1) * 0.2)),
    def: Math.floor(enemyTemplate.def * (1 + (memberCount - 1) * 0.1)),
    currentHp: Math.floor(enemyTemplate.hp * scale),
  };
}

// ダメージ計算（±20%ブレ）
function calcDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.5));
  const variance = Math.floor(base * 0.2);
  return base + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
}

// パーティ戦闘を開始
export function startPartyBattle(partyId, enemyKey, memberCount) {
  const template = ENEMIES[enemyKey];
  if (!template) return null;
  const enemy = scaleEnemy(template, memberCount);
  enemy.key = enemyKey;

  partyBattles.set(partyId, {
    enemy,
    memberActions: {},
    turn: 1,
    log: [],
  });
  return enemy;
}

export function isInPartyBattle(partyId) {
  return partyBattles.has(partyId);
}

export function getPartyBattle(partyId) {
  return partyBattles.get(partyId) || null;
}

export function endPartyBattle(partyId) {
  partyBattles.delete(partyId);
}

// メンバーのアクションを登録
export function registerAction(partyId, userId, action) {
  const battle = partyBattles.get(partyId);
  if (!battle) return false;
  battle.memberActions[userId] = action;
  return true;
}

// 全員のアクションが揃ったか確認
export function allActionsReady(partyId, members) {
  const battle = partyBattles.get(partyId);
  if (!battle) return false;
  return members.every(uid => battle.memberActions[uid]);
}

// パーティターン処理（全員のアクション確定後に呼ぶ）
export function processPartyTurn(partyId) {
  const battle = partyBattles.get(partyId);
  if (!battle) return null;

  const { enemy, memberActions } = battle;
  const logs = [];
  let totalDamageToEnemy = 0;
  const healedMembers = {};

  // ===== 各メンバーのアクションを処理 =====
  for (const [uid, action] of Object.entries(memberActions)) {
    const player = getPlayer(uid);
    if (!player || player.hp <= 0) continue;

    if (action === 'attack') {
      const dmg = calcDamage(player.atk, enemy.def);
      totalDamageToEnemy += dmg;
      logs.push(`⚔️ **${player.name}**の攻撃： **${dmg}** ダメージ`);

    } else if (action === 'skill') {
      if (player.mp >= 10) {
        const dmg = calcDamage(Math.floor(player.atk * 1.6), enemy.def);
        totalDamageToEnemy += dmg;
        updatePlayer(uid, { mp: player.mp - 10 });
        logs.push(`✨ **${player.name}**のスキル： **${dmg}** の大ダメージ！`);
      } else {
        // MPなし → 通常攻撃に切り替え
        const dmg = calcDamage(player.atk, enemy.def);
        totalDamageToEnemy += dmg;
        logs.push(`⚔️ **${player.name}**（MP不足→通常攻撃）： **${dmg}** ダメージ`);
      }

    } else if (action === 'item') {
      const inv = [...(player.inventory || [])];
      const potionIdx = inv.indexOf('potion');
      if (potionIdx !== -1) {
        inv.splice(potionIdx, 1);
        const heal = Math.min(50, player.max_hp - player.hp);
        healedMembers[uid] = heal;
        updatePlayer(uid, { inventory: inv });
        logs.push(`🧪 **${player.name}**がポーションを使用！HP +${heal}`);
      } else {
        // アイテムなし → 攻撃
        const dmg = calcDamage(player.atk, enemy.def);
        totalDamageToEnemy += dmg;
        logs.push(`⚔️ **${player.name}**（アイテムなし→攻撃）： **${dmg}** ダメージ`);
      }
    }
    // escape は個別に処理しない（パーティ戦では無効）
  }

  // 敵にダメージ適用
  enemy.currentHp = Math.max(0, enemy.currentHp - totalDamageToEnemy);
  logs.push(`\n💥 合計ダメージ: **${totalDamageToEnemy}** → 敵HP: **${enemy.currentHp}/${enemy.hp}**`);

  // ===== 敵撃破判定 =====
  if (enemy.currentHp <= 0) {
    const rewards = distributeRewards(partyId, enemy);
    endPartyBattle(partyId);
    return { victory: true, logs, rewards };
  }

  // ===== 敵の反撃（全メンバーにランダムでダメージ）=====
  logs.push('');
  const members = Object.keys(memberActions);
  const deadMembers = [];

  for (const uid of members) {
    const player = getPlayer(uid);
    if (!player || player.hp <= 0) continue;

    // 回復していたメンバーにも攻撃が来る
    const dmg = calcDamage(enemy.atk, player.def);
    const newHp = Math.max(0, player.hp + (healedMembers[uid] || 0) - dmg);
    updatePlayer(uid, { hp: newHp });

    if (newHp <= 0) {
      deadMembers.push(uid);
      logs.push(`👾 **${enemy.name}**の攻撃 → **${player.name}**に **${dmg}** ダメージ… 💀 戦闘不能！`);
      updatePlayer(uid, { hp: 1, gold: Math.floor(player.gold * 0.5) });
    } else {
      logs.push(`👾 **${enemy.name}**の攻撃 → **${player.name}**に **${dmg}** ダメージ（残りHP: ${newHp}）`);
    }
  }

  // 全員戦闘不能
  const allDead = members.every(uid => {
    const p = getPlayer(uid);
    return !p || p.hp <= 1;
  });

  // アクションをリセット
  battle.memberActions = {};
  battle.turn++;

  if (allDead) {
    endPartyBattle(partyId);
    return { victory: false, allDead: true, logs };
  }

  return { victory: false, allDead: false, logs, enemy };
}

// 報酬の分配
function distributeRewards(partyId, enemy) {
  const party = getParty(Object.keys(partyBattles.get(partyId)?.memberActions || {})[0]);
  // partyIdから直接メンバーを取得できないのでenemy keyから取る
  const battle = partyBattles.get(partyId);
  const memberIds = battle ? Object.keys(battle.memberActions) : [];

  const [minGold, maxGold] = enemy.gold;
  const totalGold = minGold + Math.floor(Math.random() * (maxGold - minGold + 1));
  const goldPerMember = Math.floor(totalGold / Math.max(memberIds.length, 1));

  const droppedItems = [];
  for (const drop of (enemy.drops || [])) {
    if (Math.random() < drop.rate) droppedItems.push(drop.item);
  }

  const memberRewards = [];
  for (const uid of memberIds) {
    const player = getPlayer(uid);
    if (!player) continue;

    const newExp = player.exp + enemy.exp;
    const lvData = calcLevelUp({ ...player, exp: newExp });
    const newInventory = [...(player.inventory || []), ...droppedItems];

    updatePlayer(uid, {
      gold: player.gold + goldPerMember,
      exp: lvData.exp,
      level: lvData.level,
      max_hp: lvData.max_hp,
      max_mp: lvData.max_mp,
      atk: lvData.atk,
      def: lvData.def,
      spd: lvData.spd,
      inventory: newInventory,
      ...(lvData.leveledUp ? { hp: lvData.max_hp } : {}),
    });

    memberRewards.push({
      name: player.name,
      exp: enemy.exp,
      gold: goldPerMember,
      levelUpMessages: lvData.messages,
    });
  }

  return { memberRewards, items: droppedItems };
}
