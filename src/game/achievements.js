// src/game/achievements.js
// 実績・称号システム

export const ACHIEVEMENTS = {
  // 探索系
  first_battle:    { id: 'first_battle',    name: '初陣',         emoji: '⚔️',  description: '初めて戦闘した',              condition: { type: 'battles', value: 1 } },
  battle_10:       { id: 'battle_10',       name: '戦士見習い',   emoji: '🗡️',  description: '10回戦闘した',               condition: { type: 'battles', value: 10 } },
  battle_50:       { id: 'battle_50',       name: '歴戦の勇者',   emoji: '🏅',  description: '50回戦闘した',               condition: { type: 'battles', value: 50 } },
  battle_100:      { id: 'battle_100',      name: '百戦錬磨',     emoji: '🏆',  description: '100回戦闘した',              condition: { type: 'battles', value: 100 } },

  // レベル系
  level_5:         { id: 'level_5',         name: '冒険者',       emoji: '🌱',  description: 'Lv.5に到達した',            condition: { type: 'level', value: 5 } },
  level_10:        { id: 'level_10',        name: '熟練冒険者',   emoji: '🌿',  description: 'Lv.10に到達した',           condition: { type: 'level', value: 10 } },
  level_20:        { id: 'level_20',        name: '英雄',         emoji: '🌟',  description: 'Lv.20に到達した',           condition: { type: 'level', value: 20 } },
  level_30:        { id: 'level_30',        name: '伝説の勇者',   emoji: '👑',  description: 'Lv.30に到達した',           condition: { type: 'level', value: 30 } },

  // ゴールド系
  gold_1000:       { id: 'gold_1000',       name: '商売上手',     emoji: '💰',  description: '累計1000G獲得した',         condition: { type: 'total_gold', value: 1000 } },
  gold_10000:      { id: 'gold_10000',      name: '大富豪',       emoji: '💎',  description: '累計10000G獲得した',        condition: { type: 'total_gold', value: 10000 } },

  // クエスト系
  quest_1:         { id: 'quest_1',         name: '依頼達成',     emoji: '📜',  description: 'クエストを1個完了した',     condition: { type: 'quests', value: 1 } },
  quest_5:         { id: 'quest_5',         name: '頼れる冒険者', emoji: '📋',  description: 'クエストを5個完了した',     condition: { type: 'quests', value: 5 } },
  quest_all:       { id: 'quest_all',       name: 'クエストマスター', emoji: '🎯', description: '全クエストを完了した',   condition: { type: 'quests', value: 8 } },

  // ボス系
  boss_1:          { id: 'boss_1',          name: 'ボスキラー',   emoji: '👹',  description: 'ボスを1体討伐した',        condition: { type: 'bosses', value: 1 } },
  boss_all:        { id: 'boss_all',        name: '覇者',         emoji: '🔱',  description: '全ボスを討伐した',          condition: { type: 'bosses', value: 3 } },

  // エリア系
  area_forest:     { id: 'area_forest',     name: '森の探索者',   emoji: '🌲',  description: '囁きの森に到達した',        condition: { type: 'area', value: 'forest_of_whispers' } },
  area_ruins:      { id: 'area_ruins',      name: '遺跡の調査員', emoji: '🏛️',  description: '古代遺跡に到達した',        condition: { type: 'area', value: 'ancient_ruins' } },
  area_cavern:     { id: 'area_cavern',     name: '洞窟探検家',   emoji: '💎',  description: '水晶洞窟に到達した',        condition: { type: 'area', value: 'crystal_cavern' } },
  area_sanctuary:  { id: 'area_sanctuary',  name: '聖域の訪問者', emoji: '🌌',  description: 'エーテルの聖域に到達した',  condition: { type: 'area', value: 'ether_sanctuary' } },

  // 特別系
  classchange:     { id: 'classchange',     name: '転職者',       emoji: '⚔️',  description: 'クラスチェンジした',        condition: { type: 'classchange', value: 1 } },
  party_member:    { id: 'party_member',    name: '仲間思い',     emoji: '👥',  description: 'パーティを組んだ',          condition: { type: 'party', value: 1 } },
  story_complete:  { id: 'story_complete',  name: '英雄の証',     emoji: '📖',  description: '全ストーリーを読了した',    condition: { type: 'story', value: 4 } },
};

// 実績チェック
export function checkAchievements(player, context = {}) {
  const achievements = player.achievements || { unlocked: [], total_battles: 0, total_gold: 0, total_bosses: 0 };
  const newlyUnlocked = [];

  for (const ach of Object.values(ACHIEVEMENTS)) {
    if (achievements.unlocked.includes(ach.id)) continue;

    const { type, value } = ach.condition;
    let unlocked = false;

    if (type === 'battles')    unlocked = (achievements.total_battles || 0) >= value;
    if (type === 'level')      unlocked = player.level >= value;
    if (type === 'total_gold') unlocked = (achievements.total_gold || 0) >= value;
    if (type === 'quests')     unlocked = (player.quests?.completed?.length || 0) >= value;
    if (type === 'bosses')     unlocked = (achievements.total_bosses || 0) >= value;
    if (type === 'area')       unlocked = context.area === value || player.current_area === value;
    if (type === 'classchange') unlocked = context.classchange === true;
    if (type === 'party')      unlocked = context.party === true;
    if (type === 'story')      unlocked = (player.story?.completed_chapters?.length || 0) >= value;

    if (unlocked) {
      achievements.unlocked.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }

  return { achievements, newlyUnlocked };
}

// 実績更新（戦闘・ゴールド加算時に呼ぶ）
export function updateAchievementStats(player, { battles = 0, gold = 0, bosses = 0 } = {}) {
  const achievements = player.achievements || { unlocked: [], total_battles: 0, total_gold: 0, total_bosses: 0 };
  achievements.total_battles = (achievements.total_battles || 0) + battles;
  achievements.total_gold    = (achievements.total_gold    || 0) + gold;
  achievements.total_bosses  = (achievements.total_bosses  || 0) + bosses;
  return achievements;
}