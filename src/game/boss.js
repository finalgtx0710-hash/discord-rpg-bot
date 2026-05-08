import { calcLevelUp, calcEquippedStats } from '../data/master.js';
import { getPlayer, updatePlayer } from '../database/db.js';

export const BOSSES = {
  goblin_king: {
    id: 'goblin_king', name: '👑 ゴブリンキング',
    description: '始まりの村を長年脅かしてきたゴブリンの王。巨大な棍棒で強烈な一撃を放つ。',
    area: 'starting_village', level_req: 3,
    hp: 300, atk: 20, def: 8, spd: 6,
    rewards: { exp: 400, gold: 500, items: ['steel_sword'] },
    special_move: { name: '王の一撃', damage_mult: 2.5, chance: 0.25 },
    phases: [{ hp_threshold: 0.5, message: '👑 ゴブリンキングが激怒した！攻撃力が上がった！', atk_boost: 5 }],
  },
  forest_guardian: {
    id: 'forest_guardian', name: '🌳 森の守護者',
    description: '囁きの森の深部に棲む古の精霊。自然の力を操り冒険者を試練にかける。',
    area: 'forest_of_whispers', level_req: 8,
    hp: 600, atk: 30, def: 15, spd: 12,
    rewards: { exp: 800, gold: 1000, items: ['iron_shield', 'silver_ring'] },
    special_move: { name: '自然の怒り', damage_mult: 2.0, chance: 0.3 },
    phases: [
      { hp_threshold: 0.6, message: '🌳 森の守護者が第二形態に移行！防御力が上がった！', def_boost: 8 },
      { hp_threshold: 0.3, message: '🌳 森の守護者が最終形態に！全ステータスが上昇！', atk_boost: 8, def_boost: 5 },
    ],
  },
  ancient_overlord: {
    id: 'ancient_overlord', name: '💀 古代の覇王',
    description: '古代遺跡の最深部に封印されていた魔王。エーテル結晶消失の黒幕。',
    area: 'ancient_ruins', level_req: 15,
    hp: 1200, atk: 45, def: 25, spd: 15,
    rewards: { exp: 2000, gold: 3000, items: ['ancient_crystal', 'golem_core'] },
    special_move: { name: '魔王の裁き', damage_mult: 3.0, chance: 0.2 },
    phases: [
      { hp_threshold: 0.7, message: '💀 古代の覇王が封印を解放！攻撃力が大幅上昇！', atk_boost: 10 },
      { hp_threshold: 0.4, message: '💀 古代の覇王が闇のオーラをまとった！', atk_boost: 8, def_boost: 8 },
      { hp_threshold: 0.2, message: '💀 古代の覇王が最後の力を解放！', atk_boost: 15 },
    ],
  },
};

const activeBossBattles = new Map();

export function isInBossBattle(userId) { return activeBossBattles.has(userId); }
export function getBossBattle(userId) { return activeBossBattles.get(userId) || null; }
export function endBossBattle(userId) { activeBossBattles.delete(userId); }

export function startBossBattle(userId, bossId) {
  const boss = BOSSES[bossId];
  if (!boss) return null;
  const session = { bossId, boss: { ...boss }, currentHp: boss.hp, currentAtk: boss.atk, currentDef: boss.def, turn: 1, triggeredPhases: [] };
  activeBossBattles.set(userId, session);
  return session;
}

function calcDamage(atk, def) {
  const base = Math.max(1, atk - Math.floor(def * 0.5));
  const v = Math.floor(base * 0.2);
  return base + Math.floor(Math.random() * (v * 2 + 1)) - v;
}

export async function processBossAction(userId, action) {
  const session = activeBossBattles.get(userId);
  const player = getPlayer(userId);
  if (!session || !player) return null;

  const { boss } = session;
  const stats = calcEquippedStats(player);
  const result = { playerAction: '', bossAction: '', phaseMessages: [], battleEnd: false, victory: false, playerDied: false, rewards: null };
  let playerHp = player.hp;
  let playerMp = player.mp;

  if (action === 'attack') {
    const dmg = calcDamage(stats.atk, session.currentDef);
    session.currentHp -= dmg;
    result.playerAction = `⚔️ **${player.name}**の攻撃！ **${boss.name}**に **${dmg}** ダメージ！`;
  } else if (action === 'skill') {
    if (playerMp < 15) {
      const dmg = calcDamage(stats.atk, session.currentDef);
      session.currentHp -= dmg;
      result.playerAction = `⚔️ **${player.name}**（MP不足→通常攻撃）：**${dmg}** ダメージ！`;
    } else {
      playerMp -= 15;
      const dmg = calcDamage(Math.floor(stats.atk * 1.8), session.currentDef);
      session.currentHp -= dmg;
      result.playerAction = `✨ **${player.name}**の必殺技！ **${boss.name}**に **${dmg}** の大ダメージ！`;
      updatePlayer(userId, { mp: playerMp });
    }
  } else if (action === 'item') {
    const inv = [...(player.inventory || [])];
    const idx = inv.indexOf('potion');
    if (idx !== -1) {
      inv.splice(idx, 1);
      playerHp = Math.min(stats.max_hp, playerHp + 50);
      result.playerAction = `🧪 **ポーション**を使用！HPを **50** 回復！（現在HP: ${playerHp}）`;
      updatePlayer(userId, { hp: playerHp, inventory: inv });
    } else {
      const dmg = calcDamage(stats.atk, session.currentDef);
      session.currentHp -= dmg;
      result.playerAction = `⚔️ **${player.name}**（アイテムなし→攻撃）：**${dmg}** ダメージ！`;
    }
  }

  session.currentHp = Math.max(0, session.currentHp);

  // フェーズ移行
  const hpRatio = session.currentHp / boss.hp;
  for (const phase of boss.phases) {
    if (hpRatio <= phase.hp_threshold && !session.triggeredPhases.includes(phase.hp_threshold)) {
      session.triggeredPhases.push(phase.hp_threshold);
      result.phaseMessages.push(phase.message);
      if (phase.atk_boost) session.currentAtk += phase.atk_boost;
      if (phase.def_boost) session.currentDef += phase.def_boost;
    }
  }

  if (session.currentHp <= 0) {
    result.battleEnd = true; result.victory = true;
    const lvData = calcLevelUp({ ...player, exp: player.exp + boss.rewards.exp });
    const newInventory = [...(player.inventory || []), ...boss.rewards.items];
    updatePlayer(userId, {
      exp: lvData.exp, level: lvData.level, max_hp: lvData.max_hp, max_mp: lvData.max_mp,
      atk: lvData.atk, def: lvData.def, spd: lvData.spd,
      gold: player.gold + boss.rewards.gold, inventory: newInventory,
      ...(lvData.leveledUp ? { hp: lvData.max_hp } : {}),
    });
    result.rewards = { exp: boss.rewards.exp, gold: boss.rewards.gold, items: boss.rewards.items, levelUpMessages: lvData.messages };
    endBossBattle(userId);
    return result;
  }

  // ボスの反撃
  const isSpecial = Math.random() < boss.special_move.chance;
  const bossDmg = isSpecial
    ? Math.floor(calcDamage(session.currentAtk, stats.def) * boss.special_move.damage_mult)
    : calcDamage(session.currentAtk, stats.def);
  playerHp = Math.max(0, playerHp - bossDmg);
  result.bossAction = isSpecial
    ? `💥 **${boss.name}**の**${boss.special_move.name}**！ **${player.name}**に **${bossDmg}** の大ダメージ！（残りHP: ${playerHp}）`
    : `👾 **${boss.name}**の攻撃！ **${player.name}**に **${bossDmg}** ダメージ！（残りHP: ${playerHp}）`;

  if (playerHp <= 0) {
    result.playerDied = true; result.battleEnd = true;
    updatePlayer(userId, { hp: 1, gold: Math.floor(player.gold * 0.5) });
    endBossBattle(userId);
    return result;
  }

  updatePlayer(userId, { hp: playerHp });
  session.turn++;
  return result;
}

export function getAvailableBosses(player) {
  return Object.values(BOSSES).filter(b => b.area === player.current_area && player.level >= b.level_req);
}