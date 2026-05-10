// クラス定義
export const CLASSES = {
  Warrior: {
    name: "Warrior",
    emoji: "⚔️",
    description: "高いHPと防御力を持つ前衛戦士。堅実な戦いが得意。",
    hp: 100, mp: 30, atk: 15, def: 10, spd: 8,
  },
  Mage: {
    name: "Mage",
    emoji: "🔮",
    description: "低HPだが強力な魔法を扱う。MPが豊富。",
    hp: 60, mp: 100, atk: 8, def: 5, spd: 12,
  },
  Cleric: {
    name: "Cleric",
    emoji: "✨",
    description: "回復と支援が得意なバランス型。パーティの要。",
    hp: 80, mp: 80, atk: 7, def: 8, spd: 10,
  },
  Rogue: {
    name: "Rogue",
    emoji: "🗡️",
    description: "最高の攻撃力と素早さを持つ奇襲型。DEFは低め。",
    hp: 70, mp: 40, atk: 18, def: 6, spd: 15,
  },
  Archer: {
    name: "Archer",
    emoji: "🏹",
    description: "遠距離から攻撃する万能型。バランスが良い。",
    hp: 75, mp: 50, atk: 16, def: 7, spd: 13,
  },
};

export function getClassNames() {
  return Object.keys(CLASSES);
}
