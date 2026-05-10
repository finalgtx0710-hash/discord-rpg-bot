// 敵データ
export const ENEMIES = [
  {
    name: "エーテルスライム",
    emoji: "🟦",
    hp: 30, atk: 6, def: 2,
    exp: 10, gold: 5,
  },
  {
    name: "遺跡のゴブリン",
    emoji: "👺",
    hp: 45, atk: 9, def: 4,
    exp: 18, gold: 12,
  },
  {
    name: "黒鉄のウルフ",
    emoji: "🐺",
    hp: 60, atk: 12, def: 5,
    exp: 25, gold: 18,
  },
  {
    name: "腐食の蜘蛛",
    emoji: "🕷️",
    hp: 35, atk: 8, def: 3,
    exp: 14, gold: 8,
  },
  {
    name: "魔法結晶体",
    emoji: "💎",
    hp: 50, atk: 11, def: 6,
    exp: 22, gold: 15,
  },
];

/**
 * ランダムに敵を1体返す（深いコピー）
 */
export function getRandomEnemy() {
  const base = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  return { ...base, maxHp: base.hp };
}
