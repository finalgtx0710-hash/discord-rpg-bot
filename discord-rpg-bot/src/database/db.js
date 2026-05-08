// src/database/db.js
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/game.db');

let db = null;

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      user_id      TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      class        TEXT NOT NULL DEFAULT 'warrior',
      level        INTEGER NOT NULL DEFAULT 1,
      exp          INTEGER NOT NULL DEFAULT 0,
      hp           INTEGER NOT NULL DEFAULT 100,
      max_hp       INTEGER NOT NULL DEFAULT 100,
      mp           INTEGER NOT NULL DEFAULT 30,
      max_mp       INTEGER NOT NULL DEFAULT 30,
      atk          INTEGER NOT NULL DEFAULT 10,
      def          INTEGER NOT NULL DEFAULT 5,
      spd          INTEGER NOT NULL DEFAULT 8,
      gold         INTEGER NOT NULL DEFAULT 100,
      inventory    TEXT NOT NULL DEFAULT '[]',
      current_area TEXT NOT NULL DEFAULT 'starting_village',
      equipment    TEXT NOT NULL DEFAULT '{}',
      quests       TEXT NOT NULL DEFAULT '{"active":{},"completed":[]}',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // パーティテーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS parties (
      party_id   TEXT PRIMARY KEY,
      leader_id  TEXT NOT NULL,
      members    TEXT NOT NULL DEFAULT '[]',
      status     TEXT NOT NULL DEFAULT 'waiting',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 招待テーブル
  db.run(`
    CREATE TABLE IF NOT EXISTS party_invites (
      invitee_id TEXT PRIMARY KEY,
      party_id   TEXT NOT NULL,
      inviter_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  // 既存DBにequipmentカラムがなければ追加
  try { db.run("ALTER TABLE players ADD COLUMN equipment TEXT NOT NULL DEFAULT '{}'"); } catch(e) {}
  try { db.run("ALTER TABLE players ADD COLUMN quests TEXT NOT NULL DEFAULT '{\"active\":{},\"completed\":[]}'  "); } catch(e) {}

  saveDatabase();
  console.log('✅ データベース初期化完了');
}

export function saveDatabase() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ===== プレイヤー =====
export function getPlayer(userId) {
  const stmt = db.prepare('SELECT * FROM players WHERE user_id = ?');
  const result = stmt.getAsObject([userId]);
  stmt.free();
  if (!result.user_id) return null;
  result.inventory = JSON.parse(result.inventory);
  result.equipment = JSON.parse(result.equipment || '{}');
  result.quests = JSON.parse(result.quests || '{"active":{},"completed":[]}');
  return result;
}

export function createPlayer(userId, name, playerClass) {
  const classStats = {
    warrior: { hp: 120, mp: 20, atk: 14, def: 10, spd: 7 },
    mage:    { hp: 70,  mp: 60, atk: 8,  def: 4,  spd: 9 },
    cleric:  { hp: 90,  mp: 50, atk: 7,  def: 7,  spd: 7 },
    rogue:   { hp: 85,  mp: 25, atk: 12, def: 5,  spd: 14 },
    archer:  { hp: 95,  mp: 30, atk: 11, def: 6,  spd: 11 },
  };
  const stats = classStats[playerClass] || classStats.warrior;
  db.run(
    `INSERT INTO players (user_id, name, class, hp, max_hp, mp, max_mp, atk, def, spd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, name, playerClass, stats.hp, stats.hp, stats.mp, stats.mp, stats.atk, stats.def, stats.spd]
  );
  saveDatabase();
  return getPlayer(userId);
}

export function updatePlayer(userId, fields) {
  if (fields.inventory) fields.inventory = JSON.stringify(fields.inventory);
  if (fields.equipment) fields.equipment = JSON.stringify(fields.equipment);
  if (fields.quests) fields.quests = JSON.stringify(fields.quests);
  fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  db.run(`UPDATE players SET ${setClause} WHERE user_id = ?`, [...keys.map(k => fields[k]), userId]);
  saveDatabase();
}

export function getRanking(limit = 10) {
  const stmt = db.prepare('SELECT name, class, level, exp FROM players ORDER BY level DESC, exp DESC LIMIT ?');
  const rows = [];
  stmt.bind([limit]);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// ===== パーティ =====
export function dbCreateParty(partyId, leaderId) {
  db.run(
    'INSERT INTO parties (party_id, leader_id, members) VALUES (?, ?, ?)',
    [partyId, leaderId, JSON.stringify([leaderId])]
  );
  saveDatabase();
}

export function dbGetPartyByUser(userId) {
  const stmt = db.prepare('SELECT * FROM parties WHERE members LIKE ?');
  const rows = [];
  stmt.bind([`%"${userId}"%`]);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  for (const row of rows) {
    row.members = JSON.parse(row.members);
    if (row.members.includes(userId)) return row;
  }
  return null;
}

export function dbGetPartyById(partyId) {
  const stmt = db.prepare('SELECT * FROM parties WHERE party_id = ?');
  const result = stmt.getAsObject([partyId]);
  stmt.free();
  if (!result.party_id) return null;
  result.members = JSON.parse(result.members);
  return result;
}

export function dbUpdateParty(partyId, fields) {
  if (fields.members) fields.members = JSON.stringify(fields.members);
  const keys = Object.keys(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  db.run(`UPDATE parties SET ${setClause} WHERE party_id = ?`, [...keys.map(k => fields[k]), partyId]);
  saveDatabase();
}

export function dbDeleteParty(partyId) {
  db.run('DELETE FROM parties WHERE party_id = ?', [partyId]);
  db.run('DELETE FROM party_invites WHERE party_id = ?', [partyId]);
  saveDatabase();
}

// ===== 招待 =====
export function dbSetInvite(inviteeId, partyId, inviterId, expiresAt) {
  db.run('DELETE FROM party_invites WHERE invitee_id = ?', [inviteeId]);
  db.run(
    'INSERT INTO party_invites (invitee_id, party_id, inviter_id, expires_at) VALUES (?, ?, ?, ?)',
    [inviteeId, partyId, inviterId, expiresAt]
  );
  saveDatabase();
}

export function dbGetInvite(inviteeId) {
  const stmt = db.prepare('SELECT * FROM party_invites WHERE invitee_id = ?');
  const result = stmt.getAsObject([inviteeId]);
  stmt.free();
  return result.invitee_id ? result : null;
}

export function dbDeleteInvite(inviteeId) {
  db.run('DELETE FROM party_invites WHERE invitee_id = ?', [inviteeId]);
  saveDatabase();
}
