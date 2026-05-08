import { AREAS, ENEMIES } from '../data/master.js';
import { getPlayer, updatePlayer } from '../database/db.js';
import { updateQuestProgress, checkQuestCompletion } from './quest.js';
import { startBattle } from './battle.js';

const exploreCooldowns = new Map();
const COOLDOWN_MS = 3 * 1000;

export function canExplore(userId) {
  const last = exploreCooldowns.get(userId);
  if (!last) return { ok: true };
  const elapsed = Date.now() - last;
  if (elapsed >= COOLDOWN_MS) return { ok: true };
  const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
  return { ok: false, remaining };
}

export function explore(userId, areaKey) {
  const area = AREAS[areaKey];
  if (!area) return { type: 'error', message: 'エリアが見つかりません。' };

  exploreCooldowns.set(userId, Date.now());

  // 探索クエスト進捗更新
  const p = getPlayer(userId);
  if (p) {
    const { quests: uq } = updateQuestProgress(p, 'explore', areaKey);
    const { quests: fq, completed } = checkQuestCompletion({ ...p, quests: uq });
    let bonusGold = 0;
    for (const { quest } of completed) bonusGold += quest.rewards.gold;
    updatePlayer(userId, { quests: fq, ...(bonusGold ? { gold: p.gold + bonusGold } : {}) });
  }

  const roll = Math.random();

  if (roll < 0.45) {
    const enemyKey = area.enemies[Math.floor(Math.random() * area.enemies.length)];
    const enemy = startBattle(userId, enemyKey);
    return { type: 'battle', enemy, enemyKey };

  } else if (roll < 0.65) {
    const gold = 10 + Math.floor(Math.random() * 40);
    return { type: 'treasure', gold };

  } else if (roll < 0.80) {
    const messages = [
      '静かな道を歩いた。特に何も起きなかった。',
      '風が吹き抜けていった。',
      '遠くで鳥の声が聞こえた。',
      '道端に珍しい石が落ちていた。ただの石だった。',
    ];
    return { type: 'nothing', message: messages[Math.floor(Math.random() * messages.length)] };

  } else if (roll < 0.92) {
    const heal = 15 + Math.floor(Math.random() * 20);
    return { type: 'heal', heal };

  } else {
    const npcs = [
      { name: '旅の商人', message: '「エーテル結晶が消えてから、この道も物騒になったよ。気をつけてくれ。」' },
      { name: '老婆',     message: '「昔はここに大きな結晶があったんじゃよ。今は何も残っておらんが…」' },
      { name: '傭兵',     message: '「最近、古代遺跡の方から奇妙な光が見えるんだ。あまり近づかない方がいい。」' },
    ];
    const npc = npcs[Math.floor(Math.random() * npcs.length)];
    return { type: 'npc', npc };
  }
}