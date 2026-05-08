// src/game/quest.js
// クエストシステム

import { dbGetPartyByUser } from '../database/db.js';

// クエスト定義
export const QUESTS = {
  // 始まりの村クエスト
  q001: {
    id: 'q001',
    title: 'スライム退治',
    description: 'スライムを3体倒してください。',
    area: 'starting_village',
    type: 'kill',
    target: 'slime',
    required: 3,
    rewards: { exp: 50, gold: 80, items: [] },
    level_req: 1,
  },
  q002: {
    id: 'q002',
    title: 'ゴブリンの脅威',
    description: 'ゴブリンを5体倒して村の安全を確保してください。',
    area: 'starting_village',
    type: 'kill',
    target: 'goblin',
    required: 5,
    rewards: { exp: 120, gold: 150, items: ['iron_dagger'] },
    level_req: 2,
  },
  q003: {
    id: 'q003',
    title: '初めての探索',
    description: '始まりの村で5回探索してください。',
    area: 'starting_village',
    type: 'explore',
    target: 'starting_village',
    required: 5,
    rewards: { exp: 80, gold: 100, items: ['potion'] },
    level_req: 1,
  },
  // 囁きの森クエスト
  q004: {
    id: 'q004',
    title: 'ウルフハンター',
    description: 'ダークウルフを3体倒してください。',
    area: 'forest_of_whispers',
    type: 'kill',
    target: 'wolf',
    required: 3,
    rewards: { exp: 200, gold: 250, items: ['mp_potion'] },
    level_req: 5,
  },
  q005: {
    id: 'q005',
    title: '森の精霊を鎮める',
    description: 'フォレストスプライトを4体倒してください。',
    area: 'forest_of_whispers',
    type: 'kill',
    target: 'forest_sprite',
    required: 4,
    rewards: { exp: 250, gold: 300, items: ['silver_ring'] },
    level_req: 6,
  },
  q006: {
    id: 'q006',
    title: 'ダークゴブリンの親玉',
    description: 'ダークゴブリンを5体倒してください。',
    area: 'forest_of_whispers',
    type: 'kill',
    target: 'dark_goblin',
    required: 5,
    rewards: { exp: 350, gold: 400, items: ['steel_sword'] },
    level_req: 7,
  },
  // 古代遺跡クエスト
  q007: {
    id: 'q007',
    title: 'ゴーレム討伐',
    description: 'ストーンゴーレムを3体倒してください。',
    area: 'ancient_ruins',
    type: 'kill',
    target: 'stone_golem',
    required: 3,
    rewards: { exp: 500, gold: 600, items: ['iron_shield'] },
    level_req: 12,
  },
  q008: {
    id: 'q008',
    title: '遺跡の守護者を倒せ',
    description: '遺跡の守護者を2体倒し、古代遺跡の謎に迫ってください。',
    area: 'ancient_ruins',
    type: 'kill',
    target: 'ruin_guardian',
    required: 2,
    rewards: { exp: 800, gold: 1000, items: ['ancient_crystal'] },
    level_req: 14,
  },
};

// エリアで受注できるクエスト一覧を取得
export function getAvailableQuests(player) {
  const activeIds = Object.keys(player.quests?.active || {});
  const completedIds = player.quests?.completed || [];

  return Object.values(QUESTS).filter(q =>
    q.area === player.current_area &&
    player.level >= q.level_req &&
    !activeIds.includes(q.id) &&
    !completedIds.includes(q.id)
  );
}

// クエストを受注
export function acceptQuest(player, questId) {
  const quest = QUESTS[questId];
  if (!quest) return { ok: false, message: '⚠️ クエストが見つかりません。' };
  if (player.level < quest.level_req) return { ok: false, message: `⚠️ Lv.${quest.level_req}以上が必要です。` };

  const quests = player.quests || { active: {}, completed: [] };
  if (quests.active[questId]) return { ok: false, message: '⚠️ すでに受注済みです。' };
  if (quests.completed.includes(questId)) return { ok: false, message: '⚠️ すでに完了済みのクエストです。' };

  quests.active[questId] = { progress: 0, accepted_at: new Date().toISOString() };
  return { ok: true, quests };
}

// クエスト進捗を更新（戦闘勝利・探索時に呼ぶ）
export function updateQuestProgress(player, type, target) {
  const quests = player.quests || { active: {}, completed: [] };
  const updates = [];

  for (const [questId, progress] of Object.entries(quests.active)) {
    const quest = QUESTS[questId];
    if (!quest) continue;
    if (quest.type !== type) continue;
    if (quest.target !== target) continue;

    progress.progress = (progress.progress || 0) + 1;
    updates.push({ questId, progress: progress.progress, required: quest.required });
  }

  return { quests, updates };
}

// 完了したクエストをチェックして報酬を返す
export function checkQuestCompletion(player) {
  const quests = player.quests || { active: {}, completed: [] };
  const completed = [];

  for (const [questId, progress] of Object.entries(quests.active)) {
    const quest = QUESTS[questId];
    if (!quest) continue;
    if ((progress.progress || 0) >= quest.required) {
      completed.push({ questId, quest });
    }
  }

  // 完了したクエストをactiveから削除してcompletedに移動
  for (const { questId } of completed) {
    delete quests.active[questId];
    quests.completed.push(questId);
  }

  return { quests, completed };
}
