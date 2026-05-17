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
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS players (
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
    subclass     TEXT DEFAULT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment (
    id         TEXT PRIMARY KEY,
    owner_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    rarity     TEXT NOT NULL,
    prefix     TEXT,
    base_atk   INTEGER NOT NULL DEFAULT 0,
    options    TEXT NOT NULL DEFAULT '[]',
    equipped   INTEGER NOT NULL DEFAULT 0,
    slot       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS player_skills (
    user_id     TEXT NOT NULL,
    skill_id    TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, skill_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS parties (
    party_id   TEXT PRIMARY KEY,
    leader_id  TEXT NOT NULL,
    members    TEXT NOT NULL DEFAULT '[]',
    status     TEXT NOT NULL DEFAULT 'waiting',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS party_invites (
    invitee_id TEXT PRIMARY KEY,
    party_id   TEXT NOT NULL,
    inviter_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);

  try { db.run("ALTER TABLE players ADD COLUMN equipment TEXT NOT NULL DEFAULT '{}'"); } catch(e) {}
  try { db.run('ALTER TABLE players ADD COLUMN quests TEXT NOT NULL DEFAULT \'{"active":{},"completed":[]}\''); } catch(e) {}
  try { db.run("ALTER TABLE players ADD COLUMN achievements TEXT NOT NULL DEFAULT '{\"unlocked\":[],\"total_battles\":0,\"total_gold\":0,\"total_bosses\":0}'"); } catch(e) {}
  try { db.run("ALTER TABLE players ADD COLUMN story TEXT NOT NULL DEFAULT '{\"viewed_scenes\":[],\"completed_chapters\":[],\"defeated_bosses\":[]}'"); } catch(e) {}
  try { db.run("ALTER TABLE players ADD COLUMN subclass TEXT DEFAULT NULL"); } catch(e) {}
  saveDatabase();
  console.log('✅ データベース初期化完了');
}

export function saveDatabase() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

export function getPlayer(userId) {
  const stmt = db.prepare('SELECT * FROM players WHERE user_id = ?');
  const result = stmt.getAsObject([userId]);
  stmt.free();
  if (!result.user_id) return null;
  result.inventory = JSON.parse(result.inventory || '[]');
  result.equipment = JSON.parse(result.equipment || '{}');
  result.quests    = JSON.parse(result.quests    || '{"active":{},"completed":[]}');
  result.story     = JSON.parse(result.story     || '{"viewed_scenes":[],"completed_chapters":[],"defeated_bosses":[]}');
  result.achievements = JSON.parse(result.achievements || '{"unlocked":[],"total_battles":0,"total_gold":0,"total_bosses":0}');
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
  if (fields.quests)    fields.quests    = JSON.stringify(fields.quests);
  if (fields.story) fields.story = JSON.stringify(fields.story);
  if (fields.achievements) fields.achievements = JSON.stringify(fields.achievements);
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

export function dbCreateParty(partyId, leaderId) {
  db.run('INSERT INTO parties (party_id, leader_id, members) VALUES (?, ?, ?)',
    [partyId, leaderId, JSON.stringify([leaderId])]);
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

export function dbSetInvite(inviteeId, partyId, inviterId, expiresAt) {
  db.run('DELETE FROM party_invites WHERE invitee_id = ?', [inviteeId]);
  db.run('INSERT INTO party_invites (invitee_id, party_id, inviter_id, expires_at) VALUES (?, ?, ?, ?)',
    [inviteeId, partyId, inviterId, expiresAt]);
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

function parseEquipmentRow(row) {
  if (!row?.id) return null;
  return {
    ...row,
    options: JSON.parse(row.options || '[]'),
    equipped: Boolean(row.equipped),
  };
}

export function dbCreateEquipment(item) {
  db.run(
    `INSERT INTO equipment (id, owner_id, name, rarity, prefix, base_atk, options, equipped, slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.owner_id,
      item.name,
      item.rarity,
      item.prefix,
      item.base_atk || 0,
      JSON.stringify(item.options || []),
      item.equipped ? 1 : 0,
      item.slot || null,
    ]
  );
  saveDatabase();
  return dbGetEquipmentById(item.id);
}

export function dbGetEquipmentById(id) {
  const stmt = db.prepare('SELECT * FROM equipment WHERE id = ?');
  const row = stmt.getAsObject([id]);
  stmt.free();
  return parseEquipmentRow(row);
}

export function dbGetEquipmentByOwner(ownerId) {
  const stmt = db.prepare('SELECT * FROM equipment WHERE owner_id = ? ORDER BY created_at DESC');
  const rows = [];
  stmt.bind([ownerId]);
  while (stmt.step()) rows.push(parseEquipmentRow(stmt.getAsObject()));
  stmt.free();
  return rows.filter(Boolean);
}

export function dbEquipGeneratedItem(ownerId, itemId) {
  const item = dbGetEquipmentById(itemId);
  if (!item || item.owner_id !== ownerId || !item.slot) return null;
  db.run('UPDATE equipment SET equipped = 0 WHERE owner_id = ? AND slot = ?', [ownerId, item.slot]);
  db.run('UPDATE equipment SET equipped = 1 WHERE id = ?', [itemId]);
  saveDatabase();
  return dbGetEquipmentById(itemId);
}

export function dbUnequipGeneratedSlot(ownerId, slot) {
  db.run('UPDATE equipment SET equipped = 0 WHERE owner_id = ? AND slot = ?', [ownerId, slot]);
  saveDatabase();
}

export function dbDeleteEquipment(ownerId, itemId) {
  db.run('DELETE FROM equipment WHERE owner_id = ? AND id = ?', [ownerId, itemId]);
  saveDatabase();
}

export function dbUnlockPlayerSkill(userId, skillId) {
  db.run('INSERT OR IGNORE INTO player_skills (user_id, skill_id) VALUES (?, ?)', [userId, skillId]);
  saveDatabase();
}

export function dbGetPlayerSkills(userId) {
  const stmt = db.prepare('SELECT skill_id FROM player_skills WHERE user_id = ?');
  const rows = [];
  stmt.bind([userId]);
  while (stmt.step()) rows.push(stmt.getAsObject().skill_id);
  stmt.free();
  return rows;
}
