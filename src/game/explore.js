import { AREAS, ENEMIES } from '../data/master.js';
import { getPlayer, updatePlayer, dbCreateEquipment } from '../database/db.js';
import { updateQuestProgress, checkQuestCompletion } from './quest.js';
import { startBattle } from './battle.js';
import { generateEquipment } from './loot.js';

const exploreCooldowns = new Map();
const COOLDOWN_MS = 30 * 1000;

const EVENT_TABLE = [
  { type: 'battle', weight: 40 },
  { type: 'treasure', weight: 15 },
  { type: 'npc', weight: 10 },
  { type: 'choice', weight: 15 },
  { type: 'rare_enemy', weight: 5 },
  { type: 'hidden_room', weight: 5 },
  { type: 'nothing', weight: 7 },
  { type: 'boss_intrusion', weight: 3 },
];

const RARE_ENEMIES = [
  { name: 'メタルスライム', hpRate: 0.6, atkRate: 1.2, defRate: 3, spdRate: 2, expRate: 3, goldRate: 3 },
  { name: '暴走ゴブリンキング', hpRate: 2.5, atkRate: 2, defRate: 1.5, spdRate: 1, expRate: 3, goldRate: 3 },
  { name: 'シャドウナイト', hpRate: 2, atkRate: 2.4, defRate: 1.8, spdRate: 1.5, expRate: 3, goldRate: 3 },
];

function pickWeighted(table) {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry.type;
  }
  return table[table.length - 1].type;
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function applyExploreQuestProgress(userId, areaKey) {
  const player = getPlayer(userId);
  if (!player) return;

  const { quests: updatedQuests } = updateQuestProgress(player, 'explore', areaKey);
  const { quests: finalQuests, completed } = checkQuestCompletion({ ...player, quests: updatedQuests });
  const bonusGold = completed.reduce((sum, { quest }) => sum + quest.rewards.gold, 0);
  updatePlayer(userId, {
    quests: finalQuests,
    ...(bonusGold ? { gold: player.gold + bonusGold } : {}),
  });
}

class ExploreEventHandler {
  constructor(userId, areaKey, area) {
    this.userId = userId;
    this.areaKey = areaKey;
    this.area = area;
  }
}

export class BattleEventHandler extends ExploreEventHandler {
  handle() {
    const enemyKey = pickOne(this.area.enemies);
    const enemy = startBattle(this.userId, enemyKey);
    return {
      type: 'battle',
      title: 'エンカウント',
      message: `**${this.area.name}** を探索中、**${enemy.name}** が現れた！`,
      enemy,
      enemyKey,
      actions: ['attack', 'skill', 'item', 'escape'],
    };
  }
}

export class TreasureEventHandler extends ExploreEventHandler {
  handle() {
    const gold = 10 + Math.floor(Math.random() * 40);
    const player = getPlayer(this.userId);
    if (player) updatePlayer(this.userId, { gold: player.gold + gold });
    const equipment = Math.random() < 0.35 ? dbCreateEquipment(generateEquipment(this.userId)) : null;
    return {
      type: 'treasure',
      title: '宝箱発見',
      message: `**${this.area.name}** を探索中、**${gold}G** を手に入れた！`,
      gold,
      equipment,
    };
  }
}

export class NpcEventHandler extends ExploreEventHandler {
  handle() {
    const npcs = [
      { name: '旅の商人', message: 'この先の道は魔物が増えている。回復薬の準備を忘れるなよ。', imageKey: 'traveling_merchant' },
      { name: '老婦人', message: '草原の風が騒ぐ日は、珍しいものが見つかると言われておるよ。', imageKey: 'old_woman' },
      { name: '傭兵', message: '強敵に出会ったら無理はするな。生きて帰るのも腕のうちだ。' },
    ];
    const npc = pickOne(npcs);
    return {
      type: 'npc',
      title: `${npc.name} と出会った`,
      message: `**${this.area.name}** を探索中...\n${npc.message}`,
      npc,
    };
  }
}

export class ChoiceEventHandler extends ExploreEventHandler {
  handle() {
    return {
      type: 'choice',
      title: '怪しい祭壇',
      message: `**${this.area.name}** を探索中、古びた祭壇を見つけた。\nどうしますか？`,
      choices: [
        { id: 'touch', label: '触れる' },
        { id: 'pray', label: '祈る' },
        { id: 'ignore', label: '無視する' },
      ],
    };
  }
}

export class RareEnemyEventHandler extends ExploreEventHandler {
  handle() {
    const baseEnemyKey = pickOne(this.area.enemies);
    const baseEnemy = ENEMIES[baseEnemyKey];
    const rare = pickOne(RARE_ENEMIES);
    const enemy = startBattle(this.userId, baseEnemyKey);
    Object.assign(enemy, {
      name: rare.name,
      hp: Math.max(1, Math.floor(baseEnemy.hp * rare.hpRate)),
      currentHp: Math.max(1, Math.floor(baseEnemy.hp * rare.hpRate)),
      atk: Math.max(1, Math.floor(baseEnemy.atk * rare.atkRate)),
      def: Math.max(0, Math.floor(baseEnemy.def * rare.defRate)),
      spd: Math.max(1, Math.floor(baseEnemy.spd * rare.spdRate)),
      exp: Math.max(1, Math.floor(baseEnemy.exp * rare.expRate)),
      gold: baseEnemy.gold.map((value) => Math.max(1, Math.floor(value * rare.goldRate))),
      rare: true,
    });

    return {
      type: 'rare_enemy',
      title: 'レア敵出現',
      message: `✨ **${rare.name}** が現れた！\n報酬が大きい特別な個体だ！`,
      enemy,
      enemyKey: baseEnemyKey,
      actions: ['attack', 'skill', 'item', 'escape'],
      rare: true,
    };
  }
}

export class HiddenRoomEventHandler extends ExploreEventHandler {
  handle() {
    const gold = 40 + Math.floor(Math.random() * 90);
    const player = getPlayer(this.userId);
    if (player) updatePlayer(this.userId, { gold: player.gold + gold });
    const equipment = dbCreateEquipment(generateEquipment(this.userId));
    return {
      type: 'hidden_room',
      title: '隠し部屋',
      message: `草むらの奥に隠し部屋を見つけた！\n古い壺の中から **${gold}G** と装備を手に入れた。`,
      gold,
      equipment,
    };
  }
}

export class NothingEventHandler extends ExploreEventHandler {
  handle() {
    const messages = [
      '静かな道を歩いた。特に何も起きなかった。',
      '風が草を揺らしている。少しだけ心が落ち着いた。',
      '遠くで魔物の声が聞こえたが、姿は見えなかった。',
      '古い石碑を見つけたが、文字は風化して読めなかった。',
    ];
    return {
      type: 'nothing',
      title: '探索',
      message: `**${this.area.name}** を探索した...\n${pickOne(messages)}`,
    };
  }
}

export class BossIntrusionEventHandler extends ExploreEventHandler {
  handle() {
    const baseEnemyKey = pickOne(this.area.enemies);
    const baseEnemy = ENEMIES[baseEnemyKey];
    const enemy = startBattle(this.userId, baseEnemyKey);
    Object.assign(enemy, {
      name: `乱入ボス ${baseEnemy.name}`,
      hp: Math.max(1, Math.floor(baseEnemy.hp * 2.2)),
      currentHp: Math.max(1, Math.floor(baseEnemy.hp * 2.2)),
      atk: Math.max(1, Math.floor(baseEnemy.atk * 1.8)),
      def: Math.max(0, Math.floor(baseEnemy.def * 1.5)),
      exp: Math.max(1, Math.floor(baseEnemy.exp * 2.5)),
      gold: baseEnemy.gold.map((value) => Math.max(1, Math.floor(value * 2.5))),
      bossIntrusion: true,
    });

    return {
      type: 'boss_intrusion',
      title: 'ボス乱入',
      message: `⚠️ **${enemy.name}** が乱入した！\n危険な気配が周囲を包んでいる。`,
      enemy,
      enemyKey: baseEnemyKey,
      actions: ['attack', 'skill', 'item', 'escape'],
      bossIntrusion: true,
    };
  }
}

const HANDLERS = {
  battle: BattleEventHandler,
  treasure: TreasureEventHandler,
  npc: NpcEventHandler,
  choice: ChoiceEventHandler,
  rare_enemy: RareEnemyEventHandler,
  hidden_room: HiddenRoomEventHandler,
  nothing: NothingEventHandler,
  boss_intrusion: BossIntrusionEventHandler,
};

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
  if (!area) return { type: 'error', title: 'エラー', message: 'エリアが見つかりません。' };

  exploreCooldowns.set(userId, Date.now());
  applyExploreQuestProgress(userId, areaKey);

  const eventType = pickWeighted(EVENT_TABLE);
  const Handler = HANDLERS[eventType] || NothingEventHandler;
  return new Handler(userId, areaKey, area).handle();
}
