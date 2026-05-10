import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../data/players.json");

/**
 * players.json が存在しない場合に空ファイルを作成する
 */
export function ensurePlayersFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, "{}", "utf-8");
    console.log("✅ players.json を新規作成しました");
  }
}

/**
 * 全プレイヤーデータを読み込む
 */
function loadAll() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * 全プレイヤーデータを書き込む
 */
function saveAll(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * プレイヤーを取得（存在しなければ null）
 */
export function getPlayer(userId) {
  const all = loadAll();
  return all[userId] ?? null;
}

/**
 * プレイヤーを保存・更新
 */
export function savePlayer(player) {
  const all = loadAll();
  all[player.userId] = player;
  saveAll(all);
}

/**
 * 新規プレイヤーを作成して保存
 */
export function createPlayer(userId, username, className, classData) {
  const player = {
    userId,
    name: username,
    className,
    level: 1,
    exp: 0,
    expToNext: 30,
    gold: 50,
    hp: classData.hp,
    maxHp: classData.hp,
    mp: classData.mp,
    maxMp: classData.mp,
    atk: classData.atk,
    def: classData.def,
    spd: classData.spd,
    inventory: [],
    equipment: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    location: "始まりの遺跡",
    createdAt: new Date().toISOString(),
  };
  savePlayer(player);
  return player;
}
