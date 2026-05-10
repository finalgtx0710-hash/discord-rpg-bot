import { getRandomEnemy } from "./enemies.js";

// 探索イベント定義
const EVENTS = [
  { type: "enemy",   weight: 40 },
  { type: "gold",    weight: 25 },
  { type: "heal",    weight: 15 },
  { type: "nothing", weight: 20 },
];

const DIRECTION_NAMES = {
  north: "北",
  south: "南",
  east:  "東",
  west:  "西",
};

const LOCATIONS = [
  "始まりの遺跡",
  "黒鉄の森",
  "エーテル鉱山",
  "蒼晶洞窟",
  "崩壊した神殿",
  "古代回廊",
];

/**
 * ランダムイベントを抽選する
 */
function pickEvent() {
  const total = EVENTS.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ev of EVENTS) {
    r -= ev.weight;
    if (r <= 0) return ev.type;
  }
  return "nothing";
}

/**
 * 探索を実行してイベント結果を返す
 * @param {object} player
 * @param {string} direction - "north" | "south" | "east" | "west"
 * @returns {{ eventType: string, message: string, enemy?: object, healAmount?: number, goldAmount?: number }}
 */
export function runExplore(player, direction) {
  const dirName = DIRECTION_NAMES[direction] ?? direction;
  const eventType = pickEvent();

  // 場所をランダムに変更
  player.location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

  switch (eventType) {
    case "enemy": {
      const enemy = getRandomEnemy();
      return {
        eventType: "enemy",
        message: `${dirName}へ進んだ先で **${enemy.emoji} ${enemy.name}** と遭遇した！`,
        enemy,
      };
    }

    case "gold": {
      const amount = Math.floor(Math.random() * 20) + 5;
      player.gold += amount;
      return {
        eventType: "gold",
        message: `${dirName}の廃墟で **${amount}G** を見つけた！\n💰 所持金: **${player.gold}G**`,
        goldAmount: amount,
      };
    }

    case "heal": {
      const amount = Math.floor(player.maxHp * 0.3);
      const restored = Math.min(amount, player.maxHp - player.hp);
      player.hp = Math.min(player.maxHp, player.hp + amount);
      return {
        eventType: "heal",
        message: `${dirName}に回復の泉を見つけた！\n💧 HPが **${restored}** 回復した！ (${player.hp}/${player.maxHp})`,
        healAmount: restored,
      };
    }

    default:
      return {
        eventType: "nothing",
        message: `${dirName}へ進んだが、何も起きなかった…\nしかし、**${player.location}** に着いた。`,
      };
  }
}
